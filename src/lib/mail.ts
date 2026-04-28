/**
 * Thin nodemailer wrapper used for 2FA OTP emails.
 * Reuses the same SMTP env vars as the previous NextAuth Email provider.
 *
 * When EMAIL_SERVER_HOST is not set (e.g. during initial setup before SMTP is
 * configured), the full email content is written to stdout instead so that
 * secret links and OTP codes are accessible via `pm2 logs`.
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

const smtpConfigured = Boolean(process.env.EMAIL_SERVER_HOST);

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!smtpConfigured) {
    // SMTP is not configured — dump the full email to stdout so it is
    // visible in PM2 logs.  This is intentional for development / initial
    // setup and must never be used in a production environment with real
    // user data.
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[mail] WARNING: EMAIL_SERVER_HOST is not set in a production environment. ' +
        'Email content is being written to stdout in plain text. ' +
        'Configure SMTP to send emails securely.',
      );
    }
    console.log(
      [
        '',
        '╔══════════════════════════════════════════════════════════╗',
        '║  [mail] SMTP not configured — email logged to console   ║',
        '╚══════════════════════════════════════════════════════════╝',
        `  To:      ${opts.to}`,
        `  Subject: ${opts.subject}`,
        '',
        opts.text,
        '══════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    );
    return;
  }

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
