/**
 * Thin nodemailer wrapper used for 2FA OTP emails.
 * Reuses the same SMTP env vars as the previous NextAuth Email provider.
 */

import nodemailer from 'nodemailer';

// Module-level singleton: nodemailer manages connection pooling internally.
// Creating a new transport per call (the previous approach) re-established the
// TCP/TLS connection on every email and left idle connections open.
const transport = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  pool: true,      // keep connections alive between sends
  maxConnections: 2,
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@example.com',
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/** Send a 6-digit OTP code to the given email address. */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Your CNAM VMS sign-in code',
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a3a5c">CNAM Volunteer Management</h2>
        <p>Your sign-in verification code is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a3a5c;padding:16px 0">${code}</div>
        <p style="color:#666;font-size:13px">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#666;font-size:13px">If you did not request this code, please ignore this email.</p>
      </div>
    `,
  });
}

/** Send a password reset link to the given email address. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Reset your CNAM VMS password',
    text: `You have been sent a password reset link.\n\nClick the link below to set a new password (valid for 24 hours):\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a3a5c">CNAM Volunteer Management</h2>
        <p>A password reset has been requested for your account.</p>
        <p>Click the button below to set a new password. This link is valid for <strong>24 hours</strong>.</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${resetUrl}" style="display:inline-block;background:#1a3a5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </p>
        <p style="color:#666;font-size:13px">Or copy this link into your browser:</p>
        <p style="color:#666;font-size:12px;word-break:break-all">${resetUrl}</p>
        <p style="color:#666;font-size:13px">If you did not request a password reset, please ignore this email. Your password will not change.</p>
      </div>
    `,
  });
}
