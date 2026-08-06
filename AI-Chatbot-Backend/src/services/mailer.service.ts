import nodemailer from 'nodemailer';
import env from '../config/env';
import { log } from '../config/logger';

/**
 * Email service.
 * Uses SMTP when configured; otherwise falls back to logging the
 * email body to the console (development / no-SMTP environments).
 */
export class MailerService {
  private static transporter(): nodemailer.Transporter | null {
    if (!env.smtp.host) return null;
    return nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user
        ? { user: env.smtp.user, pass: env.smtp.pass }
        : undefined,
    });
  }

  static async send(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const transport = this.transporter();

    if (!transport) {
      log.info(`[EMAIL FALLBACK] To: ${options.to} | Subject: ${options.subject}`, {
        body: options.text.slice(0, 500),
      });
      return;
    }

    try {
      await transport.sendMail({
        from: env.smtp.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch (error) {
      log.error('Failed to send email', { message: (error as Error).message });
      log.info(`[EMAIL FALLBACK] To: ${options.to} | Subject: ${options.subject}`, {
        body: options.text.slice(0, 500),
      });
    }
  }
}

export default MailerService;
