/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    cfContext: ExecutionContext;
  }
}

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  EMAIL_PROVIDER?: 'resend' | 'atlas';
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ATLAS_MAILER_URL?: string;
  ATLAS_MAILER_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ENVIRONMENT?: 'development' | 'production' | 'test';
}

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
