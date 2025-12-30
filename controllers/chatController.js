import ChatMessage from "../models/ChatMessage.js";
import ChatSupport from "../models/ChatSupport.js";
import User from "../models/user.js";

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
    const adminId = req.user?.id;

    // Lấy tin nhắn cuối cùng theo user
    const lastMessages = await ChatMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$user",
          lastMessage: { $first: "$$ROOT" },
        },
      },
    ]);

    const userIds = lastMessages.map((c) => c._id);

    // Lấy thông tin user
    const users = await User.find({ _id: { $in: userIds } })
      .select("username fullname email")
      .lean();
    const usersById = new Map(users.map((u) => [u._id.toString(), u]));

    // Lấy trạng thái hỗ trợ
    const supports = await ChatSupport.find({ user: { $in: userIds } })
      .populate("currentAdmin", "username fullname email")
      .populate("lastAdmin", "username fullname email")
      .lean();
    const supportsByUserId = new Map(
      supports.map((s) => [s.user.toString(), s])
    );

    const conversations = lastMessages
      .map((c) => {
        const userId = c._id.toString();
        const user = usersById.get(userId) || {};
        const support = supportsByUserId.get(userId) || {};

        const currentAdmin = support.currentAdmin || null;
        const lastAdmin = support.lastAdmin || null;

        const currentAdminName = currentAdmin
          ? currentAdmin.fullname || currentAdmin.username || currentAdmin.email
          : null;
        const lastAdminName = lastAdmin
          ? lastAdmin.fullname || lastAdmin.username || lastAdmin.email
          : null;

        const isHandledByMe =
          !!currentAdmin && currentAdmin._id.toString() === String(adminId);

        return {
          userId,
          username: user.username,
          fullname: user.fullname,
          email: user.email,
          lastMessage: c.lastMessage.content,
          lastRole: c.lastMessage.role,
          lastAt: c.lastMessage.createdAt,
          currentAdminId: currentAdmin?._id || null,
          currentAdminName,
          lastAdminId: lastAdmin?._id || null,
          lastAdminName,
          isHandledByMe,
        };
      })
      .sort((a, b) => {
        const atA = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const atB = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return atB - atA;
      });

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

// Admin tham gia hỗ trợ một khách hàng
export const adminJoinSupport = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { userId } = req.params;

    if (!adminId) {
      return res.status(401).json({ message: "Không xác định được tài khoản admin." });
    }
    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    const support = await ChatSupport.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        currentAdmin: adminId,
        lastAdmin: adminId,
      },
      { new: true, upsert: true }
    )
      .populate("currentAdmin", "username fullname email")
      .populate("lastAdmin", "username fullname email");

    const currentAdminName = support.currentAdmin
      ? support.currentAdmin.fullname ||
        support.currentAdmin.username ||
        support.currentAdmin.email
      : null;

    const lastAdminName = support.lastAdmin
      ? support.lastAdmin.fullname ||
        support.lastAdmin.username ||
        support.lastAdmin.email
      : null;

    return res.json({
      message: "Đã tham gia hỗ trợ khách hàng.",
      support: {
        userId: support.user,
        currentAdminId: support.currentAdmin?._id || null,
        currentAdminName,
        lastAdminId: support.lastAdmin?._id || null,
        lastAdminName,
      },
    });
  } catch (err) {
    console.error("adminJoinSupport error", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi tham gia hỗ trợ khách hàng." });
  }
};

// Admin kết thúc hỗ trợ (không xóa đoạn chat, chỉ rời hỗ trợ)
export const adminEndSupport = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { userId } = req.params;

    if (!adminId) {
      return res.status(401).json({ message: "Không xác định được tài khoản admin." });
    }
    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    const support = await ChatSupport.findOne({ user: userId });
    if (!support) {
      return res.status(404).json({ message: "Chưa có thông tin hỗ trợ cho khách hàng này." });
    }

    // Chỉ admin đang hỗ trợ mới được kết thúc
    if (
      support.currentAdmin &&
      support.currentAdmin.toString() !== String(adminId)
    ) {
      return res.status(403).json({
        message: "Chỉ admin đang hỗ trợ mới có thể kết thúc hỗ trợ.",
      });
    }

    support.currentAdmin = null;
    await support.save();

    await support.populate([
      { path: "currentAdmin", select: "username fullname email" },
      { path: "lastAdmin", select: "username fullname email" },
    ]);

    const lastAdminName = support.lastAdmin
      ? support.lastAdmin.fullname ||
        support.lastAdmin.username ||
        support.lastAdmin.email
      : null;

    return res.json({
      message: "Đã kết thúc hỗ trợ khách hàng (không xóa đoạn chat).",
      support: {
        userId: support.user,
        currentAdminId: null,
        currentAdminName: null,
        lastAdminId: support.lastAdmin?._id || null,
        lastAdminName,
      },
    });
  } catch (err) {
    console.error("adminEndSupport error", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi kết thúc hỗ trợ khách hàng." });
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

// Khách hàng xem admin đang/đã hỗ trợ mình
export const getUserSupportStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const support = await ChatSupport.findOne({ user: userId })
      .populate("currentAdmin", "username fullname email")
      .populate("lastAdmin", "username fullname email");

    if (!support) {
      return res.json({ currentAdmin: null, lastAdmin: null });
    }

    const mapAdmin = (admin) => {
      if (!admin) return null;
      return {
        id: admin._id,
        username: admin.username,
        fullname: admin.fullname,
        email: admin.email,
        displayName: admin.fullname || admin.username || admin.email,
      };
    };

    return res.json({
      currentAdmin: mapAdmin(support.currentAdmin),
      lastAdmin: mapAdmin(support.lastAdmin),
    });
  } catch (err) {
    console.error("getUserSupportStatus error", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy trạng thái hỗ trợ khách hàng." });
  }
};

export default {
  sendChatMessage,
  getChatHistory,
  getConversationsForAdmin,
  getChatHistoryForAdmin,
  adminSendMessage,
  adminJoinSupport,
  adminEndSupport,
  getUserSupportStatus,
};
