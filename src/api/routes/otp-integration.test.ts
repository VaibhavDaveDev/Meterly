/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { app } from '../app';
import { testDb } from '../../test/setup';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('OTP Interceptor API Integration', () => {
  const registeredEmail = 'registered@example.com';
  const unregisteredEmail = 'unregistered@example.com';

  beforeEach(async () => {
    // Clear relevant tables
    await testDb.delete(schema.user);
    await testDb.delete(schema.otpRateLimit);

    // Insert dummy registered user
    await testDb.insert(schema.user).values({
      id: 'test-user-id',
      name: 'Registered User',
      email: registeredEmail,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return mock success for unregistered email on forget-password without sending OTP', async () => {
    const res = await app.request('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: unregisteredEmail,
        type: 'forget-password',
      }),
    }, {
      DB: (testDb as any).$client || testDb,
      ENVIRONMENT: 'test',
      BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_secret',
      BETTER_AUTH_URL: 'http://localhost:3000',
      ATLAS_MAILER_URL: 'http://localhost:3000',
      ATLAS_MAILER_SECRET: 'dummy_secret',
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);

    // Verify no otpRateLimit record was created for the unregistered email
    const limitRecord = testDb
      .select()
      .from(schema.otpRateLimit)
      .where(eq(schema.otpRateLimit.email, unregisteredEmail))
      .get();
    expect(limitRecord).toBeUndefined();
  });

  it('should enforce rate limits and increase cooldown for registered email', async () => {
    const d1 = (testDb as any).$client || testDb;
    const env = {
      DB: d1,
      ENVIRONMENT: 'test',
      BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_secret',
      BETTER_AUTH_URL: 'http://localhost:3000',
      ATLAS_MAILER_URL: 'http://localhost:3000',
      ATLAS_MAILER_SECRET: 'dummy_secret',
    } as any;

    // 1st request -> allowed (returns 200, delegates to Better Auth which mock-sends or returns success)
    let res = await app.request('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail, type: 'forget-password' }),
    }, env);
    expect(res.status).toBe(200);

    // Try again immediately (2nd request) -> blocked with 429
    res = await app.request('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail, type: 'forget-password' }),
    }, env);
    expect(res.status).toBe(429);
    let json = await res.json() as any;
    expect(json.message).toContain('Please wait 5 minutes');

    // Fast forward clock by 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000 + 10);

    // 3rd request (which is 2nd sent email) -> allowed
    res = await app.request('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail, type: 'forget-password' }),
    }, env);
    expect(res.status).toBe(200);

    // Try again immediately (3rd email request) -> blocked with 15 mins cooldown
    res = await app.request('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail, type: 'forget-password' }),
    }, env);
    expect(res.status).toBe(429);
    json = await res.json() as any;
    expect(json.message).toContain('Please wait 15 minutes');
  });
});
