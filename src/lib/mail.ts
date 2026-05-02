/**
 * Thin nodemailer wrapper used for 2FA OTP emails.
 * Reuses the same SMTP env vars as the previous NextAuth Email provider.
 *
 * SMTP configuration priority (highest wins):
 *   1. Values stored in the system_settings table (editable via /admin/settings)
 *   2. Environment variables (EMAIL_SERVER_HOST, etc.)
 *
 * Supported env vars / system_settings keys:
 *   EMAIL_SERVER_HOST / smtp.host         – SMTP hostname (required to enable SMTP)
 *   EMAIL_SERVER_PORT / smtp.port         – SMTP port (default: 587)
 *   EMAIL_SERVER_USER / smtp.user         – SMTP username
 *   EMAIL_SERVER_PASSWORD / smtp.password – SMTP password
 *   EMAIL_FROM / smtp.from                – From address / display name
 *   EMAIL_SERVER_SECURE / smtp.secure     – "true" → implicit TLS/SSL on connect (port 465)
 *   EMAIL_SERVER_REQUIRE_TLS / smtp.requireTls – "true" → force STARTTLS upgrade (port 587/25)
 *   EMAIL_TLS_REJECT_UNAUTHORIZED / smtp.tlsRejectUnauthorized – "false" → accept self-signed certs
 *
 * When the effective host is not set the full email is written to stdout so
 * that secret links and OTP codes are accessible via `pm2 logs`.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { getDb } from '@/lib/db';

// ─── SMTP settings helpers ────────────────────────────────────────────────────

/** Read a single system setting from the database.  Returns null if not set. */
function getSystemSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** Return the effective SMTP configuration, merging DB settings over env vars. */
export function getSmtpConfig(): {
  host: string;
  port: string;
  user: string;
  password: string;
  from: string;
  secure: string;
  requireTls: string;
  tlsRejectUnauthorized: string;
} {
  return {
    host:                 getSystemSetting('smtp.host')                 ?? process.env.EMAIL_SERVER_HOST                ?? '',
    port:                 getSystemSetting('smtp.port')                 ?? process.env.EMAIL_SERVER_PORT                ?? '587',
    user:                 getSystemSetting('smtp.user')                 ?? process.env.EMAIL_SERVER_USER                ?? '',
    password:             getSystemSetting('smtp.password')             ?? process.env.EMAIL_SERVER_PASSWORD            ?? '',
    from:                 getSystemSetting('smtp.from')                 ?? process.env.EMAIL_FROM                       ?? '',
    secure:               getSystemSetting('smtp.secure')               ?? process.env.EMAIL_SERVER_SECURE              ?? 'false',
    requireTls:           getSystemSetting('smtp.requireTls')           ?? process.env.EMAIL_SERVER_REQUIRE_TLS         ?? 'false',
    tlsRejectUnauthorized: getSystemSetting('smtp.tlsRejectUnauthorized') ?? process.env.EMAIL_TLS_REJECT_UNAUTHORIZED  ?? 'true',
  };
}

// ─── Nodemailer transport ─────────────────────────────────────────────────────

// Lazily-created singleton transport.  We rebuild it whenever any of the
// SMTP-related settings change (detected via a cached config key).
let _transport: Transporter | null = null;
let _transportKey: string | undefined;

function smtpConfigKey(): string {
  const cfg = getSmtpConfig();
  return [cfg.host, cfg.port, cfg.user, cfg.password, cfg.secure, cfg.requireTls, cfg.tlsRejectUnauthorized].join('|');
}

function getTransport(): Transporter {
  const key = smtpConfigKey();
  if (_transport && _transportKey === key) return _transport;

  _transportKey = key;
  const cfg = getSmtpConfig();
  _transport = nodemailer.createTransport({
    host: cfg.host || undefined,
    port: Number(cfg.port || 587),
    secure: cfg.secure === 'true',
    requireTLS: cfg.requireTls === 'true',
    tls: {
      rejectUnauthorized: cfg.tlsRejectUnauthorized !== 'false',
    },
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    pool: true,      // keep connections alive between sends
    maxConnections: 2,
  });
  return _transport;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  // Read effective config at call time so that settings changes take effect
  // without a full process restart.
  const cfg = getSmtpConfig();

  if (!cfg.host) {
    // SMTP is not configured — dump the full email to stdout so it is
    // visible in PM2 logs.  This is intentional for development / initial
    // setup and must never be used in a production environment with real
    // user data.
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[mail] WARNING: SMTP host is not configured in a production environment. ' +
        'Email content is being written to stdout in plain text. ' +
        'Configure SMTP via /admin/settings or the EMAIL_SERVER_HOST env var to send emails securely.',
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
    return { success: true }; // In dev/test mode, consider it successful
  }

  console.log(`[mail] Sending "${opts.subject}" to ${opts.to} via SMTP (${cfg.host})`);
  try {
    await getTransport().sendMail({
      from: cfg.from || 'noreply@example.com',
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[mail] Failed to send email to ${opts.to}: ${error}`);
    return { success: false, error };
  }
}

/** Send a 6-digit OTP code to the given email address. */
export async function sendOtpEmail(to: string, code: string): Promise<{ success: boolean; error?: string }> {
  return sendMail({
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
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ success: boolean; error?: string }> {
  return sendMail({
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
