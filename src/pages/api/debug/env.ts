import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// Temporary debug endpoint — REMOVE before final production release.
// Accessible at: /api/debug/env
// Returns which env var keys are present (never their values).
export const GET: APIRoute = async () => {
  const cfEnv = env as Record<string, unknown>;

  const keys = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "DB",
    "BILL_PHOTOS",
    "ENVIRONMENT",
    "RESEND_API_KEY",
    "EMAIL_PROVIDER",
    "ATLAS_MAILER_URL",
    "ATLAS_MAILER_SECRET",
    // The code reads TURNSTILE_SECRET_KEY — confirm this name matches the Dashboard
    "TURNSTILE_SECRET_KEY",
    // Also check the name you set in the Dashboard
    "CF_TURNSTILE_SECRET",
    "MAX_SESSIONS_PER_USER",
    "CRON_SECRET",
  ];

  const report: Record<string, string> = {};
  for (const key of keys) {
    const val = cfEnv[key];
    if (val === undefined || val === null) {
      report[key] = "MISSING";
    } else if (typeof val === "string" && val.trim() === "") {
      report[key] = "EMPTY_STRING";
    } else if (typeof val === "object") {
      report[key] = `PRESENT (object: ${Object.prototype.toString.call(val)})`;
    } else {
      report[key] = "PRESENT";
    }
  }

  return new Response(
    JSON.stringify(
      {
        source: "cloudflare:workers",
        note: "TURNSTILE_SECRET_KEY is what the code reads. CF_TURNSTILE_SECRET is what you set in the Dashboard. They must match.",
        env: report,
      },
      null,
      2
    ),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};
