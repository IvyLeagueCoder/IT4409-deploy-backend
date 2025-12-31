import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  console.warn(
    "[email] SMTP environment variables are not fully configured. Email sending will fail until configured."
  );
}

const port = Number(SMTP_PORT) || 587;
const isSecure = port === 465;

// Kiểm tra nếu là Gmail thì dùng service
const isGmail = SMTP_HOST?.includes("gmail");

const transporterConfig = isGmail
  ? {
      service: "gmail",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    }
  : {
      host: SMTP_HOST,
      port: port,
      secure: isSecure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false,
      },
    };

const transporter = nodemailer.createTransport(transporterConfig);

export async function sendVerificationEmail(to, code) {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn(
      "[email] Missing SMTP config, skip sending email. Code:",
      code,
      "to:",
      to
    );
    return;
  }

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: "Mã xác thực tài khoản Tech-Geeks",
    text: `Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 15 phút.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Xác thực tài khoản Tech-Geeks</h2>
        <p>Mã xác thực của bạn là:</p>
        <h1 style="color: #4CAF50; letter-spacing: 5px;">${code}</h1>
        <p>Mã có hiệu lực trong 15 phút.</p>
        <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
      </div>
    `,
  };

  // Log mã ra console để dễ test trong môi trường dev
  console.log("[email] Verification code for", to, "is:", code);

  // Retry logic với tối đa 3 lần
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log("[email] Verification email sent successfully to", to);
      return;
    } catch (err) {
      console.error(
        `[email] Send verification email failed (attempt ${attempt}/${maxRetries})`,
        err.message
      );
      if (attempt < maxRetries) {
        // Đợi trước khi retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  console.error("[email] All retry attempts failed for", to);
}

export async function sendPasswordResetEmail(to, username, code) {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn(
      "[email] Missing SMTP config for password reset, skip sending email. Code:",
      code,
"to:",
      to
    );
    console.log(
      "[email] Password reset code for",
      to,
      "is:",
      code,
      "username:",
      username
    );
    return;
  }

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: "Yêu cầu đặt lại mật khẩu Tech-Geeks",
    text: `Xin chào ${username},\n\nMã xác thực đặt lại mật khẩu của bạn là: ${code}. Mã có hiệu lực trong 15 phút.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Yêu cầu đặt lại mật khẩu Tech-Geeks</h2>
        <p>Xin chào <strong>${username}</strong>,</p>
        <p>Mã xác thực đặt lại mật khẩu của bạn là:</p>
        <h1 style="color: #2196F3; letter-spacing: 5px;">${code}</h1>
        <p>Mã có hiệu lực trong 15 phút.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  };

  console.log(
    "[email] Password reset code for",
    to,
    "is:",
    code,
    "username:",
    username
  );

  // Retry logic với tối đa 3 lần
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log("[email] Password reset email sent successfully to", to);
      return;
    } catch (err) {
      console.error(
        `[email] Send password reset email failed (attempt ${attempt}/${maxRetries})`,
        err.message
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  console.error("[email] All retry attempts failed for password reset to", to);
}