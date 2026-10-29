import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { app, type Bindings } from "../app";
import { testDb } from "../../test/setup";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

describe("OTP Interceptor API Integration", () => {
  const registeredEmail = "registered@example.com";
  const unregisteredEmail = "unregistered@example.com";

  beforeEach(async () => {
    // Clear relevant tables
    await testDb.delete(schema.user);
    await testDb.delete(schema.otpRateLimit);

    // Insert dummy registered user
    await testDb.insert(schema.user).values({
      id: "test-user-id",
      name: "Registered User",
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

  it("should return mock success for unregistered email on forget-password without sending OTP", async () => {
    const res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: unregisteredEmail,
          type: "forget-password",
        }),
      },
      {
        DB: testDb as unknown as Bindings["DB"],
        ENVIRONMENT: "test",
        BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_secret",
        BETTER_AUTH_URL: "http://localhost:3000",
        ATLAS_MAILER_URL: "http://localhost:3000",
        ATLAS_MAILER_SECRET: "dummy_secret",
      }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean };
    expect(json.success).toBe(true);

    // Verify no otpRateLimit record was created for the unregistered email
    const limitRecord = testDb
      .select()
      .from(schema.otpRateLimit)
      .where(eq(schema.otpRateLimit.email, unregisteredEmail))
      .get();
    expect(limitRecord).toBeUndefined();
  });

  it("should enforce rate limits and increase cooldown for registered email", async () => {
    const env: Partial<Bindings> = {
      DB: testDb as unknown as Bindings["DB"],
      ENVIRONMENT: "test",
      BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      ATLAS_MAILER_URL: "http://localhost:3000",
      ATLAS_MAILER_SECRET: "dummy_secret",
    };

    // 1st request -> allowed (returns 200, delegates to Better Auth which mock-sends or returns success)
    let res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          type: "forget-password",
        }),
      },
      env
    );
    expect(res.status).toBe(200);

    // Try again immediately (2nd request) -> blocked with 429
    res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          type: "forget-password",
        }),
      },
      env
    );
    expect(res.status).toBe(429);
    let json = (await res.json()) as { message?: string };
    expect(json.message).toContain("Please wait 5 minutes");

    // Fast forward clock by 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000 + 10);

    // 3rd request (which is 2nd sent email) -> allowed
    res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          type: "forget-password",
        }),
      },
      env
    );
    expect(res.status).toBe(200);

    // Try again immediately (3rd email request) -> blocked with 15 mins cooldown
    res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          type: "forget-password",
        }),
      },
      env
    );
    expect(res.status).toBe(429);
    json = (await res.json()) as { message?: string };
    expect(json.message).toContain("Please wait 15 minutes");
  });
  it("should return mock success for unregistered email on email-verification without sending OTP", async () => {
    const res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unregisteredEmail,
          type: "email-verification",
        }),
      },
      {
        DB: testDb as unknown as Bindings["DB"],
        ENVIRONMENT: "test",
        BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_secret",
        BETTER_AUTH_URL: "http://localhost:3000",
        ATLAS_MAILER_URL: "http://localhost:3000",
        ATLAS_MAILER_SECRET: "dummy_secret",
      }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean };
    expect(json.success).toBe(true);

    const limitRecord = testDb
      .select()
      .from(schema.otpRateLimit)
      .where(eq(schema.otpRateLimit.email, unregisteredEmail))
      .get();
    expect(limitRecord).toBeUndefined();
  });

  it("should return mock success without OTP rate limit record when email is already verified", async () => {
    const res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          type: "email-verification",
        }),
      },
      {
        DB: testDb as unknown as Bindings["DB"],
        ENVIRONMENT: "test",
        BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_secret",
        BETTER_AUTH_URL: "http://localhost:3000",
        ATLAS_MAILER_URL: "http://localhost:3000",
        ATLAS_MAILER_SECRET: "dummy_secret",
      }
    );

    expect(res.status).toBe(200);
    const limitRecord = testDb
      .select()
      .from(schema.otpRateLimit)
      .where(eq(schema.otpRateLimit.email, registeredEmail))
      .get();
    expect(limitRecord).toBeUndefined();
  });

  it("should enforce rate limits on unverified user resending email-verification OTP", async () => {
    const unverifiedEmail = "unverified@example.com";
    await testDb.insert(schema.user).values({
      id: "unverified-user-id",
      name: "Unverified User",
      email: unverifiedEmail,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env: Partial<Bindings> = {
      DB: testDb as unknown as Bindings["DB"],
      ENVIRONMENT: "test",
      BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      ATLAS_MAILER_URL: "http://localhost:3000",
      ATLAS_MAILER_SECRET: "dummy_secret",
    };

    // 1st request -> allowed
    let res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unverifiedEmail,
          type: "email-verification",
        }),
      },
      env
    );
    expect(res.status).toBe(200);

    // Immediate 2nd request -> throttled with 429
    res = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unverifiedEmail,
          type: "email-verification",
        }),
      },
      env
    );
    expect(res.status).toBe(429);
    const json = (await res.json()) as { message?: string };
    expect(json.message).toContain("Please wait 5 minutes");
  });
  it("should reset otp rate limit upon successful email-verification", async () => {
    const unverifiedEmail = "verify-reset@example.com";
    await testDb.insert(schema.user).values({
      id: "verify-reset-id",
      name: "Verify Reset User",
      email: unverifiedEmail,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env: Partial<Bindings> = {
      DB: testDb as unknown as Bindings["DB"],
      ENVIRONMENT: "test",
      BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      ATLAS_MAILER_URL: "http://localhost:3000",
      ATLAS_MAILER_SECRET: "dummy_secret",
    };

    // 1. Send OTP
    const sendRes = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unverifiedEmail,
          type: "email-verification",
        }),
      },
      env
    );
    expect(sendRes.status).toBe(200);

    // Verify rate limit record was created
    const initialLimit = testDb
      .select()
      .from(schema.otpRateLimit)
      .where(eq(schema.otpRateLimit.email, unverifiedEmail))
      .get();
    expect(initialLimit).toBeDefined();

    // Find generated OTP from verification table
    const verificationRecord = testDb
      .select()
      .from(schema.verification)
      .where(
        eq(
          schema.verification.identifier,
          `email-verification-otp-${unverifiedEmail}`
        )
      )
      .get();
    expect(verificationRecord).toBeDefined();
    const otpCode = verificationRecord!.value.split(":")[0];

    // 2. Call verify-email with the OTP
    const verifyRes = await app.request(
      "/api/auth/email-otp/verify-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unverifiedEmail,
          otp: otpCode,
        }),
      },
      env
    );
    expect(verifyRes.status).toBe(200);

    // 3. Verify that the rate limit record was purged/reset
    const clearedLimit = testDb
      .select()
      .from(schema.otpRateLimit)
      .where(eq(schema.otpRateLimit.email, unverifiedEmail))
      .get();
    expect(clearedLimit).toBeUndefined();
  });
});
