import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  port: 465, // Dùng cổng 465 để tránh timeout trên Render
  secure: true, 
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

// Đảm bảo CẢ HAI hàm này đều có từ khóa 'export' ở phía trước
export async function sendVerificationEmail(to, code) {
  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: 'Mã xác thực tài khoản Tech-Geeks',
    text: `Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 15 phút.`,
  };
  console.log('[email] Verification code for', to, 'is:', code);
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Send verification email failed:', err.message);
  }
}

export async function sendPasswordResetEmail(to, username, code) {
  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: 'Yêu cầu đặt lại mật khẩu Tech-Geeks',
    text: `Xin chào ${username}, mã xác thực đặt lại mật khẩu của bạn là: ${code}`,
  };
  console.log('[email] Password reset code for', to, 'is:', code);
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Send password reset email failed:', err.message);
  }
}