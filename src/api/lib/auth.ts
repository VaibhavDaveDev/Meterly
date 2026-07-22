import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";

import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { sendEmail } from "./email";
import { emailVerificationTemplate, passwordResetTemplate } from "./email-templates";

export function getAuth(env: {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  EMAIL_PROVIDER?: 'resend' | 'atlas';
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ATLAS_MAILER_URL?: string;
  ATLAS_MAILER_SECRET?: string;
  ENVIRONMENT?: 'development' | 'production' | 'test';
  AUTH_RATE_LIMIT_MAX?: string;
  AUTH_RATE_LIMIT_WINDOW?: string;
}) {
  const db = getDb(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // Tell Better Auth how to read the real client IP on Cloudflare Workers.
    // CF-Connecting-IP is set by Cloudflare and cannot be spoofed by the client.
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['CF-Connecting-IP', 'X-Forwarded-For'],
        disableIpCheck: false,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,      // 7 days
      updateAge: 60 * 60 * 24,           // Roll the cookie if older than 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,                   // Cache session lookup for 5 minutes per request
      },
    },

    // Email + password is the primary auth method
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true, // Must verify email before first login
      minPasswordLength: 8,
    },

    plugins: [
      // OTP plugin handles:
      //   - Email verification OTP after sign-up
      //   - Forgot-password OTP reset flow
      emailOTP({
        sendVerificationOnSignUp: true, // Auto-send OTP after signup
        sendVerificationOTP: async ({ email, otp, type }) => {
          const isReset = type === "forget-password";
          const isVerify = type === "email-verification";

          let subject: string;
          let html: string;

          if (isReset) {
            const template = passwordResetTemplate(otp);
            subject = template.subject;
            html = template.html;
          } else if (isVerify) {
            const template = emailVerificationTemplate(otp);
            subject = template.subject;
            html = template.html;
          } else {
            // Fallback for any other OTP type
            subject = "Your Meterly verification code";
            html = `<p>Your code: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`;
          }

          // Always log OTP in dev
          if (env.ENVIRONMENT !== 'production') {
            console.log(
              `\n┌────────────────────────────────────────────────────┐\n│ [DEV] OTP — ${type.toUpperCase().replace('-', ' ')}` +
              `\n│ Email: ${email}\n│ Code:  ${otp}\n│ (This is only visible in dev — not in production)\n└────────────────────────────────────────────────────┘\n`
            );
          }

          // Check whether any email provider is configured
          const hasResend = env.EMAIL_PROVIDER === 'resend' && !!env.RESEND_API_KEY;
          const hasAtlas =
            env.EMAIL_PROVIDER === 'atlas' &&
            !!env.ATLAS_MAILER_URL &&
            !env.ATLAS_MAILER_URL.includes('your-atlas');
          
          if (!hasResend && !hasAtlas) {
            // No provider — terminal-only mode
            console.log('[DEV] No email provider configured. Using terminal OTP above.');
            return;
          }
          
          const emailPayload = { subject, html };
          
          // In dev with Resend: redirect to test address — real SDK call, no real delivery
          if (env.ENVIRONMENT !== 'production' && hasResend) {
            console.log(`[DEV] Resend test mode — email for ${email} redirected to delivered@resend.dev`);
            console.log('[DEV] Check https://resend.com/emails to verify the email template.');
            try {
              await sendEmail(env, { ...emailPayload, to: 'delivered@resend.dev' });
            } catch (err) {
              console.error('[DEV] Resend test send failed:', err);
              // Don't block dev — OTP is in the terminal
            }
            return;
          }
          
          // Production or Atlas fallback: send for real
          try {
            await sendEmail(env, { to: email, ...emailPayload });
          } catch (err) {
            const isQuotaError = err instanceof Error && err.message === 'ATLAS_QUOTA_EXHAUSTED';
            if (isQuotaError) {
              console.error('[Auth] Atlas Mailer daily quota exhausted — cannot send OTP.');
              throw new Error(
                'Email sending is temporarily unavailable. Please try again tomorrow or contact support.',
                { cause: err }
              );
            }
            console.error('[Auth] Failed to send OTP email:', err);
            if (env.ENVIRONMENT === 'production') throw err;
          }
        },
        otpLength: 6,
        expiresIn: 600, // 10 minutes in seconds
      }),
    ],

    // Global Rate Limiting — Better Auth tracks per-IP using CF-Connecting-IP
    rateLimit: {
      // Global baseline: 20 requests per 60 seconds per IP across all auth routes.
      // Tighter custom rules applied to sensitive endpoints below.
      window: env.AUTH_RATE_LIMIT_WINDOW ? parseInt(env.AUTH_RATE_LIMIT_WINDOW, 10) : 60,
      max: env.ENVIRONMENT !== 'production' 
        ? 1000 // Lenient in dev/test so tests don't hit limits
        : (env.AUTH_RATE_LIMIT_MAX ? parseInt(env.AUTH_RATE_LIMIT_MAX, 10) : 20),
      // Custom rules for endpoints that should have tighter limits:
      customRules: env.ENVIRONMENT === 'production' ? {
        // Sign-in: 5 attempts per 10 minutes per IP — OTP limiter is the primary defense,
        // this is a backstop for credential stuffing
        '/sign-in/email': { window: 600, max: 5 },
        // Forget-password: 3 attempts per 10 minutes per IP
        '/forget-password': { window: 600, max: 3 },
        // OTP sending: 5 per 10 minutes (our custom OTP limiter also enforces backoff)
        '/email-otp/send-verification-otp': { window: 600, max: 5 },
      } : undefined,
    },

    // Google and GitHub OAuth as alternative login methods
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID || "",
        clientSecret: env.GITHUB_CLIENT_SECRET || "",
      },
    },

    // Lifecycle hooks - disabled for now due to Better Auth v1.6.19 issues with response object
    // TODO: Re-enable after Better Auth fixes response.headers access in hooks
    // hooks: {
    //   after: async (ctx: any) => {
    //     if (!ctx.response) return;
    //     // Avatar and email logic here
    //   },
    // },
  });
}
