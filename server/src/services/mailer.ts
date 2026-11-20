import nodemailer from 'nodemailer';
import {
  BUG_REPORT_TO,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_USER,
} from '../config.js';

export type BugReportUpload = {
  description: string;
  contactEmail: string;
  pageUrl: string;
  userAgent: string;
  screenshot: { buffer: Buffer; filename: string; mimetype: string } | null;
};

export function isSmtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export async function sendBugReportEmail(report: BugReportUpload): Promise<void> {
  const preview = report.description.slice(0, 80).replace(/\s+/g, ' ');
  const subject = `[Fitpix] Проблема: ${preview}${report.description.length > 80 ? '…' : ''}`;
  const text = [
    'Новое сообщение о проблеме с Fitpix',
    '',
    `Страница: ${report.pageUrl || '—'}`,
    `Контакт: ${report.contactEmail || 'не указан'}`,
    `User-Agent: ${report.userAgent || '—'}`,
    `Скриншот: ${report.screenshot ? report.screenshot.filename : 'нет'}`,
    '',
    'Описание:',
    report.description,
  ].join('\n');

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: BUG_REPORT_TO,
    replyTo: report.contactEmail || undefined,
    subject,
    text,
    attachments: report.screenshot
      ? [
          {
            filename: report.screenshot.filename,
            content: report.screenshot.buffer,
            contentType: report.screenshot.mimetype,
          },
        ]
      : undefined,
  });
}
