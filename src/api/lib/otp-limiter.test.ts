/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getOtpCooldown, checkAndIncrementOtpRateLimit, resetOtpRateLimit } from './otp-limiter';

describe('OTP Rate Limiting', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    
    // Create the otp_rate_limit table for in-memory tests
    sqlite.exec(`
      CREATE TABLE otp_rate_limit (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        attempts INTEGER DEFAULT 0 NOT NULL,
        last_sent_at INTEGER NOT NULL
      );
    `);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getOtpCooldown', () => {
    it('should return correct cooldowns for attempt counts', () => {
      expect(getOtpCooldown(0)).toBe(0);
      expect(getOtpCooldown(1)).toBe(5 * 60 * 1000);   // 5 mins
      expect(getOtpCooldown(2)).toBe(15 * 60 * 1000);  // 15 mins
      expect(getOtpCooldown(3)).toBe(30 * 60 * 1000);  // 30 mins
      expect(getOtpCooldown(4)).toBe(60 * 60 * 1000);  // 60 mins
      expect(getOtpCooldown(10)).toBe(60 * 60 * 1000); // 60 mins
    });
  });

  describe('checkAndIncrementOtpRateLimit', () => {
    const testEmail = 'user@example.com';

    it('should allow the first attempt and create a record', async () => {
      const result = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(result.allowed).toBe(true);
      expect(result.waitTimeMs).toBe(0);

      const record = db
        .select()
        .from(schema.otpRateLimit)
        .where(eq(schema.otpRateLimit.email, testEmail))
        .get();

      expect(record).toBeDefined();
      expect(record?.email).toBe(testEmail);
      expect(record?.attempts).toBe(1);
    });

    it('should block 2nd attempt before 5 mins cooldown', async () => {
      // 1st attempt
      await checkAndIncrementOtpRateLimit(db as any, testEmail);

      // Try again immediately (2nd attempt)
      const result = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(result.allowed).toBe(false);
      expect(result.waitTimeMs).toBeCloseTo(5 * 60 * 1000, -4); // close to 5 mins

      // Advance clock by 3 minutes -> still blocked
      vi.advanceTimersByTime(3 * 60 * 1000);
      const resultAfter3Mins = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(resultAfter3Mins.allowed).toBe(false);
      expect(resultAfter3Mins.waitTimeMs).toBeCloseTo(2 * 60 * 1000, -4);

      // Advance clock by another 2 minutes (total 5 mins since 1st) -> allowed
      vi.advanceTimersByTime(2 * 60 * 1000);
      const resultAfter5Mins = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(resultAfter5Mins.allowed).toBe(true);
      expect(resultAfter5Mins.waitTimeMs).toBe(0);

      const record = db
        .select()
        .from(schema.otpRateLimit)
        .where(eq(schema.otpRateLimit.email, testEmail))
        .get();
      expect(record?.attempts).toBe(2);
    });

    it('should exponentially increase waiting time for subsequent attempts', async () => {
      // 1st attempt (allowed)
      await checkAndIncrementOtpRateLimit(db as any, testEmail);

      // Advance 5 mins and make 2nd attempt (allowed)
      vi.advanceTimersByTime(5 * 60 * 1000 + 10);
      await checkAndIncrementOtpRateLimit(db as any, testEmail);

      // Try 3rd attempt immediately -> blocked with 15 mins cooldown
      const result3 = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(result3.allowed).toBe(false);
      expect(result3.waitTimeMs).toBeCloseTo(15 * 60 * 1000, -4);

      // Advance 15 mins and make 3rd attempt (allowed)
      vi.advanceTimersByTime(15 * 60 * 1000 + 10);
      await checkAndIncrementOtpRateLimit(db as any, testEmail);

      // Try 4th attempt immediately -> blocked with 30 mins cooldown
      const result4 = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(result4.allowed).toBe(false);
      expect(result4.waitTimeMs).toBeCloseTo(30 * 60 * 1000, -4);
    });

    it('should reset attempt count if resetThreshold (2 hours) has passed', async () => {
      // 1st attempt (allowed)
      await checkAndIncrementOtpRateLimit(db as any, testEmail);

      // Advance clock by 2 hours and 1 minute
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 60 * 1000);

      // This attempt should be allowed immediately, and attempts count should reset to 1
      const result = await checkAndIncrementOtpRateLimit(db as any, testEmail);
      expect(result.allowed).toBe(true);
      expect(result.waitTimeMs).toBe(0);

      const record = db
        .select()
        .from(schema.otpRateLimit)
        .where(eq(schema.otpRateLimit.email, testEmail))
        .get();
      expect(record?.attempts).toBe(1);
    });
  });

  describe('resetOtpRateLimit', () => {
    it('should delete rate limit record', async () => {
      const testEmail = 'reset@example.com';
      await checkAndIncrementOtpRateLimit(db as any, testEmail);

      let record = db
        .select()
        .from(schema.otpRateLimit)
        .where(eq(schema.otpRateLimit.email, testEmail))
        .get();
      expect(record).toBeDefined();

      await resetOtpRateLimit(db as any, testEmail);

      record = db
        .select()
        .from(schema.otpRateLimit)
        .where(eq(schema.otpRateLimit.email, testEmail))
        .get();
      expect(record).toBeUndefined();
    });
  });
});
