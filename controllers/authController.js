import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import {
  JWT_SECRET,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../config/email.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

async function verifyGoogleIdToken(idToken) {
  if (!googleClient || !googleClientId) {
    throw new Error("Google login is not configured on server");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: googleClientId,
  });
  return ticket.getPayload();
}

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Missing username or password" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const userObj = user.toObject();
    delete userObj.password;

    const accessToken = generateToken(
      user._id.toString(),
      user.role || "customer"
    );
    const refreshToken = generateRefreshToken(user._id.toString());

    return res.json({ user: userObj, token: accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Thiếu token Google." });
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(idToken);
    } catch (err) {
      console.error("verifyGoogleIdToken failed", err);
      return res.status(401).json({ message: "Token Google không hợp lệ." });
    }

    const { email, name, sub } = payload || {};
    if (!email) {
      return res
        .status(400)
        .json({ message: "Không lấy được email từ Google." });
    }

    let user = await User.findOne({ email });

    if (user) {
      // Nếu đã có tài khoản với email này, đăng nhập vào tài khoản đó
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
      }
      if (!user.authProvider) {
        user.authProvider = "local";
      }
      if (!user.googleId && sub) {
        user.googleId = sub;
      }
      await user.save();

      const userObj = user.toObject();
      delete userObj.password;

      const accessToken = generateToken(
        user._id.toString(),
        user.role || "customer"
      );
      const refreshToken = generateRefreshToken(user._id.toString());

      return res.json({
        user: userObj,
        token: accessToken,
        refreshToken,
        isNew: false,
      });
    }

    // Chưa có tài khoản: trả về thông tin để frontend chuyển sang form hoàn tất hồ sơ
    const googleSignupToken = jwt.sign(
      {
        email,
        fullname: name || "",
        sub: sub || "",
        type: "google-signup",
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      status: "need_profile",
      email,
      fullname: name || "",
      googleSignupToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const register = async (req, res) => {
  try {
    const {
      username,
      password,
      confirmPassword,
      email,
      fullname,
      phoneNumber,
      address,
    } = req.body;

    if (
      !username ||
      !password ||
      !confirmPassword ||
      !email ||
      !fullname ||
      !phoneNumber ||
      !address
    ) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin." });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Mật khẩu và xác nhận mật khẩu không khớp." });
    }

    const existing = await User.findOne({ username });
    if (existing)
      return res
        .status(409)
        .json({ message: "Tên đăng nhập đã được sử dụng." });

    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res.status(409).json({ message: "Email đã được sử dụng." });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      fullname,
      email,
      password: hashed,
      role: "customer",
      phoneNumber,
      addresses: [address],
      isEmailVerified: true, // Bỏ qua xác thực email
    });

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    const accessToken = generateToken(
      user._id.toString(),
      user.role || "customer"
    );
    const refreshToken = generateRefreshToken(user._id.toString());

    return res
      .status(201)
      .json({ user: userObj, token: accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const completeGoogleProfile = async (req, res) => {
  try {
    const {
      googleSignupToken,
      username,
      password,
      confirmPassword,
      fullname,
      phoneNumber,
      address,
    } = req.body;

    if (!googleSignupToken) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin xác thực Google." });
    }

    let decoded;
    try {
      decoded = jwt.verify(googleSignupToken, JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Phiên Google đã hết hạn hoặc không hợp lệ." });
    }

    if (!decoded || decoded.type !== "google-signup" || !decoded.email) {
      return res.status(400).json({ message: "Dữ liệu Google không hợp lệ." });
    }

    const email = decoded.email;
    const googleSub = decoded.sub || "";

    if (
      !username ||
      !password ||
      !confirmPassword ||
      !fullname ||
      !phoneNumber ||
      !address
    ) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin." });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Mật khẩu và xác nhận mật khẩu không khớp." });
    }

    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res
        .status(409)
        .json({ message: "Tên đăng nhập đã được sử dụng." });
    }

    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      // Nếu trong thời gian chờ, tài khoản đã được tạo, đăng nhập luôn
      const userObj = existingUserByEmail.toObject();
      delete userObj.password;

      const accessToken = generateToken(
        existingUserByEmail._id.toString(),
        existingUserByEmail.role || "customer"
      );
      const refreshToken = generateRefreshToken(
        existingUserByEmail._id.toString()
      );

      return res.json({
        user: userObj,
        token: accessToken,
        refreshToken,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      fullname,
      email,
      password: hashed,
      role: "customer",
      phoneNumber,
      addresses: [address],
      isEmailVerified: true,
      authProvider: "google",
      googleId: googleSub,
    });

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    const accessToken = generateToken(
      user._id.toString(),
      user.role || "customer"
    );
    const refreshToken = generateRefreshToken(user._id.toString());

    return res.status(201).json({
      user: userObj,
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminOnly = (req, res) => {
  return res.json({ message: "Hello admin" });
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Missing refresh token" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(payload.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newAccessToken = generateToken(
      user._id.toString(),
      user.role || "customer"
    );
    const newRefreshToken = generateRefreshToken(user._id.toString());

    return res.json({
      user,
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const forgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email." });
    }

    const user = await User.findOne({ email });

    // Để tránh lộ thông tin, vẫn trả về message chung nếu không tìm thấy user
    if (!user) {
      return res.json({
        message: "Nếu email tồn tại, chúng tôi đã gửi mã xác thực.",
      });
    }

    const code = generateVerificationCode(8);
    user.passwordResetCode = code;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.username, code);
    } catch (e) {
      console.error("Send password reset email failed", e);
    }

    return res.json({
      message: "Nếu email tồn tại, chúng tôi đã gửi mã xác thực.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resetPasswordWithCode = async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin." });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Mật khẩu mới và xác nhận không khớp." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản với email này." });
    }

    if (!user.passwordResetCode || !user.passwordResetExpires) {
      return res.status(400).json({
        message: "Không có mã đặt lại mật khẩu hợp lệ. Vui lòng yêu cầu lại.",
      });
    }

    const now = new Date();
    if (user.passwordResetExpires < now) {
      return res.status(400).json({
        message: "Mã đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.",
      });
    }

    if (user.passwordResetCode !== code.trim().toUpperCase()) {
      return res.status(400).json({ message: "Mã xác thực không đúng." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    user.password = hashed;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({
      message:
        "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default {
  login,
  googleLogin,
  register,
  completeGoogleProfile,
  profile,
  adminOnly,
  refreshToken,
  forgotPasswordRequest,
  resetPasswordWithCode,
};
