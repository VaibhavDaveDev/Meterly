/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import {
  user,
  properties,
  billingPeriods,
  tenancies,
  bills,
  meterReadings,
} from "../../db/schema";
import { billsRouter } from "./bills";

let currentUser: { id: string } = { id: "owner-id" };
vi.mock("../middleware/auth", () => ({
  authMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>
  ) => {
    c.set("user", currentUser);
    await next();
  },
}));
vi.mock("../lib/email", () => ({
  sendEmail: vi.fn(),
  checkEmailRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("../lib/notifications", () => ({ createNotification: vi.fn() }));

const mockEnv = { DB: {} };

describe("Bills API", () => {
  let app: Hono;
  let billId: string;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
    await testDb.delete(bills);
    await testDb.delete(meterReadings);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);

    await testDb.insert(user).values([
      {
        id: "owner-id",
        name: "Owner",
        email: "o@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "tenant-id",
        name: "Tenant",
        email: "t@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "stranger-id",
        name: "Stranger",
        email: "s@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await testDb
      .insert(properties)
      .values({ id: "p1", name: "Prop", ownerId: "owner-id", hasSolar: false });
    await testDb.insert(billingPeriods).values({
      id: "bp1",
      propertyId: "p1",
      periodMonth: "2024-01",
      calculationMode: "solar",
      status: "draft",
    });
    await testDb.insert(tenancies).values({
      id: "ten1",
      propertyId: "p1",
      tenantId: "tenant-id",
      status: "active",
    });
    await testDb.insert(meterReadings).values({
      id: "mr1",
      billingPeriodId: "bp1",
      submittedBy: "owner-id",
      solarGenerationEnd: 100,
      exportEnd: 0,
      importEnd: 0,
    });

    billId = "bill-1";
    await testDb.insert(bills).values({
      id: billId,
      billingPeriodId: "bp1",
      tenancyId: "ten1",
      totalDue: 1000,
      status: "pending",
    });

    app = new Hono();
    app.route("/bills", billsRouter);
  });

  it("returns 404 for unknown bill", async () => {
    const res = await app.request("/bills/nonexistent", {}, mockEnv as never);
    expect(res.status).toBe(404);
  });

  it("returns 403 for unauthorized user", async () => {
    currentUser = { id: "stranger-id" };
    const res = await app.request(`/bills/${billId}`, {}, mockEnv as never);
    expect(res.status).toBe(403);
  });

  it("returns 200 for the property owner", async () => {
    const res = await app.request(`/bills/${billId}`, {}, mockEnv as never);
    expect(res.status).toBe(200);
  });

  it("returns 200 for the tenant on the bill", async () => {
    currentUser = { id: "tenant-id" };
    const res = await app.request(`/bills/${billId}`, {}, mockEnv as never);
    expect(res.status).toBe(200);
  });

  it("mark-paid: returns markedPaidAt and markedPaidBy on successful update", async () => {
    // Tests the happy path where the post-update re-select succeeds.
    currentUser = { id: "owner-id" };
    const mockCtx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
    const res = await app.request(
      `/bills/${billId}/mark-paid`,
      {
        method: "PATCH",
      },
      mockEnv as never,
      mockCtx as never
    );

    const json = (await res.json()) as {
      data: { status: string; markedPaidAt: string; markedPaidBy: string };
    };
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("paid");
    expect(json.data.markedPaidAt).toBeTruthy();
    expect(json.data.markedPaidBy).toBe("owner-id");
  });

  it("mark-paid: returns defensive fallback object if post-update re-select returns no row", async () => {
    // Tests the fallback branch where the post-update query returns no row.
    currentUser = { id: "owner-id" };
    const mockCtx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };

    // We add a temporary trigger to delete the bill as soon as it is updated.
    // This perfectly intercepts the post-update select and forces it to return empty.
    const { sql } = await import("drizzle-orm");
    testDb.run(sql`
      CREATE TRIGGER IF NOT EXISTS delete_bill_after_update
      AFTER UPDATE ON bills
      FOR EACH ROW
      BEGIN
        DELETE FROM bills WHERE id = NEW.id;
      END;
    `);

    try {
      const res = await app.request(
        `/bills/${billId}/mark-paid`,
        {
          method: "PATCH",
        },
        mockEnv as never,
        mockCtx as never
      );

      const json = (await res.json()) as {
        data: { status: string; markedPaidAt: string; markedPaidBy: string };
      };
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("paid");
      expect(json.data.markedPaidAt).toBeTruthy();
      expect(json.data.markedPaidBy).toBe("owner-id");
    } finally {
      testDb.run(sql`DROP TRIGGER IF EXISTS delete_bill_after_update;`);
    }
  });
});
