import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

const smtpPort = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;
if (env.SMTP_HOST && env.SMTP_USER) {
  try {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: smtpPort === 587 ? 2525 : smtpPort, // Fallback to 2525 if 587 is blocked by local ISPs
      secure: smtpPort === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } catch (error) {
    console.error("Failed to initialize Nodemailer transporter:", error.message);
  }
}

/**
 * Dispatch an email using Brevo REST API, Resend REST API, SMTP, or local dev fallback
 */
const sendMail = async ({ to, subject, html, text }) => {
  const recipient = Array.isArray(to) ? to[0] : to;

  // 1. Try Brevo REST API if Brevo key is configured
  const brevoApiKey = env.BREVO_API_KEY || (env.SMTP_PASS && env.SMTP_PASS.startsWith("xkeysib-") ? env.SMTP_PASS : null);
  if (brevoApiKey) {
    try {
      let senderEmail = "gloxad07@gmail.com";
      let senderName = "GLOXAD";
      if (env.SMTP_FROM) {
        const match = env.SMTP_FROM.match(/<([^>]+)>/);
        if (match) {
          senderEmail = match[1];
          senderName = env.SMTP_FROM.split("<")[0].trim().replace(/['"]/g, "") || "GLOXAD";
        } else if (env.SMTP_FROM.includes("@")) {
          senderEmail = env.SMTP_FROM.trim();
        }
      }

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: recipient }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`[BREVO EMAIL SENT] ID: ${data.messageId} | To: ${recipient}`);
        return { success: true, provider: "brevo", id: data.messageId };
      } else {
        console.warn(`[BREVO API NOTICE] ${data.message || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.warn(`[BREVO API ERROR] ${err.message}`);
    }
  }

  // 2. Try Resend HTTP API if RESEND_APIKEY is set
  if (env.RESEND_APIKEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_APIKEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.SMTP_FROM || "Gloxad Academy <onboarding@resend.dev>",
          to: [recipient],
          subject,
          html,
          text,
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[RESEND EMAIL SENT] ID: ${data.id} | To: ${recipient}`);
        return { success: true, provider: "resend", id: data.id };
      } else {
        console.warn(`[RESEND NOTICE] ${data.message || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.warn(`[RESEND ERROR] ${err.message}`);
    }
  }

  // 3. Try SMTP Relay if configured
  if (transporter) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM || "Gloxad Academy <no-reply@gloxad.com>",
        to: recipient,
        subject,
        text,
        html,
      });
      console.log(`[SMTP EMAIL SENT] To: ${recipient} | Subject: ${subject}`);
      return { success: true, provider: "smtp" };
    } catch (err) {
      console.warn(`[SMTP DISPATCH NOTICE] ${err.message}`);
    }
  }

  // 4. Guaranteed local dev fallback
  const logLine = `[DEV EMAIL DISPATCH] To: ${recipient} | Subject: ${subject}`;
  console.log(logLine);
  console.log(`[DEV EMAIL DISPATCH]\nTo: ${recipient}\nSubject: ${subject}\nBody:\n${text}`);
  try {
    const fs = await import("fs");
    fs.appendFileSync(".dev-emails.log", `${logLine}\n${text}\n---\n`);
  } catch (e) {}

  return { success: true, devMode: true };
};

export const sendEmailVerificationOtp = async (email, otp) => {
  const subject = "Gloxad Academy - Email Verification OTP";
  const text = `Your Gloxad Academy email verification code is: ${otp}. It will expire in 15 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <h2 style="color: #4F46E5; margin-top: 0;">Gloxad Academy</h2>
      <p style="font-size: 15px; color: #1E293B;">Hello,</p>
      <p style="font-size: 15px; color: #1E293B;">Your email verification code is:</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #4F46E5; padding: 12px 0; text-align: center; background: #F8FAFC; border-radius: 6px; margin: 16px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #64748B;">This code will expire in 15 minutes. If you did not create an account, please disregard this email.</p>
    </div>
  `;

  return await sendMail({ to: email, subject, text, html });
};

export const sendPasswordResetOtp = async (email, otp) => {
  const subject = "Gloxad Academy - Password Reset OTP";
  const text = `Your Gloxad Academy password reset code is: ${otp}. It will expire in 15 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <h2 style="color: #4F46E5; margin-top: 0;">Gloxad Academy</h2>
      <p style="font-size: 15px; color: #1E293B;">Hello,</p>
      <p style="font-size: 15px; color: #1E293B;">You requested a password reset. Your recovery code is:</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #4F46E5; padding: 12px 0; text-align: center; background: #F8FAFC; border-radius: 6px; margin: 16px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #64748B;">This code will expire in 15 minutes. If you did not request this change, your account remains secure.</p>
    </div>
  `;

  return await sendMail({ to: email, subject, text, html });
};

export const sendWelcomeEmail = async (email, name) => {
  const subject = "Welcome to Gloxad Academy! 🎓";
  const text = `Hello ${name || "there"},\n\nWelcome to Gloxad Academy! Your email has been verified and your account is active.\n\nHappy learning!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <h2 style="color: #4F46E5; margin-top: 0;">Welcome to Gloxad Academy! 🎓</h2>
      <p style="font-size: 15px; color: #1E293B;">Hello <strong>${name || "there"}</strong>,</p>
      <p style="font-size: 15px; color: #1E293B;">Your email has been verified and your account is ready to go.</p>
      <p style="font-size: 14px; color: #64748B;">You can now explore our course catalog, enroll in interactive classes, and start learning.</p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8;">
        The Gloxad Academy Team
      </div>
    </div>
  `;

  return await sendMail({ to: email, subject, text, html });
};

export default {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendWelcomeEmail,
};
