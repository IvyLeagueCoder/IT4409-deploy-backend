import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

// Cấu hình lại Transporter để fix lỗi Timeout trên Render
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  // Ưu tiên dùng cổng 465 (secure) thay vì 587 khi deploy cloud
  port: Number(SMTP_PORT) === 465 ? 465 : 587,
  secure: Number(SMTP_PORT) === 465, // true cho 465, false cho các cổng khác
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  // Thêm cấu hình TLS để tránh bị chặn kết nối
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, // Tăng thời gian chờ lên 10s
});

export async function sendVerificationEmail(to, code) {
  // Giữ nguyên logic cũ nhưng kiểm tra thêm transporter
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[email] Missing SMTP config. Code:', code, 'to:', to);
    return;
  }

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: 'Mã xác thực tài khoản Tech-Geeks',
    text: `Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 15 phút.`,
  };

  console.log('[email] Verification code for', to, 'is:', code);

  try {
    await transporter.sendMail(mailOptions);
    console.log('[email] Email sent successfully to:', to);
  } catch (err) {
    console.error('Send verification email failed:', err.message);
  }
}

// Hàm sendPasswordResetEmail sửa tương tự phần transporter phía trên