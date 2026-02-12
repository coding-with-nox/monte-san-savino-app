import { Resend } from "resend";
import { logger } from "../logger/logger";

export class EmailService {
  private resend: Resend;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn("RESEND_API_KEY not set. Email sending will be disabled.");
    }
    this.resend = new Resend(apiKey || "");
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
  }

  async sendPasswordReset(params: { to: string; temporaryPassword: string }): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) {
      logger.warn({ to: params.to }, "Email sending skipped (no API key)");
      return false;
    }
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: "Password Reset - Miniatures Contest",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Password Reset</h2>
            <p>Your password has been reset by an administrator.</p>
            <p>Your new temporary password is:</p>
            <p style="font-size: 1.25em; font-weight: bold; background: #f5f5f5; padding: 12px; border-radius: 6px; text-align: center;">
              ${params.temporaryPassword}
            </p>
            <p>Please log in and change your password as soon as possible.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #888; font-size: 0.85em;">Miniatures Contest</p>
          </div>
        `
      });
      logger.info({ to: params.to }, "Password reset email sent");
      return true;
    } catch (err) {
      logger.error({ err, to: params.to }, "Failed to send password reset email");
      return false;
    }
  }
}
