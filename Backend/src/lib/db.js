import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB connected");
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error.message);
        if (error.code === 8000 || error.codeName === 'AtlasError') {
            console.error("\n[Hint]: Authentication failed. Please check your MONGODB_URI credentials (username/password) in the .env file.");
            console.error("Also ensure your IP address is whitelisted in MongoDB Atlas Network Access.\n");
        }
        process.exit(1);
    }
};

export default connectDB;