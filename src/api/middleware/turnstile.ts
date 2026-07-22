import { Context, Next } from 'hono';
import type { Bindings, Variables } from '../app';

/**
 * Cloudflare Turnstile bot-protection middleware.
 *
 * LAYERED RATE LIMITING STRATEGY:
 * Layer 1 (this file): Turnstile blocks automated bots before auth logic runs.
 *                       Applied to: sign-up, sign-in, forgot-password forms.
 * Layer 2 (auth.ts):    Better Auth built-in rate limiter tracks per-IP using
 *                       CF-Connecting-IP. Custom rules tighten sensitive routes.
 *                       Applied to: all Better Auth endpoints globally.
 * Layer 3 (otp-limiter.ts): Per-email exponential backoff (5m, 15m, 30m, 60m).
 *                       Applied to: OTP send requests specifically.
 *
 * This stack means an attacker needs to: solve a Turnstile CAPTCHA (Layer 1),
 * stay under the per-IP auth request rate (Layer 2), and stay under the
 * per-email OTP backoff limit (Layer 3). No single layer is a silver bullet.
 *
 * Verifies the `cf-turnstile-response` token sent with the request body.
 * The verification is always server-side (Hono Worker → Cloudflare siteverify).
 * Never call the siteverify endpoint from the browser.
 *
 * Apply this middleware to: POST /api/auth/sign-up, sign-in, forgot-password.
 *
 * Auto-detection behavior:
 *   - Automatically skips verification in 'test' and 'development' environments
 *   - Set ENVIRONMENT=development in .dev.vars for local dev
 *   - Set ENVIRONMENT=production for production deployments
 *   - No need to manually configure test keys in dev/test - just set ENVIRONMENT
 *
 * Production requires:
 *   TURNSTILE_SECRET_KEY — from Cloudflare Turnstile dashboard (keep secret)
 */
export const turnstileMiddleware = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) => {
  const env = c.env.ENVIRONMENT || 'development';
  
  // Auto-detect: Skip Turnstile verification in test and development environments
  if (env === 'test' || env === 'development') {
    console.log(`[Turnstile] Skipping verification in ${env} mode`);
    return next();
  }

  const clonedReq = c.req.raw.clone();
  let body: Record<string, unknown>;
  try {
    body = await clonedReq.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Invalid request body' } },
      400
    );
  }

  const token = body['cf-turnstile-response'] || c.req.header('x-cf-turnstile-response');
  if (!token || typeof token !== 'string') {
    return c.json(
      { success: false, error: { code: 'TURNSTILE_MISSING', message: 'Bot protection check is required.' } },
      400
    );
  }

  const secretKey = c.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('[Turnstile] TURNSTILE_SECRET_KEY is not set in production!');
    return c.json(
      { success: false, error: { code: 'TURNSTILE_CONFIG_ERROR', message: 'Server misconfiguration. Contact support.' } },
      500
    );
  }

  let verifyResult: { success: boolean; 'error-codes'?: string[] };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        // Optionally bind the token to the user's IP for extra security
        remoteip: c.req.header('CF-Connecting-IP'),
      }),
    });
    verifyResult = await res.json() as { success: boolean; 'error-codes'?: string[] };
  } catch (err) {
    console.error('[Turnstile] siteverify request failed:', err);
    return c.json(
      { success: false, error: { code: 'TURNSTILE_ERROR', message: 'Bot check failed. Please try again.' } },
      500
    );
  }

  if (!verifyResult.success) {
    console.warn('[Turnstile] Token rejected. Error codes:', verifyResult['error-codes']);
    return c.json(
      { success: false, error: { code: 'TURNSTILE_FAILED', message: 'Bot check failed. Please refresh and try again.' } },
      400
    );
  }

  await next();
};
