import express from "express";
import { zaloPayCallback } from "../controllers/paymentController.js";

const router = express.Router();

// ZaloPay callback URL (configure this URL in ZaloPay dashboard)
router.post("/zalopay/callback", zaloPayCallback);

export default router;
