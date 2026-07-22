/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { sendEmail } from '../lib/email';
import { checkAndIncrementPasswordChangeLimit } from '../lib/password-change-limiter';

const mockGetSession = vi.fn();
const mockAuthHandler = vi.fn();

vi.mock('../lib/auth', () => ({
  getAuth: () => ({
    api: {
      getSession: mockGetSession,
    },
    handler: mockAuthHandler,
  }),
}));

vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('../lib/password-change-limiter', () => ({
  checkAndIncrementPasswordChangeLimit: vi.fn(),
}));

describe('Change Password Route Interception', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (checkAndIncrementPasswordChangeLimit as any).mockResolvedValue({ allowed: true, remainingSeconds: 0 });
  });

  it('should return 401 if user is not logged in', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    }, {
      ENVIRONMENT: 'test',
    } as any);

    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
    expect(mockAuthHandler).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should delegate to Better Auth handler and send email on 200 success', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    };
    mockGetSession.mockResolvedValueOnce({
      user: mockUser,
      session: { id: 'session-id' },
    });
    mockAuthHandler.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const res = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    }, {
      ENVIRONMENT: 'test',
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);

    expect(mockAuthHandler).toHaveBeenCalled();
    // Wait for the async waitUntil execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sendEmail).toHaveBeenCalled();
    const sendEmailCallArgs = (sendEmail as any).mock.calls[0][1];
    expect(sendEmailCallArgs.to).toBe('test@example.com');
    expect(sendEmailCallArgs.subject).toBe('Your Meterly password has been changed');
    expect(sendEmailCallArgs.html).toContain('This is a confirmation that the password for your Meterly account has been successfully changed');
  });

  it('should delegate to Better Auth handler and NOT send email if status is not 200', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    };
    mockGetSession.mockResolvedValueOnce({
      user: mockUser,
      session: { id: 'session-id' },
    });
    mockAuthHandler.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Wrong password' }), { status: 400 }));

    const res = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    }, {
      ENVIRONMENT: 'test',
    } as any);

    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('Wrong password');

    expect(mockAuthHandler).toHaveBeenCalled();
    // Wait for the async waitUntil execution (should not send email)
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should return 429 if password change limit is exceeded', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    };
    mockGetSession.mockResolvedValueOnce({
      user: mockUser,
      session: { id: 'session-id' },
    });
    (checkAndIncrementPasswordChangeLimit as any).mockResolvedValueOnce({ allowed: false, remainingSeconds: 3600 });

    const res = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    }, {
      ENVIRONMENT: 'test',
    } as any);

    expect(res.status).toBe(429);
    const json = await res.json() as any;
    expect(json.error).toBe('Password change limit reached. Try again in 1 hour.');
    expect(mockAuthHandler).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
