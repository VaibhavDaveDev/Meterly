import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { passwordChangeLimit } from '../../db/schema';

const MAX_CHANGES_PER_DAY = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function checkAndIncrementPasswordChangeLimit(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  const now = new Date();

  const record = await db
    .select()
    .from(passwordChangeLimit)
    .where(eq(passwordChangeLimit.userId, userId))
    .get();

  if (!record) {
    // First change ever — insert and allow
    await db.insert(passwordChangeLimit).values({
      id: crypto.randomUUID(),
      userId,
      count: 1,
      windowStart: now,
    }).run();
    return { allowed: true, remainingSeconds: 0 };
  }

  const windowAge = now.getTime() - record.windowStart.getTime();

  if (windowAge > WINDOW_MS) {
    // Window expired — reset and allow
    await db.update(passwordChangeLimit)
      .set({ count: 1, windowStart: now })
      .where(eq(passwordChangeLimit.userId, userId))
      .run();
    return { allowed: true, remainingSeconds: 0 };
  }

  if (record.count >= MAX_CHANGES_PER_DAY) {
    // Within window and limit hit
    const windowEndsAt = record.windowStart.getTime() + WINDOW_MS;
    const remainingSeconds = Math.ceil((windowEndsAt - now.getTime()) / 1000);
    return { allowed: false, remainingSeconds };
  }

  // Within window, under limit — increment and allow
  await db.update(passwordChangeLimit)
    .set({ count: record.count + 1 })
    .where(eq(passwordChangeLimit.userId, userId))
    .run();
  return { allowed: true, remainingSeconds: 0 };
}
