import mongoose from "mongoose";
import Transaction from "../models/transaction.model.js";
import Account from "../models/account.model.js";
import Ledger from "../models/ledger.model.js";
import User from "../models/user.model.js";
import { sendTransactionEmail } from "../lib/mailer.js";
import { getAuth } from "@clerk/express";



export const createTransaction = async (req, res) => {

//     * THE 10-STEP TRANSFER FLOW:
//      * 1. Validate request
//      * 2. Validate idempotency key
//      * 3. Check account status
//      * 4. Derive sender balance from ledger
//      * 5. Create transaction (PENDING)
//      * 6. Create DEBIT ledger entry
//      * 7. Create CREDIT ledger entry
//      * 8. Mark transaction COMPLETED
//      * 9. Commit MongoDB session
//      * 10. Send email notification
//  */
    // ------------------------------------------------------------------------
    // 1. Validate request
    // ------------------------------------------------------------------------
    const { fromAccountId, toAccountId, amount, idempotencyKey } = req.body;

    // Check for missing fields
    if (!fromAccountId || !toAccountId || !amount || !idempotencyKey) {
        return res.status(400).json({ 
            error: "Missing required fields: fromAccountId, toAccountId, amount, and idempotencyKey are required." 
        });
    }

    // Amount must be positive
    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ 
            error: "Invalid amount. Transfer amount must be a number greater than zero." 
        });
    }

    // Cannot transfer to the same account
    if (fromAccountId === toAccountId) {
        return res.status(400).json({ 
            error: "Sender and receiver accounts cannot be the same." 
        });
    }

    // Validate if the provided IDs are structurally valid MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(fromAccountId) || !mongoose.Types.ObjectId.isValid(toAccountId)) {
        return res.status(400).json({ 
            error: "Invalid account IDs provided." 
        });
    }

    try {
        // ------------------------------------------------------------------------
        // 2. Validate idempotency key
        // ------------------------------------------------------------------------
        // Check if a transaction with this idempotency key already exists.
        // This ensures the same transaction request isn't processed twice (e.g., if the user double-clicks the transfer button)
        const existingTx = await Transaction.findOne({ idempotencyKey });
        if (existingTx) {
            return res.status(409).json({
                error: "Duplicate transaction.",
                message: "A transaction with this idempotency key already exists.",
                transaction: existingTx
            });
        }
        // ------------------------------------------------------------------------
        // 3. Check account status
        // ------------------------------------------------------------------------
        // We use .populate("user") so we have access to their email addresses for Step 10
        const fromAccount = await Account.findById(fromAccountId).populate("user");
        const toAccount = await Account.findById(toAccountId).populate("user");

        if (!fromAccount) {
            return res.status(404).json({ error: "Sender account not found." });
        }
        if (!toAccount) {
            return res.status(404).json({ error: "Receiver account not found." });
        }

        // Verify Ownership
        const { userId: clerkId } = getAuth(req);
        if (!fromAccount.user || fromAccount.user.clerkId !== clerkId) {
            return res.status(403).json({ error: "Unauthorized: You do not own the sender account." });
        }

        // Both accounts must be ACTIVE to transact
        if (fromAccount.status !== "ACTIVE") {
            return res.status(400).json({ error: `Sender account is ${fromAccount.status}. Cannot perform transaction.` });
        }
        if (toAccount.status !== "ACTIVE") {
            return res.status(400).json({ error: `Receiver account is ${toAccount.status}. Cannot receive funds.` });
        }

        // ------------------------------------------------------------------------
        // 4. Derive sender balance from ledger
        // ------------------------------------------------------------------------
        // We aggregate all CREDIT and DEBIT entries for this account to find the real-time balance
        const balanceResult = await Ledger.aggregate([
            { $match: { account: fromAccount._id } },
            {
                $group: {
                    _id: "$account",
                    totalCredit: {
                        $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] }
                    },
                    totalDebit: {
                        $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] }
                    }
                }
            }
        ]);

        const totalCredit = balanceResult.length > 0 ? balanceResult[0].totalCredit : 0;
        const totalDebit = balanceResult.length > 0 ? balanceResult[0].totalDebit : 0;
        const currentBalance = totalCredit - totalDebit;

        if (currentBalance < amount) {
            return res.status(400).json({ 
                error: `Insufficient funds. Current balance: ${currentBalance}, Attempted transfer: ${amount}` 
            });
        }

        // ------------------------------------------------------------------------
        // 5. Create transaction (PENDING)
        // ------------------------------------------------------------------------
        // We start a database session. If anything fails between here and the commit, EVERYTHING is rolled back.
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // We pass the session to the create method
            const [newTransaction] = await Transaction.create([{
                fromAccount: fromAccountId,
                toAccount: toAccountId,
                amount,
                idempotencyKey,
                status: "PENDING" // This is the default in the model anyway
            }], { session });


            // ------------------------------------------------------------------------
            // 6. Create DEBIT ledger entry
            // ------------------------------------------------------------------------
            // We record that the sender's account lost money
            await Ledger.create([{
                account: fromAccountId,
                amount,
                transaction: newTransaction._id,    // Link to the pending transaction above
                type: "DEBIT"
            }], { session });

            // ------------------------------------------------------------------------
            // 7. Create CREDIT ledger entry
            // ------------------------------------------------------------------------
            // We record that the receiver's account gained money
            await Ledger.create([{
                account: toAccountId,
                amount,
                transaction: newTransaction._id,    // Link to the same transaction
                type: "CREDIT"
            }], { session });

            // ------------------------------------------------------------------------
            // 8. Mark transaction COMPLETED
            // ------------------------------------------------------------------------
            // The ledgers are created safely in memory, now we mark the transaction as done
            newTransaction.status = "COMPLETED";
            await newTransaction.save({ session });

            // ------------------------------------------------------------------------
            // 9. Commit MongoDB session
            // ------------------------------------------------------------------------
            // This is the magic step. This takes the pending transaction and two ledgers
            // and saves them to the actual database structure permanently and atomically.
            await session.commitTransaction();

            // ------------------------------------------------------------------------
            // 10. Send email notification
            // ------------------------------------------------------------------------
            // We do this AFTER the commit so we don't spam people if the DB fails
            try {
                // Email to sender
                if (fromAccount.user && fromAccount.user.email) {
                    await sendTransactionEmail({
                        toEmail: fromAccount.user.email,
                        subject: "Funds Transferred Successfully",
                        htmlContent: `
                            <h3>Hi ${fromAccount.user.firstName || "Customer"},</h3>
                            <p>You have successfully transferred <strong>$${amount}</strong> to account ${toAccount.accountName}.</p>
                            <p>Transaction ID: ${newTransaction._id}</p>
                            <br>
                            <p>Thank you for using Bank Ledger!</p>
                        `
                    });
                }
                
                // Email to receiver
                if (toAccount.user && toAccount.user.email) {
                    await sendTransactionEmail({
                        toEmail: toAccount.user.email,
                        subject: "Funds Received",
                        htmlContent: `
                            <h3>Hi ${toAccount.user.firstName || "Customer"},</h3>
                            <p>You have received a transfer of <strong>$${amount}</strong> from account ${fromAccount.accountName}.</p>
                            <p>Transaction ID: ${newTransaction._id}</p>
                            <br>
                            <p>Thank you for using Bank Ledger!</p>
                        `
                    });
                }
            } catch (emailError) {
                // We just log email errors, we don't want to crash the whole successful transaction just because of Mailer downtime
                console.error("Failed to send transaction emails:", emailError);
            }

            return res.status(200).json({ 
                message: "Transaction successful!", 
                transaction: newTransaction 
            });

        } catch (transactionError) {
            await session.abortTransaction();
            throw transactionError; // Re-throw to be caught by the outer catch block
        } finally {
            session.endSession();
        }

        

    } catch (error) {
        console.error("Transaction Error:", error);
        return res.status(500).json({ error: "Internal server error during transaction processing." });
    }
};
