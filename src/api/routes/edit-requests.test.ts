import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

let currentUser: { id: string } | null = { id: 'test-user-id' };

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', currentUser);
    await next();
  }
}));

// Mock recalculateChain and createNotification to avoid side-effects in testing
vi.mock('../lib/recalculation', () => ({
  recalculateChain: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined)
}));

import { testDb } from '../../test/setup';
import { eq } from 'drizzle-orm';
import { properties, user, tenancies, billingPeriods, meterReadings, bills, propertyRates, editRequests } from '../../db/schema';
import { requestsRouter } from './edit-requests';

interface SuccessResponse {
  success: boolean;
  data: {
    id: string;
    overwrote: boolean;
  };
}

interface ListResponse {
  success: boolean;
  data: {
    pending: Array<{
      id: string;
      status: string;
      reason: string;
    }>;
    resolved: Array<{
      id: string;
      status: string;
      reason: string;
    }>;
  };
}

describe('Edit Requests API Routes', () => {
  let app: Hono;
  
  // Valid UUID strings generated dynamically
  let ownerId: string;
  let tenantId: string;
  let propId: string;
  let tenancyId: string;
  let periodId: string;
  let readingId: string;
  let reqId: string;

  beforeEach(async () => {
    ownerId = crypto.randomUUID();
    tenantId = crypto.randomUUID();
    propId = crypto.randomUUID();
    tenancyId = crypto.randomUUID();
    periodId = crypto.randomUUID();
    readingId = crypto.randomUUID();
    reqId = crypto.randomUUID();

    currentUser = { id: tenantId };
    vi.clearAllMocks();

    await testDb.delete(editRequests);
    await testDb.delete(propertyRates);
    await testDb.delete(meterReadings);
    await testDb.delete(bills);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);

    // Insert database fixtures
    await testDb.insert(user).values([
      { id: ownerId, name: 'Owner User', email: 'owner@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: tenantId, name: 'Tenant User', email: 'tenant@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }
    ]);

    await testDb.insert(properties).values({
      id: propId,
      name: 'Test Apartment',
      ownerId: ownerId,
      hasSolar: false,
      maxPendingEditRequests: 3
    });

    await testDb.insert(tenancies).values({
      id: tenancyId,
      propertyId: propId,
      tenantId: tenantId,
      status: 'active',
      inviteEmail: 'tenant@example.com',
      splitPercentage: 100
    });

    await testDb.insert(billingPeriods).values({
      id: periodId,
      propertyId: propId,
      periodMonth: '2024-01-01',
      calculationMode: 'grid_only',
      status: 'confirmed'
    });

    await testDb.insert(meterReadings).values({
      id: readingId,
      billingPeriodId: periodId,
      importStart: 1000,
      importEnd: 1200,
      exportStart: 0,
      exportEnd: 0,
      solarGenerationStart: 0,
      solarGenerationEnd: 0,
      submittedBy: ownerId
    });

    app = new Hono();
    app.route('/api/edit-requests', requestsRouter);
  });

  async function insertPendingEditRequest(id: string, options: { tenantId: string; periodId: string; reason?: string; proposedValues?: object }) {
    await testDb.insert(editRequests).values({
      id,
      billingPeriodId: options.periodId,
      requestedBy: options.tenantId,
      reason: options.reason ?? 'Please correct this reading.',
      proposedValues: JSON.stringify(options.proposedValues ?? { importEnd: 1150 }),
      status: 'pending'
    });
  }

  describe('POST /api/edit-requests', () => {
    it('successfully raises an edit request for a confirmed period', async () => {
      const res = await app.request('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriodId: periodId,
          reason: 'The import reading was entered incorrectly.',
          proposedValues: {
            importEnd: 1150
          }
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      if (res.status !== 200) {
        console.log("DEBUG POST FAILURE:", await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as SuccessResponse;
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();

      const [dbReq] = await testDb.select().from(editRequests).where(eq(editRequests.id, body.data.id)).limit(1);
      expect(dbReq).toBeDefined();
      expect(dbReq?.reason).toBe('The import reading was entered incorrectly.');
    });

    it('rejects with 400 when reason is too short', async () => {
      const res = await app.request('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriodId: periodId,
          reason: 'Short',
          proposedValues: {
            importEnd: 1150
          }
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      expect(res.status).toBe(400);
    });

    it('overwrites previous pending edit request for the same period', async () => {
      const prevReqId = crypto.randomUUID();
      // Create first pending request
      await insertPendingEditRequest(prevReqId, {
        tenantId,
        periodId,
        reason: 'Initial correction request for this period.',
        proposedValues: { importEnd: 1180 }
      });

      // Submit new request
      const res = await app.request('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriodId: periodId,
          reason: 'Updated correction explanation.',
          proposedValues: {
            importEnd: 1150
          }
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      if (res.status !== 200) {
        console.log("DEBUG OVERWRITE FAILURE:", await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as SuccessResponse;
      expect(body.success).toBe(true);

      // Verify previous request is now cancelled
      const [prev] = await testDb.select().from(editRequests).where(eq(editRequests.id, prevReqId)).limit(1);
      expect(prev?.status).toBe('cancelled');
    });
  });

  describe('GET /api/edit-requests', () => {
    it('returns edit requests raised by tenant', async () => {
      await insertPendingEditRequest(reqId, { tenantId, periodId });

      currentUser = { id: ownerId };

      const res = await app.request('/api/edit-requests', {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
      if (res.status !== 200) {
        console.log("DEBUG GET FAILURE:", await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as ListResponse;
      expect(body.success).toBe(true);
      expect(body.data.pending).toHaveLength(1);
      expect(body.data.pending[0]?.id).toBe(reqId);
    });
  });

  describe('PATCH /api/edit-requests/:id/review (Approve)', () => {
    it('allows owner to approve edit request', async () => {
      await insertPendingEditRequest(reqId, { tenantId, periodId });

      // Switch context to owner
      currentUser = { id: ownerId };

      const res = await app.request(`/api/edit-requests/${reqId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve'
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      if (res.status !== 200) {
        console.log("DEBUG APPROVE FAILURE:", await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);

      const [dbReq] = await testDb.select().from(editRequests).where(eq(editRequests.id, reqId)).limit(1);
      expect(dbReq?.status).toBe('approved');
    });

    it('denies approval requests from the tenant', async () => {
      await insertPendingEditRequest(reqId, { tenantId, periodId });

      // Context is tenant
      currentUser = { id: tenantId };

      const res = await app.request(`/api/edit-requests/${reqId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve'
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/edit-requests/:id/review (Reject)', () => {
    it('allows owner to reject edit request with review note', async () => {
      await insertPendingEditRequest(reqId, { tenantId, periodId });

      currentUser = { id: ownerId };

      const res = await app.request(`/api/edit-requests/${reqId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: 'Rejection reason explanation.'
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      if (res.status !== 200) {
        console.log("DEBUG REJECT FAILURE:", await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);

      const [dbReq] = await testDb.select().from(editRequests).where(eq(editRequests.id, reqId)).limit(1);
      expect(dbReq?.status).toBe('rejected');
    });
  });
});
