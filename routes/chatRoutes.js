import { Router } from "express";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import {
	sendChatMessage,
	getChatHistory,
	getConversationsForAdmin,
	getChatHistoryForAdmin,
	adminSendMessage,
	adminJoinSupport,
	adminEndSupport,
	getUserSupportStatus,
} from "../controllers/chatController.js";

const router = Router();

// Người dùng gửi tin nhắn
router.post("/chat", authenticateToken, sendChatMessage);

// Người dùng lấy lịch sử chat của chính mình
router.get("/chat/history", authenticateToken, getChatHistory);

// Người dùng xem admin đang/đã hỗ trợ mình
router.get("/chat/support-status", authenticateToken, getUserSupportStatus);

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

// Admin: tham gia hỗ trợ 1 user
router.post(
	"/admin/chat/:userId/join",
	authenticateToken,
	authorizeRole("admin"),
	adminJoinSupport
);

// Admin: kết thúc hỗ trợ 1 user (không xóa chat)
router.post(
	"/admin/chat/:userId/end",
	authenticateToken,
	authorizeRole("admin"),
	adminEndSupport
);

export default router;
