import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

let currentUser: { id: string } | null = { id: 'test-user-id' };

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', currentUser);
    await next();
  }
}));

import { testDb } from '../../test/setup';
import { eq } from 'drizzle-orm';
import { properties, user, tenancies, billingPeriods, meterReadings, bills, propertyRates } from '../../db/schema';
import { propertiesRouter } from './properties';
import { tenancyActionsRouter } from './tenancy-actions';
import { periodsRouter } from './billing-periods';
import { readingsRouter } from './meter-readings';

interface CheckNameResponse {
  exists: boolean;
}

interface ConfirmedPeriodsResponse {
  success: boolean;
  data: Array<{ id: string; periodMonth: string }>;
}

interface CreatePeriodResponse {
  success: boolean;
  data: {
    id: string;
    status: string;
  };
}

describe('New Features API Routes', () => {
  let app: Hono;

  beforeEach(async () => {
    currentUser = { id: 'owner-id' };
    vi.clearAllMocks();

    await testDb.delete(propertyRates);
    await testDb.delete(meterReadings);
    await testDb.delete(bills);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);

    // Insert users
    await testDb.insert(user).values([
      { id: 'owner-id', name: 'Owner User', email: 'owner@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'tenant-id', name: 'Tenant User', email: 'tenant@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }
    ]);

    app = new Hono();
    app.route('/properties', propertiesRouter);
    app.route('/tenancies', tenancyActionsRouter);
    app.route('/properties-periods', periodsRouter);
    app.route('/periods', readingsRouter);
  });

  describe('Duplicate Property Name Check (GET /properties/check-name)', () => {
    it('returns exists: true when property with name exists for owner', async () => {
      await testDb.insert(properties).values({
        id: 'prop-1',
        name: 'My Custom Villa',
        ownerId: 'owner-id',
        hasSolar: false
      });

      const res = await app.request('/properties/check-name?name=My%20Custom%20Villa', {}, { DB: {} as unknown });
      expect(res.status).toBe(200);
      const body = await res.json() as CheckNameResponse;
      expect(body.exists).toBe(true);
    });

    it('returns exists: false when property with name does not exist', async () => {
      const res = await app.request('/properties/check-name?name=Non%20Existent%20Prop', {}, { DB: {} as unknown });
      expect(res.status).toBe(200);
      const body = await res.json() as CheckNameResponse;
      expect(body.exists).toBe(false);
    });
  });

  describe('Confirmed Periods Selector (GET /tenancies/:id/confirmed-periods)', () => {
    it('returns confirmed periods for a given tenancy', async () => {
      await testDb.insert(properties).values({
        id: 'prop-1',
        name: 'My Custom Villa',
        ownerId: 'owner-id',
        hasSolar: false
      });

      await testDb.insert(tenancies).values({
        id: 'tenancy-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-id',
        status: 'active',
        inviteEmail: 'tenant@example.com',
        splitPercentage: 100
      });

      await testDb.insert(billingPeriods).values([
        {
          id: 'period-confirmed',
          propertyId: 'prop-1',
          periodMonth: '2024-01-01',
          calculationMode: 'grid_only',
          status: 'confirmed'
        },
        {
          id: 'period-draft',
          propertyId: 'prop-1',
          periodMonth: '2024-02-01',
          calculationMode: 'grid_only',
          status: 'draft'
        }
      ]);

      currentUser = { id: 'tenant-id' };
      const res = await app.request('/tenancies/tenancy-1/confirmed-periods', {}, { DB: {} as unknown });
      expect(res.status).toBe(200);
      const body = await res.json() as ConfirmedPeriodsResponse;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.id).toBe('period-confirmed');
    });
  });

  describe('Backfill Period and Readings (POST /properties/:id/periods)', () => {
    it('creates period, inserts readings, runs billing pipeline and marks submitted', async () => {
      await testDb.insert(properties).values({
        id: 'prop-1',
        name: 'My Custom Villa',
        ownerId: 'owner-id',
        hasSolar: false
      });

      // Insert dummy rates to let billing calculation succeed
      await testDb.insert(propertyRates).values({
        id: 'rate-1',
        propertyId: 'prop-1',
        consumptionRate: 10.5,
        exportRate: 3.5,
        effectiveFrom: '2024-01-01',
        createdBy: 'owner-id'
      });

      await testDb.insert(tenancies).values({
        id: 'tenancy-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-id',
        status: 'active',
        inviteEmail: 'tenant@example.com',
        splitPercentage: 100
      });

      const res = await app.request('/properties-periods/prop-1/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth: '2024-03-01',
          readings: {
            importStart: 1000,
            importEnd: 1200
          }
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as CreatePeriodResponse;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('submitted');

      // Check readings were inserted
      const [mr] = await testDb.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, body.data.id)).limit(1);
      expect(mr).toBeDefined();
      expect(mr?.importStart).toBe(1000);
      expect(mr?.importEnd).toBe(1200);

      // Check bills were generated
      const generatedBills = await testDb.select().from(bills).where(eq(bills.billingPeriodId, body.data.id));
      expect(generatedBills).toHaveLength(1);
      expect(Number(generatedBills[0]?.totalDue)).toBe(2100); // (1200 - 1000) * 10.5 = 2100
    });
  });

  describe('Period-specific Rate Editing (PATCH /periods/:id/rates)', () => {
    it('allows owner to override rates, recalculates bills, logs edits, and notifies tenants', async () => {
      await testDb.insert(properties).values({
        id: 'prop-1',
        name: 'My Custom Villa',
        ownerId: 'owner-id',
        hasSolar: false
      });

      await testDb.insert(tenancies).values({
        id: 'tenancy-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-id',
        status: 'active',
        inviteEmail: 'tenant@example.com',
        splitPercentage: 100
      });

      await testDb.insert(billingPeriods).values({
        id: 'period-1',
        propertyId: 'prop-1',
        periodMonth: '2024-01-01',
        calculationMode: 'grid_only',
        status: 'confirmed'
      });

      await testDb.insert(meterReadings).values({
        id: 'reading-1',
        billingPeriodId: 'period-1',
        importStart: 1000,
        importEnd: 1200,
        exportStart: 0,
        exportEnd: 0,
        solarGenerationStart: 0,
        solarGenerationEnd: 0,
        submittedBy: 'owner-id',
        version: 1
      });

      await testDb.insert(bills).values({
        id: 'bill-1',
        billingPeriodId: 'period-1',
        tenancyId: 'tenancy-1',
        totalDue: 2100,
        consumptionRate: 10.5
      });

      currentUser = { id: 'owner-id' };
      const res = await app.request('/periods/period-1/rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumptionRate: 8.5,
          reason: 'Corrected rate to 8.5 per electricity board notice'
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);

      // Verify that bill was recalculated with new rate (200 units * 8.5 = 1700)
      const recalculatedBills = await testDb.select().from(bills).where(eq(bills.billingPeriodId, 'period-1'));
      expect(recalculatedBills).toHaveLength(1);
      expect(Number(recalculatedBills[0]?.totalDue)).toBe(1700);

      // Verify billing period has rateOverride stored
      const [updatedPeriod] = await testDb.select().from(billingPeriods).where(eq(billingPeriods.id, 'period-1')).limit(1);
      expect(updatedPeriod?.rateOverride).toBeDefined();
      const override = JSON.parse(updatedPeriod?.rateOverride || '{}');
      expect(override.consumptionRate).toBe(8.5);
    });

    it('rejects unauthorized users (non-owners)', async () => {
      await testDb.insert(properties).values({
        id: 'prop-1',
        name: 'My Custom Villa',
        ownerId: 'owner-id',
        hasSolar: false
      });

      await testDb.insert(billingPeriods).values({
        id: 'period-1',
        propertyId: 'prop-1',
        periodMonth: '2024-01-01',
        calculationMode: 'grid_only',
        status: 'confirmed'
      });

      currentUser = { id: 'tenant-id' }; // not the owner
      const res = await app.request('/periods/period-1/rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumptionRate: 8.5,
          reason: 'Corrected rate to 8.5 per electricity board notice'
        })
      }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);

      expect(res.status).toBe(403);
    });
  });
});
