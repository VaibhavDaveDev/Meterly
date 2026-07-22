import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../middleware/auth', () => ({ authMiddleware: async (_c: unknown, next: () => unknown) => next() }));
import { testDb } from '../../test/setup';
import { properties, billingPeriods, tenancies, notifications, user } from '../../db/schema';
import { app, type Bindings } from '../app';

describe('Cron: reading-reminders', () => {
  beforeEach(async () => {
    // Clear tables
    await testDb.delete(notifications);
    await testDb.delete(tenancies);
    await testDb.delete(billingPeriods);
    await testDb.delete(properties);
    await testDb.delete(user);
  });

  async function seedCronFixtures(reminderDay: number, includeTenant = false) {
    const prevMonthStr = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
    await testDb.insert(user).values([
      { id: 'owner-1', email: 'owner@example.com', name: 'Owner', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      ...(includeTenant ? [{ id: 'tenant-1', email: 'tenant@example.com', name: 'Tenant', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }] : [])
    ]);
    await testDb.insert(properties).values({ id: 'prop-1', ownerId: 'owner-1', name: 'Test Property', readingReminderDay: reminderDay });
    if (includeTenant) {
      await testDb.insert(tenancies).values({ id: 'tenancy-1', propertyId: 'prop-1', tenantId: 'tenant-1', splitPercentage: 100, status: 'active', invitedAt: new Date() });
    }
    await testDb.insert(billingPeriods).values({ id: 'period-1', propertyId: 'prop-1', periodMonth: prevMonthStr, calculationMode: 'grid_only', status: 'draft' });
  }

  it('sends notification when reminder day matches today', async () => {
    const today = new Date().getDate();
    await seedCronFixtures(today);

    const res = await app.request('/api/cron/reading-reminders', { headers: { 'Authorization': 'Bearer dev-secret' } }, { DB: testDb as unknown as Bindings['DB'] });
    expect(res.status).toBe(200);

    const notifs = await testDb.select().from(notifications);
    expect(notifs.length).toBe(1);
    expect(notifs[0].userId).toBe('owner-1');
  });

  it('skips when reminder day does not match today', async () => {
    const today = new Date().getDate();
    const otherDay = today === 28 ? 1 : today + 1; // pick a day that is not today
    await seedCronFixtures(otherDay);

    const res = await app.request('/api/cron/reading-reminders', { headers: { 'Authorization': 'Bearer dev-secret' } }, { DB: testDb as unknown as Bindings['DB'] });
    expect(res.status).toBe(200);

    const notifs = await testDb.select().from(notifications);
    expect(notifs.length).toBe(0);
  });

  it('sends to owner and all active tenants', async () => {
    const today = new Date().getDate();
    await seedCronFixtures(today, true);

    const res = await app.request('/api/cron/reading-reminders', { headers: { 'Authorization': 'Bearer dev-secret' } }, { DB: testDb as unknown as Bindings['DB'] });
    expect(res.status).toBe(200);

    const notifs = await testDb.select().from(notifications);
    expect(notifs.length).toBe(2);
    expect(notifs.some(n => n.userId === 'owner-1')).toBe(true);
    expect(notifs.some(n => n.userId === 'tenant-1')).toBe(true);
  });
});
