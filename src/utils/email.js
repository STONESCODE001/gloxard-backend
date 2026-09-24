import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

if (env.SMTP_HOST && env.SMTP_USER) {
  try {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } catch (error) {
    console.error("Failed to initialize Nodemailer transporter:", error.message);
  }
}

export const sendEmailVerificationOtp = async (email, otp) => {
  const subject = "Gloxad Academy - Email Verification OTP";
  const message = `Your Gloxad Academy email verification code is: ${otp}. It will expire in 15 minutes.`;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject,
        text: message,
        html: `<p>Your Gloxad Academy email verification code is: <strong>${otp}</strong>.</p><p>It will expire in 15 minutes.</p>`,
      });
      return { success: true };
    } catch (err) {
      console.error("Failed to send verification email via SMTP:", err.message);
    }
  }

  // Fallback to dev console logging
  const logLine = `[DEV EMAIL DISPATCH] To: ${email} | Subject: ${subject} | OTP Code: ${otp}`;
  console.log(logLine);
  console.log(`[DEV EMAIL DISPATCH]\nTo: ${email}\nSubject: ${subject}\nOTP Code: ${otp} (Expires in 15 minutes)`);
  try {
    const fs = await import("fs");
    fs.appendFileSync(".dev-emails.log", `${logLine}\n`);
  } catch (e) {}
  return { success: true, devMode: true };
};

export const sendPasswordResetOtp = async (email, otp) => {
  const subject = "Gloxad Academy - Password Reset OTP";
  const message = `Your Gloxad Academy password reset code is: ${otp}. It will expire in 15 minutes.`;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject,
        text: message,
        html: `<p>Your Gloxad Academy password reset code is: <strong>${otp}</strong>.</p><p>It will expire in 15 minutes.</p>`,
      });
      return { success: true };
    } catch (err) {
      console.error("Failed to send password reset email via SMTP:", err.message);
    }
  }

  // Fallback to dev console logging
  const logLine = `[DEV EMAIL DISPATCH] To: ${email} | Subject: ${subject} | OTP Code: ${otp}`;
  console.log(logLine);
  console.log(`[DEV EMAIL DISPATCH]\nTo: ${email}\nSubject: ${subject}\nOTP Code: ${otp} (Expires in 15 minutes)`);
  try {
    const fs = await import("fs");
    fs.appendFileSync(".dev-emails.log", `${logLine}\n`);
  } catch (e) {}
  return { success: true, devMode: true };
};



export default {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
};
