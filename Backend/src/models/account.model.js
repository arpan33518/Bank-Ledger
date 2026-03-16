import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",                    // links to user.model.js
        required: [ true, "Account must be associated with a user" ],
        index: true                     // fast lookup, NOT unique (multiple accounts per user allowed)
    },
    accountName: {
        type: String,
        required: [ true, "Account name is required" ],
        trim: true,
        default: "My Account"
    },
    currency: {
        type: String,
        required: [ true, "Currency is required" ],
        default: "INR"
    },
    status: {
        type: String,
        enum: {
            values: [ "ACTIVE", "FROZEN", "CLOSED" ],
            message: "Status can be either ACTIVE, FROZEN or CLOSED",
        },
        default: "ACTIVE"
    },
}, {
    timestamps: true
})

const Account = mongoose.model("Account", accountSchema)

export default Account
