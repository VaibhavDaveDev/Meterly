/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

let currentUser: { id: string } | null = { id: "test-user-id" };

vi.mock("../middleware/auth", () => ({
  authMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>
  ) => {
    c.set("user", currentUser);
    await next();
  },
}));

vi.mock("../lib/bill-generation", () => ({
  generateAndSaveBills: vi.fn().mockResolvedValue([]),
}));

import { testDb } from "../../test/setup";
import { eq } from "drizzle-orm";
import {
  properties,
  user,
  billingPeriods,
  readingDailyCount,
  meterReadings,
} from "../../db/schema";
import { readingsRouter } from "./meter-readings";

describe("Meter Readings Rate Limit", () => {
  let app: Hono;
  let propId: string;
  let bpId: string;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
    vi.clearAllMocks();

    await testDb.delete(readingDailyCount);
    await testDb.delete(meterReadings);
    await testDb.delete(billingPeriods);
    await testDb.delete(properties);
    await testDb.delete(user);

    await testDb.insert(user).values([
      {
        id: "owner-id",
        name: "Owner User",
        email: "owner@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    propId = "prop-" + Math.random();
    await testDb.insert(properties).values({
      id: propId,
      name: "Test Prop",
      ownerId: "owner-id",
      hasSolar: true,
    });

    bpId = "bp-" + Math.random();
    await testDb.insert(billingPeriods).values({
      id: bpId,
      propertyId: propId,
      periodMonth: "2024-01",
      calculationMode: "solar",
      status: "draft",
    });

    app = new Hono();
    app.route("/readings", readingsRouter);
  });

  const mockEnv = {
    DB: {} as unknown,
    MAX_READINGS_PER_DAY: "2",
  };

  it("decrements counter on early validation return (period not found)", async () => {
    currentUser = { id: "owner-id" };

    const payload = {
      solarGenerationEnd: 100,
      exportEnd: 50,
      importEnd: 200,
    };

    // Request with a non-existent period ID
    const res = await app.request(
      "/readings/non-existent-id/readings",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    expect(res.status).toBe(404);

    // Verify counter was decremented back to 0 (or row has count 0)
    const todayKey = new Date().toISOString().slice(0, 10);
    const counterId = `owner-id:${todayKey}`;

    const [counter] = await testDb
      .select()
      .from(readingDailyCount)
      .where(eq(readingDailyCount.id, counterId));

    expect(counter).toBeDefined();
    expect(counter.count).toBe(0);
  });
});
