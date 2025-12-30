import ChatMessage from "../models/ChatMessage.js";

export const sendChatMessage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Nội dung tin nhắn không hợp lệ." });
    }

    // Lưu tin nhắn của người dùng, không gọi AI
    const userMsg = await ChatMessage.create({
      user: userId,
      role: "user",
      content: message,
      isReadByAdmin: false,
    });

    return res.json({
      message: {
        id: userMsg._id,
        role: userMsg.role,
        content: userMsg.content,
        createdAt: userMsg.createdAt,
      },
    });
  } catch (err) {
    console.error("sendChatMessage error", err?.response?.data || err);
    return res.status(500).json({ message: "Lỗi server khi xử lý chat." });
  }
};

// Lấy danh sách hội thoại (mỗi user 1 đoạn chat) cho admin
export const getConversationsForAdmin = async (req, res) => {
  try {
    const conversations = await ChatMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$user",
          lastMessage: { $first: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: "$_id",
          username: "$user.username",
          fullname: "$user.fullname",
          email: "$user.email",
          lastMessage: "$lastMessage.content",
          lastRole: "$lastMessage.role",
          lastAt: "$lastMessage.createdAt",
          unreadCount: 1,
        },
      },
      { $sort: { lastAt: -1 } },
      { $sort: { lastAt: -1 } },
    ]);

    return res.json({ conversations });
  } catch (err) {
    console.error("getConversationsForAdmin error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách hội thoại." });
  }
};

// Admin xem lịch sử chat của một user cụ thể
export const getChatHistoryForAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    // đánh dấu các tin nhắn của KH là đã đọc
    await ChatMessage.updateMany(
      { user: userId, role: "user", isReadByAdmin: { $ne: true } },
      { $set: { isReadByAdmin: true } }
    );

    const messages = await ChatMessage.find({ user: userId })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      messages: messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("getChatHistoryForAdmin error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy lịch sử chat (admin)." });
  }
};

// Admin gửi tin nhắn cho user
export const adminSendMessage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Nội dung tin nhắn không hợp lệ." });
    }

    const adminMsg = await ChatMessage.create({
      user: userId,
      role: "assistant", // dùng lại role assistant cho admin
      content: message,
    });

    return res.json({
      message: {
        id: adminMsg._id,
        role: adminMsg.role,
        content: adminMsg.content,
        createdAt: adminMsg.createdAt,
      },
    });
  } catch (err) {
    console.error("adminSendMessage error", err);
    return res.status(500).json({ message: "Lỗi server khi admin gửi tin nhắn." });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const messages = await ChatMessage.find({ user: userId })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      messages: messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("getChatHistory error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy lịch sử chat." });
  }
};

export default {
  sendChatMessage,
  getChatHistory,
  getConversationsForAdmin,
  getChatHistoryForAdmin,
  adminSendMessage,
};
