/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth middleware to identify as test user
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    const userId = (c as any).req?.header('x-test-user-id') || 'owner-id';
    const email = userId === 'owner-id' ? 'owner@example.com' : 'tenant@example.com';
    c.set('user', { id: userId, email });
    await next();
  }
}));

import { sendEmail } from '../lib/email';

vi.mock('../lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  checkEmailRateLimit: vi.fn().mockReturnValue(true),
}));

import { testDb } from '../../test/setup';
import { eq } from 'drizzle-orm';
import { properties, tenancies, billingPeriods, bills, meterReadings, user, propertyRates, notifications, customCharges, meterReadingEdits, editRequests } from '../../db/schema';
import { app } from '../app';

describe('Integration Flows', () => {
  beforeEach(async () => {
    vi.mocked(sendEmail).mockClear();
    // Clear all relevant tables
    await testDb.delete(notifications);
    await testDb.delete(editRequests);
    await testDb.delete(meterReadingEdits);
    await testDb.delete(bills);
    await testDb.delete(meterReadings);
    await testDb.delete(customCharges);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(propertyRates);
    await testDb.delete(properties);
    await testDb.delete(user);
    await testDb.delete(user);
    
    // Insert dummy users
    await testDb.insert(user).values([
      { id: 'owner-id', name: 'Owner User', email: 'owner@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'tenant-id', name: 'Tenant User', email: 'tenant@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }
    ]);
  });

  // Helper to wait for background tasks in tests
  let backgroundTasks: Promise<any>[] = [];
  
  const requestAs = async (path: string, method: string, body: any, userId: string) => {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: {
        'x-test-user-id': userId,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const response = await app.request(req, undefined, {
      DB: testDb as any,
    }, {
      waitUntil: (promise: Promise<any>) => {
        backgroundTasks.push(promise.catch(console.error));
      },
      passThroughOnException: () => {}
    } as any);
    
    // For debugging
    if (response.status >= 400) {
      const cloned = response.clone();
      try {
        console.error(`Request Failed: ${method} ${path} -> ${response.status}`, await cloned.json());
      } catch (e) {
        console.error(`Request Failed: ${method} ${path} -> ${response.status} (non-JSON body)`);
      }
    }
    return response;
  };

  it('Flow 1: Create property -> invite -> accept -> submit -> bill -> pay', async () => {
    // 1. Owner creates a property
    let res = await requestAs('/api/properties', 'POST', { name: 'Main House', hasSolar: false }, 'owner-id');
    expect(res.status).toBe(200);
    const propRes = await res.json() as any;
    const propertyId = propRes.data.id;

    // Set some rates on the property
    res = await requestAs(`/api/properties/${propertyId}/rates`, 'POST', {
      consumptionRate: 10,
      exportRate: 0,
      effectiveFrom: '2020-01-01'
    }, 'owner-id');
    expect(res.status).toBe(200);

    // 2. Owner adds a tenant
    res = await requestAs(`/api/properties/${propertyId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    expect([200, 201]).toContain(res.status);
    const tenantRes = await res.json() as any;
    const inviteToken = tenantRes.data.inviteToken;

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'tenant@example.com',
        subject: expect.stringContaining('invited'),
      })
    );

    // 3. Tenant accepts invite
    res = await requestAs(`/api/invites/${inviteToken}/accept`, 'POST', null, 'tenant-id');
    expect(res.status).toBe(200);
    
    // Check tenancy became active
    const activeTenancies = await testDb.select().from(tenancies).where(eq(tenancies.propertyId, propertyId)).limit(1);
    expect(activeTenancies[0].status).toBe('active');

    // 4. Owner creates billing period for Jan 2025
    res = await requestAs(`/api/properties/${propertyId}/periods`, 'POST', { periodMonth: '2025-01-01' }, 'owner-id');
    expect(res.status).toBe(200);
    const periodRes = await res.json() as any;
    const periodId = periodRes.data.id;

    // 5. Tenant submits meter reading
    res = await requestAs(`/api/periods/${periodId}/readings`, 'POST', {
      solarGenerationEnd: 0,
      exportEnd: 0,
      importEnd: 100 // Started at 0 implicitly, ended at 100
    }, 'tenant-id');
    expect(res.status).toBe(200);

    // Because readingRequireApproval is false by default, it should be auto-approved and bill generated.
    // 6. Verify Bill is generated
    res = await requestAs(`/api/properties/${propertyId}/bills`, 'GET', null, 'owner-id');
    expect(res.status).toBe(200);
    const billsRes = await res.json() as any;
    expect(billsRes.data.bills.length).toBe(1);
    
    const periodGroup = billsRes.data.bills[0];
    const tenantBill = periodGroup.tenants[0];
    expect(tenantBill.status).toBe('pending');
    expect(periodGroup.totalConsumption).toBe(100);
    // Consumption cost = 100 * 10 = 1000
    // Total due = 1000
    expect(tenantBill.totalDue).toBe(1000);

    // 7. Owner marks bill as paid
    res = await requestAs(`/api/bills/${tenantBill.billId}/mark-paid`, 'PATCH', null, 'owner-id');
    expect(res.status).toBe(200);

    // 8. Verify Bill status
    res = await requestAs(`/api/bills/${tenantBill.billId}`, 'GET', null, 'owner-id');
    const finalBillRes = await res.json() as any;
    expect(finalBillRes.data.bill.status).toBe('paid');
  });

  it('Flow 2: Edit reading -> cascade recalc -> verify bills updated', async () => {
    // 1. Setup Property, Tenant, Rates
    const resProp = await requestAs('/api/properties', 'POST', { name: 'Cascade House', hasSolar: false }, 'owner-id');
    const propertyId = (await resProp.json() as any).data.id;
    await requestAs(`/api/properties/${propertyId}/rates`, 'POST', { consumptionRate: 10, exportRate: 0, effectiveFrom: '2020-01-01' }, 'owner-id');
    const resTenant = await requestAs(`/api/properties/${propertyId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    await requestAs(`/api/invites/${(await resTenant.json() as any).data.inviteToken}/accept`, 'POST', null, 'tenant-id');

    // 2. Create Jan and Feb periods
    const pJan = (await (await requestAs(`/api/properties/${propertyId}/periods`, 'POST', { periodMonth: '2025-01-01' }, 'owner-id')).json() as any).data.id;
    const pFeb = (await (await requestAs(`/api/properties/${propertyId}/periods`, 'POST', { periodMonth: '2025-02-01' }, 'owner-id')).json() as any).data.id;

    // 3. Submit Jan reading: 0 -> 100
    await requestAs(`/api/periods/${pJan}/readings`, 'POST', { solarGenerationEnd: 0, exportEnd: 0, importEnd: 100 }, 'tenant-id');
    
    // 4. Submit Feb reading: 100 -> 250 (150 consumed)
    await requestAs(`/api/periods/${pFeb}/readings`, 'POST', { solarGenerationEnd: 0, exportEnd: 0, importEnd: 250 }, 'tenant-id');

    await Promise.all(backgroundTasks);
    backgroundTasks = [];

    // 5. Verify bills
    let billsRes = await (await requestAs(`/api/properties/${propertyId}/bills`, 'GET', null, 'owner-id')).json() as any;
    let janBill = billsRes.data.bills.find((b: any) => b.periodMonth === '2025-01-01');
    let febBill = billsRes.data.bills.find((b: any) => b.periodMonth === '2025-02-01');
    expect(janBill.totalConsumption).toBe(100);
    expect(febBill.totalConsumption).toBe(150);

    // 6. EDIT Jan reading: 0 -> 80 (was 100)
    // This should change Jan consumption to 80, and Feb consumption to 250 - 80 = 170.
    await requestAs(`/api/periods/${pJan}/readings`, 'PATCH', { solarGenerationEnd: 0, exportEnd: 0, importEnd: 80, reason: 'Correcting mistyped reading' }, 'owner-id');
    
    // Wait for cascade recalculation
    await Promise.all(backgroundTasks);
    backgroundTasks = [];

    // 7. Verify bills again after cascade recalc
    billsRes = await (await requestAs(`/api/properties/${propertyId}/bills`, 'GET', null, 'owner-id')).json() as any;
    janBill = billsRes.data.bills.find((b: any) => b.periodMonth === '2025-01-01');
    febBill = billsRes.data.bills.find((b: any) => b.periodMonth === '2025-02-01');
    expect(janBill.totalConsumption).toBe(80);
    expect(febBill.totalConsumption).toBe(170); // Cascaded automatically!
  });

  it('Flow 3: Solo mode -> verify guard blocks when tenants exist', async () => {
    // 1. Create property
    let res = await requestAs('/api/properties', 'POST', { name: 'Solo House', hasSolar: false }, 'owner-id');
    const propertyId = (await res.json() as any).data.id;

    // 2. Enable Solo mode works because no active tenants exist
    res = await requestAs(`/api/properties/${propertyId}/mode`, 'PATCH', { soloMode: true }, 'owner-id');
    expect(res.status).toBe(200);

    // 3. Disable solo mode
    await requestAs(`/api/properties/${propertyId}/mode`, 'PATCH', { soloMode: false }, 'owner-id');

    // 4. Invite tenant and accept
    const resTenant = await requestAs(`/api/properties/${propertyId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    await requestAs(`/api/invites/${(await resTenant.json() as any).data.inviteToken}/accept`, 'POST', null, 'tenant-id');

    // 5. Attempt to enable solo mode again
    res = await requestAs(`/api/properties/${propertyId}/mode`, 'PATCH', { soloMode: true }, 'owner-id');
    
    // 6. Verify it is blocked
    expect(res.status).toBe(409);
    const errRes = await res.json() as any;
    expect(errRes.error.code).toBe('ACTIVE_TENANTS_EXIST');
  });

  it('Flow 4: Owner validation mode', async () => {
    // 1. Property with required approval
    let res = await requestAs('/api/properties', 'POST', { name: 'Strict House', hasSolar: false }, 'owner-id');
    const propertyId = (await res.json() as any).data.id;

    // Set some rates on the property
    await requestAs(`/api/properties/${propertyId}/rates`, 'POST', {
      consumptionRate: 10,
      exportRate: 0,
      effectiveFrom: '2020-01-01'
    }, 'owner-id');
    await requestAs(`/api/properties/${propertyId}/settings`, 'PATCH', { readingsRequireApproval: true }, 'owner-id');
    
    const resTenant = await requestAs(`/api/properties/${propertyId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    await requestAs(`/api/invites/${(await resTenant.json() as any).data.inviteToken}/accept`, 'POST', null, 'tenant-id');

    const pJan = (await (await requestAs(`/api/properties/${propertyId}/periods`, 'POST', { periodMonth: '2025-01-01' }, 'owner-id')).json() as any).data.id;

    // 2. Tenant submits reading
    res = await requestAs(`/api/periods/${pJan}/readings`, 'POST', { solarGenerationEnd: 0, exportEnd: 0, importEnd: 100 }, 'tenant-id');
    expect(res.status).toBe(200);

    await Promise.all(backgroundTasks);
    backgroundTasks = [];

    // 3. Bill should NOT be generated yet
    res = await requestAs(`/api/properties/${propertyId}/bills`, 'GET', null, 'owner-id');
    expect((await res.json() as any).data.bills[0].tenants.length).toBe(0);

    // Period status should be pending_approval
    // (In a real scenario we'd query periods, let's just approve it)

    // 4. Owner approves
    res = await requestAs(`/api/periods/${pJan}/approve`, 'PATCH', null, 'owner-id');
    expect(res.status).toBe(200);

    // Wait for bill generation tasks
    await Promise.all(backgroundTasks);
    backgroundTasks = [];

    // 5. Bill SHOULD be generated now
    res = await requestAs(`/api/properties/${propertyId}/bills`, 'GET', null, 'owner-id');
    expect((await res.json() as any).data.bills.length).toBe(1);
  });
});
