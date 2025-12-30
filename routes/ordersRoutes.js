import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { authorizeRole } from "../middleware/auth.js";
import * as orderController from "../controllers/orderController.js";

const router = express.Router();

router.post("/orders", authenticateToken, orderController.createOrder);
router.get("/orders/my", authenticateToken, orderController.getMyOrders);
router.get("/orders", authenticateToken, authorizeRole("admin"), orderController.getAllOrders);
router.put("/orders/:id/cancel", authenticateToken, orderController.cancelOrder);
router.get("/orders/stats", authenticateToken, authorizeRole("admin"), orderController.getOrderStats);

export default router;
