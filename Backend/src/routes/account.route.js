import express from "express";
import { createAccount } from "../controllers/account.controller.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.post("/create", requireAuth, createAccount);

export default router;