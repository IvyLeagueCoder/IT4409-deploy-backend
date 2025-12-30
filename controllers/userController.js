import User from "../models/user.js";
import bcrypt from "bcryptjs";

// Lấy thông tin tài khoản của chính user (role customer)
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.json({ user });
  } catch (err) {
    console.error("getMe error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy thông tin người dùng." });
  }
};

// Cập nhật thông tin cơ bản cho user (customer)
export const updateMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const { fullname, phoneNumber, email, address, avatarPicture } = req.body;

    const update = {};
    if (typeof fullname === "string" && fullname.trim()) update.fullname = fullname.trim();
    if (typeof phoneNumber === "string" && phoneNumber.trim()) update.phoneNumber = phoneNumber.trim();
    if (typeof email === "string" && email.trim()) update.email = email.trim();
    if (typeof address === "string" && address.trim()) update.addresses = [address.trim()];
    if (typeof avatarPicture === "string") update.avatarPicture = avatarPicture.trim();

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Không có thông tin nào để cập nhật." });
    }

    // Nếu đổi email, kiểm tra trùng
    if (update.email) {
      const existingEmail = await User.findOne({ email: update.email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(409).json({ message: "Email đã được sử dụng." });
      }
    }

    const user = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.json({ user });
  } catch (err) {
    console.error("updateMe error", err);
    return res.status(500).json({ message: "Lỗi server khi cập nhật thông tin người dùng." });
  }
};

// Đổi mật khẩu (yêu cầu mật khẩu cũ)
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu mới và xác nhận mật khẩu không khớp." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;
    await user.save();

    return res.json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    console.error("changePassword error", err);
    return res.status(500).json({ message: "Lỗi server khi đổi mật khẩu." });
  }
};

export default { getMe, updateMe, changePassword };
