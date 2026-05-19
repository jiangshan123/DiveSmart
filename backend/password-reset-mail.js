const nodemailer = require("nodemailer");

/**
 * Sends password reset email when SMTP is configured; otherwise logs the URL (dev fallback).
 * Env: SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"|"false"), SMTP_USER, SMTP_PASS, EMAIL_FROM
 */
async function sendPasswordResetEmail(to, resetUrl) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
  } = process.env;

  const from = EMAIL_FROM || SMTP_USER || "noreply@smartdive.local";

  if (!SMTP_HOST) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Password reset] SMTP_HOST not set; reset URL (configure SMTP for production):",
        resetUrl,
      );
    } else {
      console.warn(
        "[Password reset] SMTP_HOST not set; email was not sent.",
      );
    }
    return { sent: false, reason: "no_smtp" };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: SMTP_SECURE === "true",
    auth:
      SMTP_USER && SMTP_PASS
        ? { user: SMTP_USER, pass: SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your SmartDive password",
    text: `You requested a password reset. Open this link to choose a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour).</p><p>If you did not request this, you can ignore this email.</p>`,
  });

  return { sent: true };
}

module.exports = { sendPasswordResetEmail };
