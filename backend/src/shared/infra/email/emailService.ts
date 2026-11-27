import { Resend } from "resend";
import { logger } from "../logger/logger";
import { escapeHtml } from "../../domain/escapeHtml";

export type PasswordResetLinkLang = "it" | "en";

const PASSWORD_RESET_LINK_TEXT: Record<PasswordResetLinkLang, { subject: string; intro: string; button: string; ignore: string }> = {
  it: {
    subject: "Reimposta la password - Miniatures Contest",
    intro: "Hai chiesto di reimpostare la password. Apri il link qui sotto, valido per 60 minuti:",
    button: "Reimposta password",
    ignore: "Se non sei stato tu, ignora questa email: la password non cambia."
  },
  en: {
    subject: "Reset your password - Miniatures Contest",
    intro: "You asked to reset your password. Open the link below, valid for 60 minutes:",
    button: "Reset password",
    ignore: "If you did not ask for this, ignore this email: your password will not change."
  }
};

export class EmailService {
  /** Null when RESEND_API_KEY is not set: Resend throws on an empty key, so the client is built only when configured. */
  private resend: Resend | null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn("RESEND_API_KEY not set. Email sending will be disabled.");
    }
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
  }

  async sendPasswordReset(params: { to: string; temporaryPassword: string }): Promise<boolean> {
    if (!this.resend) {
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

  /** Self-service reset link (token in the URL, valid 60 minutes). Returns false, never throws, when not sent. */
  async sendPasswordResetLink(params: { to: string; link: string; lang?: PasswordResetLinkLang }): Promise<boolean> {
    if (!this.resend) {
      logger.warn("Password reset link not sent: RESEND_API_KEY is not set");
      return false;
    }
    const text = PASSWORD_RESET_LINK_TEXT[params.lang ?? "it"];
    const link = escapeHtml(params.link);
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: text.subject,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <p>${escapeHtml(text.intro)}</p>
            <p style="text-align: center;"><a href="${link}" style="display: inline-block; padding: 12px 20px; border-radius: 6px; background: #1f2937; color: #fff; text-decoration: none;">${escapeHtml(text.button)}</a></p>
            <p style="word-break: break-all; font-size: 0.85em;">${link}</p>
            <p style="color: #888; font-size: 0.85em;">${escapeHtml(text.ignore)}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #888; font-size: 0.85em;">Miniatures Contest</p>
          </div>
        `
      });
      logger.info("Password reset link email sent");
      return true;
    } catch (err) {
      logger.error({ err }, "Failed to send password reset link email");
      return false;
    }
  }

  // TODO: called by scheduler or admin endpoint, 7 days before enrollment close date
  async sendIncompleteRegistrationReminder(params: {
    to: string;
    userName: string;
    enrollmentCloseDate: string;
    frontendUrl: string;
  }): Promise<boolean> {
    if (!this.resend) {
      logger.warn({ to: params.to }, "Reminder email skipped (no API key)");
      return false;
    }
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: "Scheda di iscrizione incompleta / Incomplete registration — Miniatures Contest",
        html: `<!-- TODO: replace with proper bilingual HTML template -->
        <p><strong>IT:</strong> La tua scheda di iscrizione è incompleta: non hai ancora registrato modelli.</p>
        <p><strong>EN:</strong> Your registration form is incomplete: no models registered yet.</p>
        <p>Chiusura iscrizioni / Enrollment closes: ${params.enrollmentCloseDate}</p>
        <a href="${params.frontendUrl}/models">Completa iscrizione / Complete registration</a>`
      });
      logger.info({ to: params.to }, "Incomplete registration reminder sent");
      return true;
    } catch (err) {
      logger.error({ err, to: params.to }, "Failed to send incomplete registration reminder");
      return false;
    }
  }
}
