import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

let currentUser: { id: string } | null = { id: 'owner-id' };

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', currentUser);
    await next();
  }
}));

vi.mock('../lib/recalculation', () => ({
  recalculateChain: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../lib/bill-generation', () => ({
  generateAndSaveBills: vi.fn().mockResolvedValue([])
}));

import { testDb } from '../../test/setup';
import { readingsRouter } from './meter-readings';
import { properties, user, tenancies, billingPeriods, meterReadings, propertyRates, meterReadingEdits, editRequests } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('Meter Readings API', () => {
  let app: Hono;
  let ownerId: string;
  let tenantId: string;
  let propId: string;
  let bpId: string;

  beforeEach(async () => {
    ownerId = crypto.randomUUID();
    tenantId = crypto.randomUUID();
    propId = crypto.randomUUID();
    bpId = crypto.randomUUID();

    currentUser = { id: ownerId };
    vi.clearAllMocks();

    await testDb.delete(editRequests);
    await testDb.delete(meterReadingEdits);
    await testDb.delete(meterReadings);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(propertyRates);
    await testDb.delete(properties);
    await testDb.delete(user);

    await testDb.insert(user).values([
      { id: ownerId, name: 'Owner User', email: 'owner@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: tenantId, name: 'Tenant User', email: 'tenant@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }
    ]);

    await testDb.insert(properties).values({
      id: propId,
      name: 'Test Property',
      ownerId: ownerId,
      hasSolar: true
    });

    await testDb.insert(propertyRates).values({
      id: crypto.randomUUID(),
      propertyId: propId,
      consumptionRate: 10,
      exportRate: 5,
      effectiveFrom: '2024-01-01',
      createdBy: ownerId
    });

    await testDb.insert(tenancies).values({
      id: crypto.randomUUID(),
      propertyId: propId,
      tenantId: tenantId,
      status: 'active',
      splitPercentage: 100
    });

    await testDb.insert(billingPeriods).values({
      id: bpId,
      propertyId: propId,
      periodMonth: '2024-02-01',
      calculationMode: 'solar',
      status: 'draft'
    });

    app = new Hono();
    app.route('/:id/readings', readingsRouter);
    // Needed to mount root methods properly since they don't have /readings prefix
    app.route('/', readingsRouter);
  });

  const mockEnv = {
    DB: {} as unknown
  };

  describe('POST /:id/readings — Submit reading', () => {
    it('returns 429 when daily submission limit is reached', async () => {
      // Pre-insert 40 meterReadings for today for this user
      const inserts = Array.from({ length: 40 }, (_, i) => {
        const fakeBpId = crypto.randomUUID();
        return {
          id: `reading-limit-${i}`,
          billingPeriodId: fakeBpId,
          importEnd: 100 + i,
          exportEnd: 10,
          solarGenerationEnd: 20,
          submittedBy: tenantId,
          createdAt: new Date(), // today
          updatedAt: new Date()
        };
      });
      // Need billing periods for these readings
      const bpInserts = Array.from({ length: 40 }, (_, i) => ({
        id: inserts[i].billingPeriodId,
        propertyId: propId,
        periodMonth: `2020-01-${(i%28)+1}`.padStart(2, '0'),
        calculationMode: 'grid_only' as const,
        status: 'draft' as const
      }));
      await testDb.insert(billingPeriods).values(bpInserts);
      await testDb.insert(meterReadings).values(inserts);

      currentUser = { id: tenantId };
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200, exportEnd: 20, solarGenerationEnd: 50 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);

      expect(res.status).toBe(429);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMITED');
    });

    it('rejects when period does not exist', async () => {
      const res = await app.request(`/fake-id/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(404);
    });

    it('rejects when user is not owner or tenant', async () => {
      currentUser = { id: 'stranger-id' };
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(403);
    });

    it('rejects duplicate reading (READING_ALREADY_EXISTS)', async () => {
      await testDb.insert(meterReadings).values({
        id: crypto.randomUUID(),
        billingPeriodId: bpId,
        importEnd: 100,
        exportEnd: 0,
        solarGenerationEnd: 0,
        submittedBy: ownerId
      });
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('READING_ALREADY_EXISTS');
    });

    it('rejects when period is not in draft or pending_approval status', async () => {
      await testDb.update(billingPeriods).set({ status: 'confirmed' }).where(eq(billingPeriods.id, bpId));
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
    });

    it('rejects when importEnd is below previous period end (READING_BELOW_PREVIOUS)', async () => {
      const prevBpId = crypto.randomUUID();
      await testDb.insert(billingPeriods).values({
        id: prevBpId,
        propertyId: propId,
        periodMonth: '2024-01-01',
        calculationMode: 'solar',
        status: 'confirmed'
      });
      await testDb.insert(meterReadings).values({
        id: crypto.randomUUID(),
        billingPeriodId: prevBpId,
        importEnd: 500,
        exportEnd: 100,
        solarGenerationEnd: 200,
        submittedBy: ownerId
      });

      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 400, exportEnd: 150, solarGenerationEnd: 250 }) // importEnd is lower
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('READING_BELOW_PREVIOUS');
    });

    it('submits reading and generates bill for non-approval-required property', async () => {
      currentUser = { id: tenantId };
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 100, exportEnd: 20, solarGenerationEnd: 50 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [updatedBp] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, bpId));
      expect(updatedBp?.status).toBe('submitted');
    });

    it('moves period to pending_approval when readingsRequireApproval is true', async () => {
      await testDb.update(properties).set({ readingsRequireApproval: true }).where(eq(properties.id, propId));
      currentUser = { id: tenantId };
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 100, exportEnd: 20, solarGenerationEnd: 50 })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [updatedBp] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, bpId));
      expect(updatedBp?.status).toBe('pending_approval');
    });

    it('rejects solar export exceeding solar generation', async () => {
      const res = await app.request(`/${bpId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 100, exportEnd: 100, solarGenerationEnd: 50 }) // 100 > 50
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('INVALID_READING_EXPORT_EXCEEDS_GENERATION');
    });
  });

  describe('PATCH /:id/readings — Owner direct edit', () => {
    it('rejects when user is not the property owner', async () => {
      currentUser = { id: tenantId };
      const res = await app.request(`/${bpId}/readings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200, reason: 'Correction' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(403);
    });

    it('rejects editing a confirmed period (PERIOD_CONFIRMED)', async () => {
      await testDb.update(billingPeriods).set({ status: 'confirmed' }).where(eq(billingPeriods.id, bpId));
      const res = await app.request(`/${bpId}/readings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200, reason: 'Correction' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('PERIOD_CONFIRMED');
    });

    it('rejects editing a pending_approval period (PERIOD_PENDING_APPROVAL)', async () => {
      await testDb.update(billingPeriods).set({ status: 'pending_approval' }).where(eq(billingPeriods.id, bpId));
      const res = await app.request(`/${bpId}/readings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 200, reason: 'Correction' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('PERIOD_PENDING_APPROVAL');
    });

    it('edits reading and queues recalculation', async () => {
      await testDb.insert(meterReadings).values({
        id: crypto.randomUUID(),
        billingPeriodId: bpId,
        importEnd: 100,
        exportEnd: 0,
        solarGenerationEnd: 0,
        submittedBy: ownerId
      });
      await testDb.update(billingPeriods).set({ status: 'submitted' }).where(eq(billingPeriods.id, bpId));

      const res = await app.request(`/${bpId}/readings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 150, reason: 'Correction' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [mr] = await testDb.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, bpId));
      expect(mr?.importEnd).toBe(150);
      expect(mr?.version).toBe(2);
    });

    it('auto-cancels pending edit requests when owner edits directly', async () => {
      await testDb.insert(meterReadings).values({
        id: crypto.randomUUID(),
        billingPeriodId: bpId,
        importEnd: 100,
        exportEnd: 0,
        solarGenerationEnd: 0,
        submittedBy: tenantId
      });
      await testDb.update(billingPeriods).set({ status: 'submitted' }).where(eq(billingPeriods.id, bpId));

      const reqId = crypto.randomUUID();
      await testDb.insert(editRequests).values({
        id: reqId,
        billingPeriodId: bpId,
        requestedBy: tenantId,
        reason: 'Tenant request',
        proposedValues: JSON.stringify({ importEnd: 120 }),
        status: 'pending'
      });

      const res = await app.request(`/${bpId}/readings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importEnd: 130, reason: 'Owner override' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [er] = await testDb.select().from(editRequests).where(eq(editRequests.id, reqId));
      expect(er?.status).toBe('cancelled');
      expect(er?.reviewNote).toContain('Owner edited readings directly');
    });
  });

  describe('PATCH /:id/approve — Owner approves reading', () => {
    it('rejects when period is not pending_approval', async () => {
      const res = await app.request(`/${bpId}/approve`, {
        method: 'PATCH'
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.error.code).toBe('INVALID_STATUS');
    });

    it('approves reading and generates bills', async () => {
      await testDb.insert(meterReadings).values({
        id: crypto.randomUUID(),
        billingPeriodId: bpId,
        importEnd: 100,
        exportEnd: 0,
        solarGenerationEnd: 0,
        submittedBy: tenantId
      });
      await testDb.update(billingPeriods).set({ status: 'pending_approval' }).where(eq(billingPeriods.id, bpId));

      const res = await app.request(`/${bpId}/approve`, {
        method: 'PATCH'
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [bp] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, bpId));
      expect(bp?.status).toBe('confirmed');
    });
  });

  describe('PATCH /:id/reject — Owner rejects reading', () => {
    it('rejects when period is not pending_approval', async () => {
      const res = await app.request(`/${bpId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Bad reading' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
    });

    it('rejects reading and reverts period to draft', async () => {
      await testDb.update(billingPeriods).set({ status: 'pending_approval' }).where(eq(billingPeriods.id, bpId));

      const res = await app.request(`/${bpId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Bad reading' })
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [bp] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, bpId));
      expect(bp?.status).toBe('draft');
    });
  });

  describe('PATCH /:id/confirm — Owner confirms period', () => {
    it('rejects when period is not submitted', async () => {
      const res = await app.request(`/${bpId}/confirm`, {
        method: 'PATCH'
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
    });

    it('confirms period successfully', async () => {
      await testDb.update(billingPeriods).set({ status: 'submitted' }).where(eq(billingPeriods.id, bpId));
      const res = await app.request(`/${bpId}/confirm`, {
        method: 'PATCH'
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [bp] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, bpId));
      expect(bp?.status).toBe('confirmed');
    });
  });

  describe('PATCH /:id/reopen — Owner reopens period', () => {
    it('rejects when period is not confirmed or submitted', async () => {
      const res = await app.request(`/${bpId}/reopen`, {
        method: 'PATCH'
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(400);
    });

    it('reopens period to submitted status', async () => {
      await testDb.update(billingPeriods).set({ status: 'confirmed' }).where(eq(billingPeriods.id, bpId));
      const res = await app.request(`/${bpId}/reopen`, {
        method: 'PATCH'
      }, mockEnv as unknown as Parameters<typeof app.request>[2], { waitUntil: () => {} } as unknown as ExecutionContext);
      expect(res.status).toBe(200);

      const [bp] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, bpId));
      expect(bp?.status).toBe('submitted');
    });
  });
});
