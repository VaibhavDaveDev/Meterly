import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { session } from '../../db/schema';
import { logger } from './logger';

/**
 * ponytail: simple FIFO deletion
 */
export async function enforceSessionLimit(
  db: ReturnType<typeof getDb>,
  userId: string,
  maxSessions: number
) {
  if (maxSessions === 0) return;

  const userSessions = await db
    .select()
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(session.createdAt);

  const excessCount = userSessions.length - maxSessions;
  
  if (excessCount > 0) {
    for (const s of userSessions.slice(0, excessCount)) {
      await db.delete(session).where(eq(session.id, s.id));
    }
    logger.info({ userId, deletedCount: excessCount, event: 'session.fifo_cleanup' }, 'old sessions pruned');
  }
}
