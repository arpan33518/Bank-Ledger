import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    clerkId: {
        type: String,
        required: [ true, "Clerk user ID is required" ],
        unique: true,           // one MongoDB user per Clerk account
        index: true
    },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: [ true, "Email is required" ],
        unique: true,
        lowercase: true,
        trim: true
    },
    imageUrl: {
        type: String            // profile picture URL from Clerk
    }
}, {
    timestamps: true            // createdAt, updatedAt
})

const User = mongoose.model("User", userSchema)

export default User
