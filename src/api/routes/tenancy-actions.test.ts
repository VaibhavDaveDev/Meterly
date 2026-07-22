import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

let currentUser: { id: string; email?: string } = { id: 'test-user-id' };

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', currentUser);
    await next();
  }
}));

import { sendEmail } from '../lib/email';

vi.mock('../lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { testDb } from '../../test/setup';
import { properties, user, tenancies, bills, billingPeriods, meterReadings, editRequests, notifications, billPhotos } from '../../db/schema';
import { tenancyActionsRouter } from './tenancy-actions';

describe('Tenancy Actions API', () => {
  let app: Hono;
  
  beforeEach(async () => {
    currentUser = { id: 'owner-id' };
    vi.clearAllMocks();

    await testDb.delete(notifications);
    await testDb.delete(editRequests);
    await testDb.delete(billPhotos);
    await testDb.delete(meterReadings);
    await testDb.delete(bills);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);
    
    // Insert users
    await testDb.insert(user).values([
      { id: 'owner-id', name: 'Owner User', email: 'owner@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'tenant-id', name: 'Tenant User', email: 'tenant@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'stranger-id', name: 'Stranger User', email: 'stranger@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }
    ]);

    app = new Hono();
    app.route('/tenancies', tenancyActionsRouter);
  });

  const setupProperty = async () => {
    const id = 'prop-' + Math.random();
    const [prop] = await testDb.insert(properties).values({
      id,
      name: 'Test Prop',
      ownerId: 'owner-id',
      address: '123 Test St',
      hasSolar: true
    }).returning();
    return prop;
  };

  const setupTenancy = async (propertyId: string, status: 'invited' | 'active' | 'inactive' = 'invited', inviteEmail = 'tenant@example.com') => {
    const id = 'tenancy-' + Math.random();
    const [tenancy] = await testDb.insert(tenancies).values({
      id,
      propertyId,
      status,
      inviteEmail,
      inviteToken: status === 'invited' ? 'secret-token' : null,
      tenantId: status !== 'invited' ? 'tenant-id' : null,
      splitPercentage: 100,
      invitedAt: new Date(Date.now() - 90000000) // > 24 hours in the past
    }).returning();
    return tenancy;
  };

  // 1. Accept Invitation Success
  it('accepts invitation successfully', async () => {
    const prop = await setupProperty();
    await setupTenancy(prop.id, 'invited');
    
    currentUser = { id: 'tenant-id', email: 'tenant@example.com' };
    
    const req = new Request('http://localhost/tenancies/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'secret-token' })
    });
    
    const res = await app.request(req, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const [updated] = await testDb.select().from(tenancies);
    expect(updated.status).toBe('active');
    expect(updated.tenantId).toBe('tenant-id');
    expect(updated.inviteToken).toBeNull();
  });

  // 2. Accept Invitation Fails (Invalid Token)
  it('fails to accept with invalid token', async () => {
    currentUser = { id: 'tenant-id', email: 'tenant@example.com' };
    const req = new Request('http://localhost/tenancies/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bad-token' })
    });
    const res = await app.request(req, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    expect(res.status).toBe(404);
  });

  // 3. Resend Invite Success
  it('resends invite email successfully', async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, 'invited');
    
    currentUser = { id: 'owner-id' };
    const res = await app.request(`/tenancies/${t.id}/resend-invite`, { method: 'POST' }, { DB: {} as unknown, BETTER_AUTH_URL: 'http://auth' }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'tenant@example.com',
        subject: expect.stringContaining('invited'),
      })
    );
  });

  // 4. Resend Invite Rate Limit
  it('blocks resend invite if too recent', async () => {
    const prop = await setupProperty();
    const [t] = await testDb.insert(tenancies).values({
      id: 'tenancy-' + Math.random(),
      propertyId: prop.id,
      status: 'invited',
      inviteEmail: 'tenant@example.com',
      inviteToken: 'secret-token',
      invitedAt: new Date() // just now
    }).returning();
    
    currentUser = { id: 'owner-id' };
    const res = await app.request(`/tenancies/${t.id}/resend-invite`, { method: 'POST' }, { DB: {} as unknown, BETTER_AUTH_URL: 'http://auth' }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(429);
  });

  // 5. Leave Tenancy Success
  it('leaves tenancy successfully', async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, 'active');
    
    currentUser = { id: 'tenant-id' };
    const res = await app.request(`/tenancies/${t.id}/leave`, { method: 'PATCH' }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(200);
    const [updated] = await testDb.select().from(tenancies);
    expect(updated.status).toBe('inactive');
    expect(updated.leftAt).not.toBeNull();
  });

  // 6. Leave Tenancy blocks Owner Solo Tenancy
  it('blocks owner from leaving auto-created solo tenancy', async () => {
    const prop = await setupProperty();
    const [t] = await testDb.insert(tenancies).values({
      id: 'tenancy-' + Math.random(),
      propertyId: prop.id,
      status: 'active',
      tenantId: 'owner-id',
      isOwnerTenancy: true
    }).returning();
    
    currentUser = { id: 'owner-id' };
    const res = await app.request(`/tenancies/${t.id}/leave`, { method: 'PATCH' }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('OWNER_TENANCY');
  });

  // 7. Archive Tenancy Success
  it('archives inactive tenancy successfully', async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, 'inactive');
    
    currentUser = { id: 'tenant-id' };
    const res = await app.request(`/tenancies/${t.id}/archive`, { method: 'PATCH' }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(200);
    const [updated] = await testDb.select().from(tenancies);
    expect(updated.archivedByTenantAt).not.toBeNull();
  });

  // 8. Archive Tenancy Fails for Active Tenancy
  it('blocks archiving active tenancy', async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, 'active');
    
    currentUser = { id: 'tenant-id' };
    const res = await app.request(`/tenancies/${t.id}/archive`, { method: 'PATCH' }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(409);
  });

  // 9. Unarchive Tenancy
  it('unarchives tenancy successfully', async () => {
    const prop = await setupProperty();
    const [t] = await testDb.insert(tenancies).values({
      id: 'tenancy-' + Math.random(),
      propertyId: prop.id,
      status: 'inactive',
      tenantId: 'tenant-id',
      archivedByTenantAt: new Date()
    }).returning();
    
    currentUser = { id: 'tenant-id' };
    const res = await app.request(`/tenancies/${t.id}/unarchive`, { method: 'PATCH' }, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(200);
    const [updated] = await testDb.select().from(tenancies);
    expect(updated.archivedByTenantAt).toBeNull();
  });

  // 10. Get Tenancy Overview (Auth Check)
  it('denies access to get tenancy overview for stranger', async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, 'active');
    
    currentUser = { id: 'stranger-id' };
    const res = await app.request(`/tenancies/${t.id}`, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    
    expect(res.status).toBe(404);
  });

  // 11. Get Bills (Auth Check - owner and tenant only)
  it('allows tenant to get their bills but not strangers', async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, 'active');
    
    // Stranger
    currentUser = { id: 'stranger-id' };
    let res = await app.request(`/tenancies/${t.id}/bills`, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    expect(res.status).toBe(403);

    // Tenant
    currentUser = { id: 'tenant-id' };
    res = await app.request(`/tenancies/${t.id}/bills`, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    expect(res.status).toBe(200);

    // Owner
    currentUser = { id: 'owner-id' };
    res = await app.request(`/tenancies/${t.id}/bills`, {}, { DB: {} as unknown }, { waitUntil: () => {} } as unknown as ExecutionContext);
    expect(res.status).toBe(200);
  });
});
