import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  console.warn('[email] SMTP environment variables are not fully configured. Email sending will fail until configured.');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendVerificationEmail(to, code) {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn('[email] Missing SMTP config, skip sending email. Code:', code, 'to:', to);
    return;
  }

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: 'Mã xác thực tài khoản Tech-Geeks',
    text: `Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 15 phút.`,
  };

  // Log mã ra console để dễ test trong môi trường dev
  console.log('[email] Verification code for', to, 'is:', code);

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Send verification email failed', err);
    // Không throw lại, để luồng đăng ký vẫn tiếp tục và bạn có thể dùng mã log bên trên
  }
}

export async function sendPasswordResetEmail(to, username, code) {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn('[email] Missing SMTP config for password reset, skip sending email. Code:', code, 'to:', to);
    console.log('[email] Password reset code for', to, 'is:', code, 'username:', username);
    return;
  }

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: 'Yêu cầu đặt lại mật khẩu Tech-Geeks',
    text: `Xin chào ${username},\n\nMã xác thực đặt lại mật khẩu của bạn là: ${code}. Mã có hiệu lực trong 15 phút.`,
  };

  console.log('[email] Password reset code for', to, 'is:', code, 'username:', username);

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Send password reset email failed', err);
  }
}
