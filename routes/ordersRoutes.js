import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { authorizeRole } from "../middleware/auth.js";
import * as orderController from "../controllers/orderController.js";

const router = express.Router();

router.post("/orders", authenticateToken, orderController.createOrder);
router.get("/orders/my", authenticateToken, orderController.getMyOrders);
router.get(
  "/orders",
  authenticateToken,
  authorizeRole("admin"),
  orderController.getAllOrders
);
router.put(
  "/orders/:id/cancel",
  authenticateToken,
  orderController.cancelOrder
);
router.get(
  "/orders/stats",
  authenticateToken,
  authorizeRole("admin"),
  orderController.getOrderStats
);

// Admin routes
router.put(
  "/orders/:id/confirm",
  authenticateToken,
  authorizeRole("admin"),
  orderController.confirmOrderByAdmin
);
router.put(
  "/orders/:id/admin-cancel",
  authenticateToken,
  authorizeRole("admin"),
  orderController.cancelOrderByAdmin
);

// User routes for shipping orders
router.put(
  "/orders/:id/receive",
  authenticateToken,
  orderController.receiveOrder
);
router.put(
  "/orders/:id/refund",
  authenticateToken,
  orderController.refundOrder
);

export default router;
