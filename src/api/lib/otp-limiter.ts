import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { otpRateLimit } from '../../db/schema';

/**
 * Calculates the required cooldown in milliseconds based on the number of attempts.
 * 
 * attempts = 1 (1st email sent, waiting for 2nd email): 5 minutes
 * attempts = 2 (2nd email sent, waiting for 3rd email): 15 minutes
 * attempts = 3 (3rd email sent, waiting for 4th email): 30 minutes
 * attempts >= 4: 60 minutes (1 hour)
 */
export function getOtpCooldown(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 5 * 60 * 1000;    // 5 minutes
  if (attempts === 2) return 15 * 60 * 1000;   // 15 minutes
  if (attempts === 3) return 30 * 60 * 1000;   // 30 minutes
  return 60 * 60 * 1000;                       // 60 minutes (1 hour max)
}

/**
 * Checks if sending an OTP to the given email address is currently allowed,
 * and if so, records the new attempt.
 * 
 * If blocked, returns { allowed: false, waitTimeMs: X } with the remaining cooldown.
 * If allowed, returns { allowed: true, waitTimeMs: 0 } and updates database state.
 */
export async function checkAndIncrementOtpRateLimit(
  db: ReturnType<typeof getDb>,
  email: string
): Promise<{ allowed: boolean; waitTimeMs: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const record = await db
    .select()
    .from(otpRateLimit)
    .where(eq(otpRateLimit.email, normalizedEmail))
    .get();

  if (!record) {
    // First attempt: insert record with attempts = 1
    await db
      .insert(otpRateLimit)
      .values({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        attempts: 1,
        lastSentAt: now,
      })
      .run();
    return { allowed: true, waitTimeMs: 0 };
  }

  const timeSinceLastSent = now.getTime() - record.lastSentAt.getTime();
  const resetThreshold = 2 * 60 * 60 * 1000; // 2 hours of inactivity resets cooldown

  let currentAttempts = record.attempts;
  if (timeSinceLastSent > resetThreshold) {
    currentAttempts = 0;
  }

  const cooldownMs = getOtpCooldown(currentAttempts);

  if (currentAttempts > 0 && timeSinceLastSent < cooldownMs) {
    return { allowed: false, waitTimeMs: cooldownMs - timeSinceLastSent };
  }

  const nextAttempts = currentAttempts + 1;
  await db
    .update(otpRateLimit)
    .set({
      attempts: nextAttempts,
      lastSentAt: now,
    })
    .where(eq(otpRateLimit.email, normalizedEmail))
    .run();

  return { allowed: true, waitTimeMs: 0 };
}

/**
 * Deletes the OTP rate limit tracking for an email address (resets state).
 */
export async function resetOtpRateLimit(
  db: ReturnType<typeof getDb>,
  email: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  await db
    .delete(otpRateLimit)
    .where(eq(otpRateLimit.email, normalizedEmail))
    .run();
}
