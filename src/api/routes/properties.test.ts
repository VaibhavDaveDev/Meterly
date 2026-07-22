import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

// Mock the auth middleware BEFORE importing the router
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', { id: 'test-user-id' });
    await next();
  }
}));

import { testDb } from '../../test/setup';
import { properties, user, tenancies, billingPeriods, bills, meterReadings } from '../../db/schema';
import { propertiesRouter } from './properties';

describe('Properties API', () => {
  let app: Hono;

  beforeEach(async () => {
    // Clear in FK-safe order: children first, parents last
    await testDb.delete(meterReadings);
    await testDb.delete(bills);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);
    
    // Insert a dummy user to satisfy foreign key constraints
    await testDb.insert(user).values({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    app = new Hono();
    app.route('/properties', propertiesRouter);
  });

  it('should list empty properties initially', async () => {
    // Since we mounted at /properties, the request URL is /properties
    const res = await app.request('/properties', {}, { DB: {} as unknown });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { owned: unknown[], tenant: unknown[], tenantPast: unknown[] } };
    expect(body.data.owned).toEqual([]);
    expect(body.data.tenant).toEqual([]);
    expect(body.data.tenantPast).toEqual([]);
  });

  it('should create a property successfully', async () => {
    const req = new Request('http://localhost/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Property',
        hasSolar: true
      })
    });
    
    const res = await app.request(req, {}, { DB: {} as unknown });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { name: string; hasSolar: boolean; ownerId: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test Property');
    expect(body.data.hasSolar).toBe(true);
    expect(body.data.ownerId).toBe('test-user-id');
  });

  it('deletes property and cascades correctly', async () => {
    // 1. Create property
    const id = 'prop-cascade-test';
    await testDb.insert(properties).values({
      id,
      name: 'Cascade Prop',
      ownerId: 'test-user-id',
      hasSolar: false
    });

    // 2. Create related records (tenancies, billing periods, bills, readings)
    await testDb.insert(tenancies).values({
      id: 'ten-1', propertyId: id, status: 'active', splitPercentage: 100, tenantId: 'test-user-id'
    });
    await testDb.insert(billingPeriods).values({
      id: 'bp-1', propertyId: id, periodMonth: '2024-01', calculationMode: 'grid_only', status: 'draft'
    });
    await testDb.insert(bills).values({
      id: 'b-1', billingPeriodId: 'bp-1', tenancyId: 'ten-1', splitPercentage: 100,
      totalDue: 100, consumptionCost: 100, tenantConsumption: 10, totalConsumption: 10,
      solarGenerated: 0, gridImported: 10, gridExported: 0, solarSelfConsumed: 0, exportRefund: 0, status: 'pending'
    });
    await testDb.insert(meterReadings).values({
      id: 'mr-1', billingPeriodId: 'bp-1',
      importEnd: 100, exportEnd: 0, solarGenerationEnd: 0,
      submittedBy: 'test-user-id'
    });

    // 3. Delete property
    const req = new Request(`http://localhost/properties/${id}`, {
      method: 'DELETE'
    });
    const res = await app.request(req, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    expect(res.status).toBe(200);

    // 4. Verify cascade deletions
    const propsResult = await testDb.select().from(properties).where(eq(properties.id, id));
    expect(propsResult.length).toBe(0);

    // Billing periods are KEPT — bills FK to them for permanent tenant history
    const bpResult = await testDb.select().from(billingPeriods).where(eq(billingPeriods.propertyId, id));
    expect(bpResult.length).toBe(1);

    // Operational data (meter readings) is KEPT
    const mrResult = await testDb.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, 'bp-1'));
    expect(mrResult.length).toBe(1);

    // Tenancies are soft-deleted (status 'property_deleted'), not hard-deleted
    const tenanciesResult = await testDb.select().from(tenancies).where(eq(tenancies.propertyId, id));
    expect(tenanciesResult.length).toBe(1);
    expect(tenanciesResult[0].status).toBe('property_deleted');
  });
});
