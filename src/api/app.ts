import { type Context } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { instrument } from '@microlabs/otel-cf-workers';
import { resolveOtelConfig } from './lib/otel-config';
import { logger } from './lib/logger';
import { getAuth } from './lib/auth';
import { turnstileMiddleware } from './middleware/turnstile';
import { propertiesRouter } from './routes/properties';
import { tenanciesRouter } from './routes/tenancies';
import { tenancyActionsRouter } from './routes/tenancy-actions';
import { invitesRouter } from './routes/invites';
import { ratesRouter } from './routes/rates';
import { chargesRouter } from './routes/custom-charges';
import { periodsRouter } from './routes/billing-periods';
import { readingsRouter } from './routes/meter-readings';
import { billsRouter } from './routes/bills';
import { requestsRouter } from './routes/edit-requests';
import { notificationsRouter } from './routes/notifications';
import { exportRouter } from './routes/export';
import { dashboardRouter } from './routes/dashboard';
import usersRouter from './routes/users';
import { cronRouter } from './routes/cron';
import { uploadsRouter } from './routes/uploads';
import { enforceSessionLimit } from './lib/session-limit';
import { getDb } from '../db';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { checkAndIncrementOtpRateLimit, resetOtpRateLimit } from './lib/otp-limiter';
import { checkAndIncrementPasswordChangeLimit } from './lib/password-change-limiter';
import { sendEmail } from './lib/email';
import { passwordChangedTemplate } from './lib/email-templates';
import { swaggerUI } from '@hono/swagger-ui';


export type Bindings = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // Email provider — 'resend' (recommended) or 'atlas' (no domain required)
  EMAIL_PROVIDER?: 'resend' | 'atlas';
  // Resend: https://resend.com — requires a verified sending domain in production
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;   // e.g. "Meterly <noreply@yourdomain.com>"
  // Atlas Mailer: fallback SMTP proxy — only needed when EMAIL_PROVIDER=atlas
  ATLAS_MAILER_URL?: string;
  ATLAS_MAILER_SECRET?: string;
  // Cloudflare Turnstile — bot protection on auth routes
  TURNSTILE_SECRET_KEY?: string;
  // Runtime environment flag — used by middleware to skip checks in tests
  ENVIRONMENT?: 'development' | 'production' | 'test';
  MAX_SESSIONS_PER_USER?: string;
  CRON_SECRET?: string;
  OBSERVABILITY_ENABLED?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  GRAFANA_CLOUD_INSTANCE_ID?: string;
  GRAFANA_CLOUD_API_KEY?: string;
  LOG_LEVEL?: string;
  BILL_PHOTOS?: R2Bucket;
  MAX_UPLOADS_PER_DAY?: string;
  MAX_READINGS_PER_DAY?: string;
};

export type Variables = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any; // Better Auth user type — replace with proper type once client is configured
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
};

export const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Polyfill executionCtx for local Vite/Node development to prevent 500 errors
app.use('*', async (c, next) => {
  let hasCtx: boolean;
  try {
    hasCtx = !!c.executionCtx;
  } catch {
    hasCtx = false;
  }
  
  if (!hasCtx) {
    Object.defineProperty(c, 'executionCtx', {
      value: { waitUntil: (p: Promise<unknown>) => p.catch(console.error) },
      configurable: true
    });
  }
  await next();
});

// ponytail: KV-based rate limiting deferred to v1.1. Better Auth built-in is enough for v1 auth routes.

// CORS middleware for local dev (allows credentials)
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost on any port for dev
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    // In production, allow your actual domain
    return 'https://meterly.app';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Auth routes — Turnstile bot protection is applied to sign-up, sign-in, and forgot-password
