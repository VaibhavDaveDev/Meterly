import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

let currentUser: { id: string; email?: string } = { id: "test-user-id" };

vi.mock("../middleware/auth", () => ({
  authMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>
  ) => {
    c.set("user", currentUser);
    await next();
  },
}));

import { sendEmail } from "../lib/email";

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { testDb } from "../../test/setup";
import type { Database } from "../../db";
import type { Bindings } from "../app";
import { eq } from "drizzle-orm";
import {
  properties,
  user,
  tenancies,
  bills,
  billingPeriods,
  meterReadings,
  editRequests,
  notifications,
  billPhotos,
  r2CleanupBacklog,
} from "../../db/schema";
import { tenancyActionsRouter } from "./tenancy-actions";
import { sweepOrphanedPropertyData } from "../lib/property-cleanup";

describe("Tenancy Actions API", () => {
  let app: Hono;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
    vi.clearAllMocks();

    await testDb.delete(r2CleanupBacklog);
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
      {
        id: "owner-id",
        name: "Owner User",
        email: "owner@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "tenant-id",
        name: "Tenant User",
        email: "tenant@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "stranger-id",
        name: "Stranger User",
        email: "stranger@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    app = new Hono();
    app.route("/tenancies", tenancyActionsRouter);
  });

  const setupProperty = async () => {
    const id = "prop-" + Math.random();
    const [prop] = await testDb
      .insert(properties)
      .values({
        id,
        name: "Test Prop",
        ownerId: "owner-id",
        address: "123 Test St",
        hasSolar: true,
      })
      .returning();
    return prop;
  };

  const setupTenancy = async (
    propertyId: string,
    status: "invited" | "active" | "inactive" = "invited",
    inviteEmail = "tenant@example.com"
  ) => {
    const id = "tenancy-" + Math.random();
    const [tenancy] = await testDb
      .insert(tenancies)
      .values({
        id,
        propertyId,
        status,
        inviteEmail,
        inviteToken: status === "invited" ? "secret-token" : null,
        tenantId: status !== "invited" ? "tenant-id" : null,
        splitPercentage: 100,
        invitedAt: new Date(Date.now() - 90000000), // > 24 hours in the past
      })
      .returning();
    return tenancy;
  };

  // 1. Accept Invitation Success
  it("accepts invitation successfully", async () => {
    const prop = await setupProperty();
    await setupTenancy(prop.id, "invited");

    currentUser = { id: "tenant-id", email: "tenant@example.com" };

    const req = new Request("http://localhost/tenancies/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "secret-token" }),
    });

    const res = await app.request(req, {}, { DB: {} as unknown }, {
      waitUntil: () => {},
    } as unknown as ExecutionContext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const [updated] = await testDb.select().from(tenancies);
    expect(updated.status).toBe("active");
    expect(updated.tenantId).toBe("tenant-id");
    expect(updated.inviteToken).toBeNull();
  });

  // 2. Accept Invitation Fails (Invalid Token)
  it("fails to accept with invalid token", async () => {
    currentUser = { id: "tenant-id", email: "tenant@example.com" };
    const req = new Request("http://localhost/tenancies/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "bad-token" }),
    });
    const res = await app.request(req, {}, { DB: {} as unknown }, {
      waitUntil: () => {},
    } as unknown as ExecutionContext);
    expect(res.status).toBe(404);
  });

  // 3. Resend Invite Success
  it("resends invite email successfully", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "invited");

    currentUser = { id: "owner-id" };
    const res = await app.request(
      `/tenancies/${t.id}/resend-invite`,
      { method: "POST" },
      { DB: {} as unknown, BETTER_AUTH_URL: "http://auth" },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: "tenant@example.com",
        subject: expect.stringContaining("invited"),
      })
    );
  });

  // 4. Resend Invite Rate Limit
  it("blocks resend invite if too recent", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-" + Math.random(),
        propertyId: prop.id,
        status: "invited",
        inviteEmail: "tenant@example.com",
        inviteToken: "secret-token",
        invitedAt: new Date(), // just now
      })
      .returning();

    currentUser = { id: "owner-id" };
    const res = await app.request(
      `/tenancies/${t.id}/resend-invite`,
      { method: "POST" },
      { DB: {} as unknown, BETTER_AUTH_URL: "http://auth" },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(429);
  });

  // 5. Leave Tenancy Success
  it("leaves tenancy successfully", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "active");

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}/leave`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(200);
    const [updated] = await testDb.select().from(tenancies);
    expect(updated.status).toBe("inactive");
    expect(updated.leftAt).not.toBeNull();
  });

  // 6. Leave Tenancy blocks Owner Solo Tenancy
  it("blocks owner from leaving auto-created solo tenancy", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-" + Math.random(),
        propertyId: prop.id,
        status: "active",
        tenantId: "owner-id",
        isOwnerTenancy: true,
      })
      .returning();

    currentUser = { id: "owner-id" };
    const res = await app.request(
      `/tenancies/${t.id}/leave`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("OWNER_TENANCY");
  });

  // 7. Archive Tenancy Success
  it("archives inactive tenancy successfully", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "inactive");

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}/archive`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(200);
    const [updated] = await testDb.select().from(tenancies);
    expect(updated.archivedByTenantAt).not.toBeNull();
  });

  // 8. Archive Tenancy Fails for Active Tenancy
  it("blocks archiving active tenancy", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "active");

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}/archive`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(409);
  });

  // 9. Unarchive Tenancy
  it("unarchives tenancy successfully", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-" + Math.random(),
        propertyId: prop.id,
        status: "inactive",
        tenantId: "tenant-id",
        archivedByTenantAt: new Date(),
      })
      .returning();

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}/unarchive`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(200);
    const [updated] = await testDb.select().from(tenancies);
    expect(updated.archivedByTenantAt).toBeNull();
  });

  // 10. Get Tenancy Overview (Auth Check)
  it("denies access to get tenancy overview for stranger", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "active");

    currentUser = { id: "stranger-id" };
    const res = await app.request(
      `/tenancies/${t.id}`,
      {},
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(404);
  });

  // 11. Get Bills (Auth Check - owner and tenant only)
  it("allows tenant to get their bills but not strangers", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "active");

    // Stranger
    currentUser = { id: "stranger-id" };
    let res = await app.request(
      `/tenancies/${t.id}/bills`,
      {},
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(res.status).toBe(403);

    // Tenant
    currentUser = { id: "tenant-id" };
    res = await app.request(
      `/tenancies/${t.id}/bills`,
      {},
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(res.status).toBe(200);

    // Owner
    currentUser = { id: "owner-id" };
    res = await app.request(
      `/tenancies/${t.id}/bills`,
      {},
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(res.status).toBe(200);
  });

  // 12. Delete Tenancy Success
  it("deletes inactive tenancy explicitly and sets deletedByTenantAt", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "inactive");

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}`,
      { method: "DELETE" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(200);
    const [updated] = await testDb
      .select()
      .from(tenancies)
      .where(eq(tenancies.id, t.id));
    expect(updated.deletedByTenantAt).not.toBeNull();
  });

  // 13. Delete Tenancy Fails for Active Tenancy
  it("blocks deleting active tenancy with 409", async () => {
    const prop = await setupProperty();
    const t = await setupTenancy(prop.id, "active");

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}`,
      { method: "DELETE" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ACTIVE_TENANCY");
  });

  // 14. Delete Tenancy Fails if already deleted
  it("returns 404 when trying to delete already-deleted tenancy", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-already-del",
        propertyId: prop.id,
        status: "inactive",
        tenantId: "tenant-id",
        deletedByTenantAt: new Date(),
      })
      .returning();

    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${t.id}`,
      { method: "DELETE" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(res.status).toBe(404);
  });

  // 15. Data access routes return 404 for deleted tenancy
  it("returns 404 on get bills, archive, and unarchive after tenancy is deleted by tenant", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-del-guard",
        propertyId: prop.id,
        status: "inactive",
        tenantId: "tenant-id",
        deletedByTenantAt: new Date(),
      })
      .returning();

    currentUser = { id: "tenant-id" };

    // Get bills
    const billsRes = await app.request(
      `/tenancies/${t.id}/bills`,
      {},
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(billsRes.status).toBe(404);

    // Archive
    const archRes = await app.request(
      `/tenancies/${t.id}/archive`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(archRes.status).toBe(404);

    // Unarchive
    const unarchRes = await app.request(
      `/tenancies/${t.id}/unarchive`,
      { method: "PATCH" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(unarchRes.status).toBe(404);
  });

  // 16. sweepOrphanedPropertyData preserves data when tenant has only archived (hidden)
  it("sweepOrphanedPropertyData preserves records when tenant only archived (hid) tenancy", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-archived-only",
        propertyId: prop.id,
        status: "property_deleted",
        tenantId: "tenant-id",
        isOwnerTenancy: false,
        archivedByTenantAt: new Date(), // Tenant hid the property
        deletedByTenantAt: null, // NOT deleted by tenant
      })
      .returning();

    await testDb.insert(billingPeriods).values({
      id: "bp-archived-test",
      propertyId: prop.id,
      periodMonth: "2024-01",
      calculationMode: "grid_only",
      status: "confirmed",
    });

    await testDb.insert(bills).values({
      id: "bill-archived-test",
      billingPeriodId: "bp-archived-test",
      tenancyId: t.id,
      totalDue: 50,
      status: "paid",
    });

    // Owner deletes property from properties table
    await testDb.delete(properties).where(eq(properties.id, prop.id));

    // Run sweep
    const swept = await sweepOrphanedPropertyData(
      testDb as unknown as Database,
      {} as unknown as Bindings,
      prop.id
    );
    expect(swept).toBe(false);

    // Verify billing periods, bills, and tenancies still exist
    const remainingPeriods = await testDb
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.propertyId, prop.id));
    expect(remainingPeriods.length).toBe(1);

    const remainingBills = await testDb
      .select()
      .from(bills)
      .where(eq(bills.tenancyId, t.id));
    expect(remainingBills.length).toBe(1);

    const remainingTenancies = await testDb
      .select()
      .from(tenancies)
      .where(eq(tenancies.id, t.id));
    expect(remainingTenancies.length).toBe(1);
  });

  // 17. sweepOrphanedPropertyData wipes records when owner deleted property AND tenant explicitly deleted tenancy
  it("sweepOrphanedPropertyData wipes records when owner deleted property AND tenant explicitly deleted tenancy", async () => {
    const prop = await setupProperty();
    const [t] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-explicit-del",
        propertyId: prop.id,
        status: "property_deleted",
        tenantId: "tenant-id",
        isOwnerTenancy: false,
        deletedByTenantAt: new Date(), // Tenant explicitly deleted
      })
      .returning();

    await testDb.insert(billingPeriods).values({
      id: "bp-del-test",
      propertyId: prop.id,
      periodMonth: "2024-01",
      calculationMode: "grid_only",
      status: "confirmed",
    });

    await testDb.insert(bills).values({
      id: "bill-del-test",
      billingPeriodId: "bp-del-test",
      tenancyId: t.id,
      totalDue: 50,
      status: "paid",
    });

    // Owner deletes property
    await testDb.delete(properties).where(eq(properties.id, prop.id));

    // Run sweep
    const swept = await sweepOrphanedPropertyData(
      testDb as unknown as Database,
      {} as unknown as Bindings,
      prop.id
    );
    expect(swept).toBe(true);

    // Verify all cleaned up
    const remainingPeriods = await testDb
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.propertyId, prop.id));
    expect(remainingPeriods.length).toBe(0);

    const remainingBills = await testDb
      .select()
      .from(bills)
      .where(eq(bills.tenancyId, t.id));
    expect(remainingBills.length).toBe(0);

    const remainingTenancies = await testDb
      .select()
      .from(tenancies)
      .where(eq(tenancies.propertyId, prop.id));
    expect(remainingTenancies.length).toBe(0);
  });

  // 18. sweepOrphanedPropertyData sweeps solo mode property immediately upon owner delete
  it("sweepOrphanedPropertyData sweeps solo mode property immediately on owner delete", async () => {
    const prop = await setupProperty();
    await testDb.insert(tenancies).values({
      id: "tenancy-solo-owner",
      propertyId: prop.id,
      status: "property_deleted",
      tenantId: "owner-id",
      isOwnerTenancy: true,
      deletedByTenantAt: null,
    });

    await testDb.insert(billingPeriods).values({
      id: "bp-solo-test",
      propertyId: prop.id,
      periodMonth: "2024-01",
      calculationMode: "grid_only",
      status: "confirmed",
    });

    // Owner deletes property
    await testDb.delete(properties).where(eq(properties.id, prop.id));

    // Run sweep
    const swept = await sweepOrphanedPropertyData(
      testDb as unknown as Database,
      {} as unknown as Bindings,
      prop.id
    );
    expect(swept).toBe(true);

    const remainingPeriods = await testDb
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.propertyId, prop.id));
    expect(remainingPeriods.length).toBe(0);
  });

  // 19. sweepOrphanedPropertyData: R2 fails on first sweep, succeeds via backlog on retry
  it("sweepOrphanedPropertyData enqueues failed R2 keys to backlog and drains on next sweep", async () => {
    const prop = await setupProperty();

    // Insert a real tenant who has deleted their tenancy
    await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-r2-retry",
        propertyId: prop.id,
        status: "property_deleted",
        tenantId: "tenant-id",
        isOwnerTenancy: false,
        deletedByTenantAt: new Date(),
      })
      .returning();

    await testDb.insert(billingPeriods).values({
      id: "bp-r2-retry",
      propertyId: prop.id,
      periodMonth: "2024-01",
      calculationMode: "grid_only",
      status: "confirmed",
    });

    await testDb.insert(billPhotos).values({
      id: "photo-r2-retry",
      propertyId: prop.id,
      billingPeriodId: "bp-r2-retry",
      uploadedBy: "tenant-id",
      objectKey: `${prop.id}/bp-r2-retry/tenant-id/1234.webp`,
      purpose: "import_meter",
      version: 1,
      status: "active",
    });

    // Delete property (owner side already done)
    await testDb.delete(properties).where(eq(properties.id, prop.id));

    // R2 mock: first delete call throws, second succeeds
    const deleteMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("R2 unavailable"))
      .mockRejectedValueOnce(new Error("R2 unavailable"))
      .mockRejectedValueOnce(new Error("R2 unavailable"))
      .mockResolvedValue(undefined);

    const mockEnv = {
      BILL_PHOTOS: { delete: deleteMock },
    } as unknown as Bindings;

    // --- Sweep 1: R2 fails ---
    const swept1 = await sweepOrphanedPropertyData(
      testDb as unknown as Database,
      mockEnv,
      prop.id
    );
    // Sweep should still complete (DB cleaned up)
    expect(swept1).toBe(true);

    // DB billing history should be gone
    const remainingPeriods = await testDb
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.propertyId, prop.id));
    expect(remainingPeriods.length).toBe(0);

    // Backlog should have the failed key
    const backlogRows = await testDb
      .select()
      .from(r2CleanupBacklog)
      .where(eq(r2CleanupBacklog.propertyId, prop.id));
    expect(backlogRows.length).toBe(1);
    expect(backlogRows[0].attemptCount).toBe(3); // R2_MAX_RETRIES

    // --- Sweep 2 (next organic delete): backlog drain should clear it ---
    // Create a new property just to trigger another sweep call
    const prop2 = await setupProperty();
    await testDb.delete(properties).where(eq(properties.id, prop2.id));

    await sweepOrphanedPropertyData(
      testDb as unknown as Database,
      mockEnv,
      prop2.id // different property — but drainR2Backlog is global
    );

    // Backlog should now be empty (drain succeeded)
    const backlogAfter = await testDb.select().from(r2CleanupBacklog);
    expect(backlogAfter.length).toBe(0);

    // R2 delete was called: 3 times (retries in sweep 1) + 1 time (drain in sweep 2)
    expect(deleteMock).toHaveBeenCalledTimes(4);
  });

  // ponytail: Regression test for owner bill access after tenant deletion
  it("owner can view bills for a tenant-deleted tenancy (regression)", async () => {
    const prop = await setupProperty();

    // Setup an active tenancy for the tenant
    const [tenancy] = await testDb
      .insert(tenancies)
      .values({
        id: "tenancy-deleted-" + Math.random(),
        propertyId: prop.id,
        status: "property_deleted",
        tenantId: "tenant-id",
        splitPercentage: 100,
        deletedByTenantAt: new Date(), // Tenant has deleted their record
      })
      .returning();

    // Insert a billing period + bill so there is data to return
    const [period] = await testDb
      .insert(billingPeriods)
      .values({
        id: "period-" + Math.random(),
        propertyId: prop.id,
        periodMonth: `${new Date().getFullYear()}-01`,
        calculationMode: "solar",
        status: "confirmed",
      })
      .returning();

    await testDb.insert(bills).values({
      id: "bill-" + Math.random(),
      tenancyId: tenancy.id,
      billingPeriodId: period.id,
      totalDue: 120,
      status: "pending",
      splitPercentage: 100,
    });

    // Owner can access the bills even after tenant deletion
    currentUser = { id: "owner-id" };
    const ownerRes = await app.request(
      `/tenancies/${tenancy.id}/bills`,
      { method: "GET" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(ownerRes.status).toBe(200);
    const ownerBody = (await ownerRes.json()) as { bills: unknown[] };
    expect(ownerBody.bills.length).toBeGreaterThan(0);

    // Tenant cannot access the bills after deletion
    currentUser = { id: "tenant-id" };
    const tenantRes = await app.request(
      `/tenancies/${tenancy.id}/bills`,
      { method: "GET" },
      { DB: {} as unknown },
      { waitUntil: () => {} } as unknown as ExecutionContext
    );
    expect(tenantRes.status).toBe(404);
  });
});
