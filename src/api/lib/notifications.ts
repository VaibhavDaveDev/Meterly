import { getDb } from '../../db';
import { notifications } from '../../db/schema';

export type NotificationType = 
  | 'readings_submitted'
  | 'reading_pending_approval'
  | 'reading_approved'
  | 'reading_rejected'
  | 'bill_ready'
  | 'tenant_accepted'
  | 'edit_request_raised'
  | 'edit_approved'
  | 'edit_rejected'
  | 'rate_changed'
  | 'charge_added'
  | 'charge_updated'
  | 'payment_received'
  | 'payment_reminder'
  | 'reading_reminder'
  | 'bill_generated'
  | 'system';

export async function createNotification(
  db: ReturnType<typeof getDb>,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {}
) {
  return db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    type,
    title,
    body,
    metadata: JSON.stringify(metadata),
  });
}
