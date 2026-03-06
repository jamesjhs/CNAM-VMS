/**
 * Thin nodemailer wrapper used for 2FA OTP emails.
 * Reuses the same SMTP env vars as the previous NextAuth Email provider.
 */

import nodemailer from 'nodemailer';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
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
