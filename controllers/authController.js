import User from '../models/user.js';
import bcrypt from 'bcryptjs';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../config/email.js';

function generateVerificationCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing username or password' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const userObj = user.toObject();
    delete userObj.password;

    const accessToken = generateToken(user._id.toString(), user.role || 'customer');
    const refreshToken = generateRefreshToken(user._id.toString());

    return res.json({ user: userObj, token: accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
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

    if (!username || !password || !confirmPassword || !email || !fullname || !phoneNumber || !address) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu và xác nhận mật khẩu không khớp.' });
    }

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'Tên đăng nhập đã được sử dụng.' });

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(409).json({ message: 'Email đã được sử dụng.' });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      fullname,
      email,
      password: hashed,
      role: 'customer',
      phoneNumber,
      addresses: [address],
    });

    // Email test: bỏ qua bước xác thực, đăng nhập luôn
    if (email === '1234@example.com') {
      await user.save();
      const userObj = user.toObject();
      delete userObj.password;

      const accessToken = generateToken(user._id.toString(), user.role || 'customer');
      const refreshToken = generateRefreshToken(user._id.toString());

      return res.status(201).json({ user: userObj, token: accessToken, refreshToken });
    }

    // Các email khác: tạo code xác thực và gửi email
    const code = generateVerificationCode(8);
    user.isEmailVerified = false;
    user.emailVerificationCode = code;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await user.save();

    try {
      await sendVerificationEmail(email, code);
    } catch (e) {
      console.error('Send verification email failed', e);
      // Không rollback user, chỉ báo vẫn tạo tài khoản nhưng gửi mail lỗi
    }

    return res.status(201).json({
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập mã xác thực.',
      email,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const adminOnly = (req, res) => {
  return res.json({ message: 'Hello admin' });
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Missing refresh token' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(payload.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newAccessToken = generateToken(user._id.toString(), user.role || 'customer');
    const newRefreshToken = generateRefreshToken(user._id.toString());

    return res.json({
      user,
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Thiếu email hoặc mã xác thực.' });
    }

    const user = await User.findOne({ email }).select('+emailVerificationCode +emailVerificationExpires');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này.' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email đã được xác thực trước đó.' });
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      return res.status(400).json({ message: 'Không có mã xác thực hợp lệ. Vui lòng đăng ký lại.' });
    }

    const now = new Date();
    if (user.emailVerificationExpires < now) {
      return res.status(400).json({ message: 'Mã xác thực đã hết hạn. Vui lòng đăng ký lại.' });
    }

    if (user.emailVerificationCode !== code.trim().toUpperCase()) {
      return res.status(400).json({ message: 'Mã xác thực không đúng.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    const accessToken = generateToken(user._id.toString(), user.role || 'customer');
    const refreshToken = generateRefreshToken(user._id.toString());

    return res.json({
      message: 'Xác thực email thành công.',
      user: userObj,
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email.' });
    }

    const user = await User.findOne({ email });

    // Để tránh lộ thông tin, vẫn trả về message chung nếu không tìm thấy user
    if (!user) {
      return res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi mã xác thực.' });
    }

    const code = generateVerificationCode(8);
    user.passwordResetCode = code;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.username, code);
    } catch (e) {
      console.error('Send password reset email failed', e);
    }

    return res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi mã xác thực.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const resetPasswordWithCode = async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu mới và xác nhận không khớp.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này.' });
    }

    if (!user.passwordResetCode || !user.passwordResetExpires) {
      return res.status(400).json({ message: 'Không có mã đặt lại mật khẩu hợp lệ. Vui lòng yêu cầu lại.' });
    }

    const now = new Date();
    if (user.passwordResetExpires < now) {
      return res.status(400).json({ message: 'Mã đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.' });
    }

    if (user.passwordResetCode !== code.trim().toUpperCase()) {
      return res.status(400).json({ message: 'Mã xác thực không đúng.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    user.password = hashed;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export default { login, register, profile, adminOnly, refreshToken, verifyEmailCode, forgotPasswordRequest, resetPasswordWithCode };