// The Turnstile token (`cf-turnstile-response`) must be included in the request body.
app.post('/api/auth/sign-up/email', turnstileMiddleware, async (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});
app.post('/api/auth/sign-in/email', turnstileMiddleware, async (c) => {
  const auth = getAuth(c.env);
  const response = await auth.handler(c.req.raw);
  
  if (response.status === 200) {
    const cloned = response.clone();
    try {
      const data = (await cloned.json()) as { user?: { id?: string } };
      if (data && data.user && data.user.id) {
        const db = getDb(c.env.DB);
        const maxSessions = c.env.MAX_SESSIONS_PER_USER ? parseInt(c.env.MAX_SESSIONS_PER_USER, 10) : 3;
        c.executionCtx.waitUntil(enforceSessionLimit(db, data.user.id, maxSessions));
        logger.info({ userId: data.user.id, event: 'user.sign_in' }, 'user signed in');
      }
    } catch { /* ignore */ }
  }
  return response;
});
app.post('/api/auth/forget-password', turnstileMiddleware, async (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Intercept Better Auth OTP sending route to check if user exists and enforce backoff rate limit
app.post('/api/auth/email-otp/send-verification-otp', turnstileMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  let body: { email?: string; type?: string };
  try {
    const cloned = c.req.raw.clone();
    body = (await cloned.json()) as { email?: string; type?: string };
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_BODY', message: 'Invalid request body' } }, 400);
  }

  const email = body.email;
  const type = body.type;

  if (!email || !type) {
    return c.json({ success: false, error: { message: 'Email and type are required' } }, 400);
  }

  // 1. If forgot password, check if the user is registered in the database
  if (type === 'forget-password') {
    const userExists = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email.toLowerCase().trim()))
      .get();

    if (!userExists) {
      // Security: fake success response, DO NOT contact Better Auth, DO NOT send email
      return c.json({ success: true });
    }
  }

  // 2. Perform exponential backoff rate limiting per email
  const rateLimitResult = await checkAndIncrementOtpRateLimit(db, email);
  if (!rateLimitResult.allowed) {
    const waitMins = Math.ceil(rateLimitResult.waitTimeMs / 60000);
    return c.json({
      message: `Please wait ${waitMins} minute${waitMins > 1 ? 's' : ''} before requesting another code.`,
      error: `Please wait ${waitMins} minute${waitMins > 1 ? 's' : ''} before requesting another code.`,
      code: 'TOO_MANY_REQUESTS',
    }, 429);
  }

  // 3. Delegate to Better Auth handler
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Intercept Better Auth OTP check/verification route to reset attempts on success
app.post('/api/auth/email-otp/check-verification-otp', async (c) => {
  const auth = getAuth(c.env);
  const response = await auth.handler(c.req.raw);
  
  if (response.status === 200) {
    try {
      const cloned = c.req.raw.clone();
      const body = (await cloned.json()) as { email?: string };
      const email = body.email;
      if (email) {
        const db = getDb(c.env.DB);
        await resetOtpRateLimit(db, email);
      }
    } catch (err) {
      console.error('[Auth] Failed to reset OTP rate limit after verification:', err);
    }
  }
  
  return response;
});

// Intercept Better Auth change-password route to send a confirmation email on success
app.post('/api/auth/change-password', async (c) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Rate limit: max 3 password changes per user per 24 hours
  const db = getDb(c.env.DB);
  const { allowed, remainingSeconds } = await checkAndIncrementPasswordChangeLimit(db, session.user.id);
  if (!allowed) {
    const remainingHours = Math.ceil(remainingSeconds / 3600);
    return c.json(
      { error: `Password change limit reached. Try again in ${remainingHours} hour${remainingHours > 1 ? 's' : ''}.` },
      429
    );
  }

  const response = await auth.handler(c.req.raw);

  if (response.status === 200) {
    c.executionCtx.waitUntil((async () => {
      try {
        const user = session.user;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        });

        const template = passwordChangedTemplate(dateStr, timeStr);

        await sendEmail(c.env, {
          to: user.email,
          subject: template.subject,
          html: template.html,
        });
        logger.info({ userId: user.id, event: 'user.password_changed' }, 'password change email sent');
      } catch (err) {
        console.error('[Auth] Failed to send password changed email:', err);
      }
    })());
  }

  return response;
});

// All other auth routes (session, callback, verify-email, etc.) without Turnstile
app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Middleware for auth context (optional but useful)
app.use("*", async (c, next) => {
  // Get session to attach user to context if needed for routes
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session) {
    c.set('user', session.user);
    c.set('session', session.session);
  }
  await next();
});

import { sql } from 'drizzle-orm';

// Health checks (Liveness and Readiness)
// Liveness Check (shallow): verifies the Hono API is running. Does not query the database.
const livenessHandler = (c: Context<{ Bindings: Bindings }>) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
};

app.get('/api/healthz', livenessHandler);
app.get('/api/ping', livenessHandler);

// Readiness Check (deep): verifies connection to critical dependencies (D1 database).
const readinessHandler = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const db = getDb(c.env.DB);
    // Simple query to verify DB is reachable and responding
    await db.run(sql`SELECT 1`);
    
    return c.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Readiness check failed:', err);
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
};

app.get('/api/readyz', readinessHandler);
app.get('/api/status', readinessHandler);
app.get('/api/health', readinessHandler); // backward compatibility

// OpenAPI security schemes
app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'better-auth.session_token',
});
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'Used only for the cron endpoint (CRON_SECRET)',
});

// Restrict API docs to non-production environments
app.use('/api/docs/*', async (c, next) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.notFound();
  }
  await next();
});

// OpenAPI spec endpoint
app.doc('/api/docs/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Meterly API',
    version: '1.0.0',
    description: 'Transparent utility billing platform API. All endpoints require an active session cookie except where noted.',
  },
  servers: [
    { url: 'https://meterly.pages.dev', description: 'Production' },
    { url: 'http://localhost:4321', description: 'Local development' },
  ],
});

// Swagger UI
app.get('/api/docs', swaggerUI({ url: '/api/docs/openapi.json' }));

// API routes
app.route('/api/properties', propertiesRouter);
app.route('/api/properties', tenanciesRouter);
app.route('/api/properties', ratesRouter);
app.route('/api/properties', chargesRouter);
app.route('/api/properties', periodsRouter);
app.route('/api/periods', readingsRouter);
app.route('/api/bills', billsRouter);
app.route('/api/edit-requests', requestsRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/tenancies', tenancyActionsRouter);
app.route('/api/invites', invitesRouter);
app.route('/api/export', exportRouter);
app.route('/api/users', usersRouter);
app.route('/api/cron', cronRouter);
app.route('/api/uploads', uploadsRouter);

const handler = {
  fetch: app.fetch.bind(app),
};

export default {
  fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    if (env.OBSERVABILITY_ENABLED !== 'true') {
      return app.fetch(req, env, ctx);
    }
    const instrumented = instrument(handler, resolveOtelConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return instrumented.fetch!(req as any, env, ctx);
  },
};
