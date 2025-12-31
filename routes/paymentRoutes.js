import express from "express";
import {
  zaloPayCallback,
  checkZaloPayStatus,
  confirmZaloPayOrder,
} from "../controllers/paymentController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// ZaloPay callback URL (configure this URL in ZaloPay dashboard)
router.post("/payment/zalopay/callback", zaloPayCallback);

// Check ZaloPay payment status
router.get(
  "/payment/zalopay/status/:orderId",
  authenticateToken,
  checkZaloPayStatus
);

// Confirm ZaloPay order (auto confirm after 30s timeout)
router.post(
  "/payment/zalopay/confirm/:orderId",
  authenticateToken,
  confirmZaloPayOrder
);

export default router;
