import express from "express";
import { createTransaction } from "../controllers/transaction.controller.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// Require authentication for ALL transaction actions
router.use(requireAuth);

router.post("/", createTransaction);

export default router;
