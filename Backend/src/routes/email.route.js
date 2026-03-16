import express from "express";
import { sendWelcomeEmail } from "../lib/mailer.js";
import User from "../models/user.model.js";

const router = express.Router();

router.post("/send-welcome", async (req, res) => {
  const { email, name, clerkId } = req.body;

  if (!email || !clerkId) {
    return res.status(400).json({ error: "Email and clerkId are required" });
  }

  try {
    // Save or update user in MongoDB
    try {
      await User.findOneAndUpdate(
        { clerkId },
        { clerkId, email, firstName: name },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (dbErr) {
      // If duplicate key error (usually email, e.g. dev testing Clerk recreations)
      // we update the existing user having this email with the new clerkId
      if (dbErr.code === 11000) {
        await User.findOneAndUpdate(
          { email },
          { clerkId, firstName: name },
          { returnDocument: 'after' }
        );
      } else {
        throw dbErr;
      }
    }
    console.log(`✅ User saved to MongoDB: ${email}`);

    // Send welcome email (only on first sign-in, controlled by frontend localStorage)
    await sendWelcomeEmail(email, name || "User");
    console.log(`✅ Welcome email sent to ${email}`);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
