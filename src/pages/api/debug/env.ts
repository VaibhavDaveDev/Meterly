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
    "ENVIRONMENT",
    "RESEND_API_KEY",
    "CF_TURNSTILE_SECRET",
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
    JSON.stringify({ source: "cloudflare:workers", env: report }, null, 2),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};
