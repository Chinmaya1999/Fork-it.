import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from './logger.js';

export const mailConfigured = () => !!process.env.SMTP_URL;
let transport: Transporter | undefined;

/** Sends via SMTP_URL (e.g. smtps://user:pass@smtp.provider.com). Without it (dev), the email is logged to the API console instead. */
export async function sendMail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_URL) {
    logger.info({ to, subject }, 'email not sent: SMTP_URL not configured (dev adapter)');
    if (process.env.NODE_ENV === 'development') console.log(`\n[mail:dev] to=${to}\n${subject}\n${text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  try { await transport.sendMail({ from: process.env.MAIL_FROM ?? 'ProjectForge <no-reply@projectforge.local>', to, subject, text }); }
  catch (err) { logger.error({ err, to, subject }, 'email delivery failed'); } // never fail the request because mail is down
}
