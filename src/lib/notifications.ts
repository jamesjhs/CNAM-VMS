import nodemailer from 'nodemailer';

export interface NotificationPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationService {
  send(payload: NotificationPayload): Promise<void>;
}

/**
 * Email notification service using Nodemailer.
 */
class EmailNotificationService implements NotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });
  }

  async send(payload: NotificationPayload): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@example.com',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  }
}

/**
 * Console (stub) notification service for development.
 */
class ConsoleNotificationService implements NotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    console.log('[Notification Stub]', {
      to: payload.to,
      subject: payload.subject,
    });
  }
}

export const notificationService: NotificationService =
  process.env.EMAIL_SERVER_HOST
    ? new EmailNotificationService()
    : new ConsoleNotificationService();

// --- Notification helpers ---

export async function notifyTaskAssigned(userEmail: string, taskTitle: string): Promise<void> {
  await notificationService.send({
    to: userEmail,
    subject: `[CNAM VMS] You have been assigned: ${taskTitle}`,
    html: emailTemplate(
      'Task Assigned',
      `<p>You have been assigned the task: <strong>${escapeHtml(taskTitle)}</strong>.</p>
       <p>Please log in to view your tasks.</p>`,
    ),
  });
}

export async function notifyTaskOverdue(userEmail: string, taskTitle: string): Promise<void> {
  await notificationService.send({
    to: userEmail,
    subject: `[CNAM VMS] Overdue task: ${taskTitle}`,
    html: emailTemplate(
      'Overdue Task',
      `<p>The following task is overdue: <strong>${escapeHtml(taskTitle)}</strong>.</p>
       <p>Please log in to update the task status.</p>`,
    ),
  });
}

export async function notifyAnnouncement(userEmail: string, title: string, body: string): Promise<void> {
  await notificationService.send({
    to: userEmail,
    subject: `[CNAM VMS] Announcement: ${title}`,
    html: emailTemplate(
      escapeHtml(title),
      `<p>${escapeHtml(body)}</p>`,
    ),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function emailTemplate(heading: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a3a5c; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .body { padding: 32px; color: #333; }
    .footer { background: #f4f6f9; padding: 16px 32px; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>City of Norwich Aviation Museum</h1>
      <p>Volunteer Management System</p>
    </div>
    <div class="body">
      <h2>${heading}</h2>
      ${content}
    </div>
    <div class="footer">
      This email was sent by the CNAM Volunteer Management System.<br>
      Please do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}
