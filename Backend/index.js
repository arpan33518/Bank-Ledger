import "dotenv/config";
import express from "express";
import emailRoutes from "./src/routes/email.route.js";
import accountRoutes from "./src/routes/account.route.js";
import transactionRoutes from "./src/routes/transaction.route.js";
import cors from "cors";
import connectDB from "./src/lib/db.js";
import { clerkMiddleware } from "@clerk/express";



const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());
app.use("/api/email", emailRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
    
// app.get("/api/health", (req, res) => {
//   res.json({ status: "Backend is connected!" });
// });


connectDB();

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});