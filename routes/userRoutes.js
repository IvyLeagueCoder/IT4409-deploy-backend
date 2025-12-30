import { Router } from "express";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { getMe, updateMe, changePassword } from "../controllers/userController.js";

const router = Router();

// Chỉ dành cho user (customer) xem/cập nhật thông tin của chính mình
router.get("/user/me", authenticateToken, authorizeRole("customer"), getMe);
router.put("/user/me", authenticateToken, authorizeRole("customer"), updateMe);
router.put("/user/change-password", authenticateToken, authorizeRole("customer"), changePassword);

export default router;
