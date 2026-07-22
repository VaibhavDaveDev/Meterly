import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentUser: { id: string; email?: string } = { id: 'test-user-id' };

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', currentUser);
    await next();
  }
}));

vi.mock('../lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  checkEmailRateLimit: vi.fn().mockReturnValue(true),
}));

import { testDb } from '../../test/setup';
import { properties, tenancies, billingPeriods, bills, meterReadings, user } from '../../db/schema';
import { app } from '../app';
import type { Bindings } from '../app';

describe('Error Path HTTP Tests', () => {
  beforeEach(async () => {
    // Clear relevant tables
    await testDb.delete(bills);
    await testDb.delete(meterReadings);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);
    
    // Insert dummy users
    await testDb.insert(user).values([
      { id: 'owner-id', name: 'Owner User', email: 'owner@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'tenant-id', name: 'Tenant User', email: 'tenant@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'other-id', name: 'Other User', email: 'other@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
  });

  let backgroundTasks: Promise<unknown>[] = [];

  const requestAs = async (path: string, method: string, body: unknown, userId: string) => {
    let email;
    if (userId === 'owner-id') email = 'owner@example.com';
    else if (userId === 'tenant-id') email = 'tenant@example.com';
    else email = 'other@example.com';
    currentUser = { id: userId, email };
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: {
        'x-test-user-id': userId,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const response = await app.request(req, undefined, {
      DB: testDb as unknown as Bindings['DB'],
    }, {
      waitUntil: (promise: Promise<unknown>) => {
        backgroundTasks.push(promise.catch(console.error));
      },
      passThroughOnException: () => {}
    } as unknown as ExecutionContext);
    
    return response;
  };

  it('GET /api/properties/:id -> 403 when property does not exist', async () => {
    const res = await requestAs('/api/properties/fake-id', 'GET', null, 'owner-id');
    expect(res.status).toBe(403);
  });

  it('POST /api/properties/:id/periods -> 403 when property does not exist', async () => {
    const res = await requestAs('/api/properties/fake-id/periods', 'POST', { periodMonth: '2025-01-01' }, 'owner-id');
    expect(res.status).toBe(403);
  });

  it('POST /api/periods/:id/readings -> 404 when period does not exist', async () => {
    const res = await requestAs('/api/periods/fake-period-id/readings', 'POST', { solarGenerationEnd: 0, exportEnd: 0, importEnd: 100 }, 'tenant-id');
    expect(res.status).toBe(404);
  });

  it('POST /api/periods/:id/readings -> 403 when requester is third-party', async () => {
    const resProp = await requestAs('/api/properties', 'POST', { name: 'Test Prop', hasSolar: false }, 'owner-id');
    const propId = ((await resProp.json()) as { data: { id: string } }).data.id;
    
    const pRes = await requestAs(`/api/properties/${propId}/periods`, 'POST', { periodMonth: '2025-02-01' }, 'owner-id');
    const periodId = ((await pRes.json()) as { data: { id: string } }).data.id;

    // Third party tries to submit reading
    const res = await requestAs(`/api/periods/${periodId}/readings`, 'POST', { importEnd: 100 }, 'other-id');
    expect(res.status).toBe(403);
  });

  it('GET /api/bills/:id -> 404 when bill does not exist', async () => {
    const res = await requestAs('/api/bills/fake-bill-id', 'GET', null, 'owner-id');
    expect(res.status).toBe(404);
  });

  it('GET /api/bills/:id -> 403 when accessed by non-owner, non-tenant user', async () => {
    // Setup
    const resProp = await requestAs('/api/properties', 'POST', { name: 'Test Prop', hasSolar: false }, 'owner-id');
    const propId = ((await resProp.json()) as { data: { id: string } }).data.id;
    
    // Add Rates
    await requestAs(`/api/properties/${propId}/rates`, 'POST', { effectiveFrom: '2025-01-01', consumptionRate: 0.25, exportRate: 0.05 }, 'owner-id');

    // Add tenant
    const resTenant = await requestAs(`/api/properties/${propId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    const inviteToken = ((await resTenant.json()) as { data: { inviteToken: string } }).data.inviteToken;
    await requestAs(`/api/invites/${inviteToken}/accept`, 'POST', null, 'tenant-id');

    const pRes = await requestAs(`/api/properties/${propId}/periods`, 'POST', { periodMonth: '2025-02-01' }, 'owner-id');
    const periodId = ((await pRes.json()) as { data: { id: string } }).data.id;

    await requestAs(`/api/periods/${periodId}/readings`, 'POST', { importEnd: 100 }, 'tenant-id');
    
    await Promise.all(backgroundTasks);
    backgroundTasks = [];

    // Get Bill ID
    const billsRes = await requestAs(`/api/properties/${propId}/bills`, 'GET', null, 'owner-id');
    const billsData = (await billsRes.json()) as { data: { bills: Array<{ tenants: Array<{ billId: string }> }> } };
    
    if (!billsData.data.bills[0] || !billsData.data.bills[0].tenants[0]) {
      throw new Error('Bill was not generated. Response: ' + JSON.stringify(billsData));
    }
    const billId = billsData.data.bills[0].tenants[0].billId;

    // Third party user tries to get it
    const res = await requestAs(`/api/bills/${billId}`, 'GET', null, 'other-id');
    expect(res.status).toBe(403);
  });

  it('DELETE /api/properties/:id -> 200 (cascade) when active tenancies exist', async () => {
    const resProp = await requestAs('/api/properties', 'POST', { name: 'Test Prop', hasSolar: false }, 'owner-id');
    const propId = ((await resProp.json()) as { data: { id: string } }).data.id;
    
    const resTenant = await requestAs(`/api/properties/${propId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    const inviteToken = ((await resTenant.json()) as { data: { inviteToken: string } }).data.inviteToken;
    await requestAs(`/api/invites/${inviteToken}/accept`, 'POST', null, 'tenant-id');

    const res = await requestAs(`/api/properties/${propId}`, 'DELETE', null, 'owner-id');
    expect(res.status).toBe(200);
  });

  it('PATCH /api/properties/:id/mode -> 409 (ACTIVE_TENANTS_EXIST) when toggling solo with tenants', async () => {
    const resProp = await requestAs('/api/properties', 'POST', { name: 'Test Prop', hasSolar: false }, 'owner-id');
    const propId = ((await resProp.json()) as { data: { id: string } }).data.id;
    
    const resTenant = await requestAs(`/api/properties/${propId}/tenancies/invite`, 'POST', { email: 'tenant@example.com' }, 'owner-id');
    const inviteToken = ((await resTenant.json()) as { data: { inviteToken: string } }).data.inviteToken;
    await requestAs(`/api/invites/${inviteToken}/accept`, 'POST', null, 'tenant-id');

    const res = await requestAs(`/api/properties/${propId}/mode`, 'PATCH', { soloMode: true }, 'owner-id');
    expect(res.status).toBe(409);
    const errRes = (await res.json()) as { error: { code: string } };
    expect(errRes.error.code).toBe('ACTIVE_TENANTS_EXIST');
  });
});
