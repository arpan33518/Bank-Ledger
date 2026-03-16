import Account from "../models/account.model.js";
import User from "../models/user.model.js";
import { getAuth } from "@clerk/express";

export const createAccount = async (req, res) => {
    try {
        const { userId: clerkId } = getAuth(req);           // Clerk user ID
        const { accountName, currency } = req.body;

        const mongoUser = await User.findOne({ clerkId });   // get MongoDB user
        if (!mongoUser) return res.status(404).json({ error: "User not found" });

        const account = await Account.create({
            user: mongoUser._id,    // ObjectId ref to User model
            accountName,
            currency
            // status defaults to "ACTIVE" automatically
        });

        res.status(201).json(account);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}