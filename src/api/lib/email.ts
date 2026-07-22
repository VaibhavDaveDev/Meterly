import { Resend } from 'resend';
import type { Bindings } from '../app';

/**
 * EmailEnv — subset of Bindings required by the mailer.
 * Using Pick avoids the `as never` cast at call-sites in routes.
 */
export type EmailEnv = Pick<
  Bindings,
  | 'EMAIL_PROVIDER'
  | 'RESEND_API_KEY'
  | 'RESEND_FROM'
  | 'ATLAS_MAILER_URL'
  | 'ATLAS_MAILER_SECRET'
  | 'ENVIRONMENT'
>;

export type EmailPayload = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

// In-memory rate limit (v1 — one email per userId per 60 seconds)
const emailRateLimiter = new Map<string, number>();

export function checkEmailRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastSent = emailRateLimiter.get(userId) ?? 0;
  if (now - lastSent < 60_000) return false;
  emailRateLimiter.set(userId, now);
  return true;
}

export async function sendEmail(env: EmailEnv, payload: EmailPayload): Promise<void> {
  const provider = env.EMAIL_PROVIDER;

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY) {
      throw new Error('[Mailer] EMAIL_PROVIDER=resend but RESEND_API_KEY is not set.');
    }
    // RESEND_FROM must be set to a verified sender. In dev, developers can use
    // "onboarding@resend.dev" (only delivers to your own Resend account email).
    const from = env.RESEND_FROM ?? 'Meterly <onboarding@resend.dev>';
    const resend = new Resend(env.RESEND_API_KEY);
    const options = payload.html
      ? { from, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text }
      : { from, to: payload.to, subject: payload.subject, text: payload.text ?? '' };
    const { error } = await resend.emails.send(options);
    if (error) {
      console.error('[Mailer] Resend error:', error);
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
    return;
  }

  if (provider === 'atlas') {
    if (!env.ATLAS_MAILER_URL || !env.ATLAS_MAILER_SECRET) {
      throw new Error(
        '[Mailer] EMAIL_PROVIDER=atlas but ATLAS_MAILER_URL or ATLAS_MAILER_SECRET is not set.'
      );
    }
    const response = await fetch(`${env.ATLAS_MAILER_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ATLAS_MAILER_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    // 202 = queued (new async contract), 200 = legacy sync fallback
    if (response.status === 429) {
      console.error('[Mailer] Atlas Mailer daily quota exhausted (429).');
      throw new Error('ATLAS_QUOTA_EXHAUSTED');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[Mailer] Atlas Mailer error:', error);
      throw new Error('Failed to send email via Atlas Mailer.');
    }
    // 202 Accepted — email queued for async delivery. No messageId available yet.
    return;
  }

  // No EMAIL_PROVIDER set — must be caught before calling sendEmail in production
  if (env.ENVIRONMENT === 'production') {
    throw new Error(
      '[Mailer] No email provider configured. Set EMAIL_PROVIDER=resend or EMAIL_PROVIDER=atlas.'
    );
  }
  // Dev fallback — no-op, caller has already logged the OTP to terminal
}
