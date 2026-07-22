import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { sendEmail, checkEmailRateLimit, type EmailEnv } from './email';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const { mockSend } = vi.hoisted(() => {
  return {
    mockSend: vi.fn((payload) => {
      if (payload.from === 'error@example.com') {
        return { error: { message: 'Resend mock error' } };
      }
      return { data: { id: 'test_id' }, error: null };
    })
  };
});

vi.mock('resend', () => {
  return {
    Resend: class {
      emails = { send: mockSend };
    }
  };
});

const server = setupServer(
  http.post('https://test-mailer.workers.dev/send', () =>
    HttpResponse.json({ success: true }, { status: 200 })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('email.ts', () => {
  const payload = {
    to: 'test@example.com',
    subject: 'Test Subject',
    html: '<p>Test</p>',
  };

  describe('Resend provider', () => {
    it('calls resend.emails.send with correct from/to/subject/html', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'test-key',
      };
      
      await sendEmail(env, payload);
      
      expect(mockSend).toHaveBeenCalledWith({
        from: 'Meterly <onboarding@resend.dev>',
        ...payload,
      });
    });

    it('uses RESEND_FROM env value when set', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'test-key',
        RESEND_FROM: 'Meterly Custom <custom@example.com>',
      };
      
      await sendEmail(env, payload);
      
      expect(mockSend).toHaveBeenCalledWith({
        from: 'Meterly Custom <custom@example.com>',
        ...payload,
      });
    });

    it('falls back to onboarding@resend.dev when RESEND_FROM is absent', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'test-key',
      };
      
      await sendEmail(env, payload);
      
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'Meterly <onboarding@resend.dev>' })
      );
    });

    it('throws when RESEND_API_KEY is missing', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'resend',
      };
      
      await expect(sendEmail(env, payload)).rejects.toThrow('RESEND_API_KEY is not set');
    });

    it('throws with Resend error message when Resend returns { error }', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'test-key',
        RESEND_FROM: 'error@example.com',
      };
      
      await expect(sendEmail(env, payload)).rejects.toThrow('Failed to send email via Resend: Resend mock error');
    });
  });

  describe('Atlas provider', () => {
    const atlasEnv: EmailEnv = {
      EMAIL_PROVIDER: 'atlas',
      ATLAS_MAILER_URL: 'https://test-mailer.workers.dev',
      ATLAS_MAILER_SECRET: 'test-secret',
    };

    it('POSTs to ATLAS_MAILER_URL/send with Bearer auth header', async () => {
      let authHeader: string | null = null;
      server.use(
        http.post('https://test-mailer.workers.dev/send', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json({ success: true }, { status: 200 });
        })
      );

      await sendEmail(atlasEnv, payload);
      
      expect(authHeader).toBe('Bearer test-secret');
    });

    it('sends correct JSON body', async () => {
      let bodyReceived: unknown = null;
      server.use(
        http.post('https://test-mailer.workers.dev/send', async ({ request }) => {
          bodyReceived = await request.json();
          return HttpResponse.json({ success: true }, { status: 200 });
        })
      );

      await sendEmail(atlasEnv, payload);
      
      expect(bodyReceived).toEqual(payload);
    });

    it('throws ATLAS_QUOTA_EXHAUSTED when response is 429', async () => {
      server.use(
        http.post('https://test-mailer.workers.dev/send', () =>
          HttpResponse.json({ error: 'Daily limit exceeded' }, { status: 429 })
        )
      );
      
      await expect(sendEmail(atlasEnv, payload)).rejects.toThrow('ATLAS_QUOTA_EXHAUSTED');
    });

    it('throws when response is other non-200', async () => {
      server.use(
        http.post('https://test-mailer.workers.dev/send', () =>
          HttpResponse.json({ error: 'Internal Error' }, { status: 500 })
        )
      );
      
      await expect(sendEmail(atlasEnv, payload)).rejects.toThrow('Atlas Mailer');
    });

    it('throws when ATLAS_MAILER_URL is missing', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'atlas',
        ATLAS_MAILER_SECRET: 'secret',
      };
      
      await expect(sendEmail(env, payload)).rejects.toThrow('ATLAS_MAILER_URL or ATLAS_MAILER_SECRET is not set');
    });

    it('throws when ATLAS_MAILER_SECRET is missing', async () => {
      const env: EmailEnv = {
        EMAIL_PROVIDER: 'atlas',
        ATLAS_MAILER_URL: 'https://test',
      };
      
      await expect(sendEmail(env, payload)).rejects.toThrow('ATLAS_MAILER_URL or ATLAS_MAILER_SECRET is not set');
    });
  });

  describe('No provider', () => {
    it('throws in production with descriptive config error message', async () => {
      const env: EmailEnv = {
        ENVIRONMENT: 'production',
      };
      
      await expect(sendEmail(env, payload)).rejects.toThrow('No email provider configured. Set EMAIL_PROVIDER=resend or EMAIL_PROVIDER=atlas.');
    });

    it('silently resolves in development (no-op)', async () => {
      const env: EmailEnv = {
        ENVIRONMENT: 'development',
      };
      
      await expect(sendEmail(env, payload)).resolves.toBeUndefined();
    });
  });

  describe('checkEmailRateLimit', () => {
    it('returns true on first call for a userId', () => {
      const userId = `test-user-${Date.now()}`;
      expect(checkEmailRateLimit(userId)).toBe(true);
    });

    it('returns false within 60-second window', () => {
      const userId = `test-user-${Date.now()}`;
      checkEmailRateLimit(userId);
      expect(checkEmailRateLimit(userId)).toBe(false);
    });

    it('returns true again after 60-second window passes', () => {
      const userId = `test-user-${Date.now()}`;
      vi.useFakeTimers();
      
      checkEmailRateLimit(userId);
      expect(checkEmailRateLimit(userId)).toBe(false);
      
      vi.advanceTimersByTime(60001);
      
      expect(checkEmailRateLimit(userId)).toBe(true);
      
      vi.useRealTimers();
    });
  });
});
