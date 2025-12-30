import { Router } from "express";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import {
	sendChatMessage,
	getChatHistory,
	getConversationsForAdmin,
	getChatHistoryForAdmin,
	adminSendMessage,
} from "../controllers/chatController.js";

const router = Router();

// Người dùng gửi tin nhắn
router.post("/chat", authenticateToken, sendChatMessage);

// Người dùng lấy lịch sử chat của chính mình
router.get("/chat/history", authenticateToken, getChatHistory);

// Admin: danh sách hội thoại (mỗi user 1 đoạn chat)
router.get(
	"/admin/chat/conversations",
	authenticateToken,
	authorizeRole("admin"),
	getConversationsForAdmin
);

// Admin: xem chat của 1 user cụ thể
router.get(
	"/admin/chat/:userId",
	authenticateToken,
	authorizeRole("admin"),
	getChatHistoryForAdmin
);

// Admin: gửi tin cho 1 user
router.post(
	"/admin/chat/:userId",
	authenticateToken,
	authorizeRole("admin"),
	adminSendMessage
);

export default router;
