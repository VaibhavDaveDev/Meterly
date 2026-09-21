import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("../middleware/auth", () => ({
  authMiddleware: async (_c: unknown, next: () => unknown) => next(),
}));
import { testDb } from "../../test/setup";
import {
  properties,
  billingPeriods,
  tenancies,
  notifications,
  user,
  otpRateLimit,
  passwordChangeLimit,
  uploadDailyCount,
  readingDailyCount,
} from "../../db/schema";
import { app, type Bindings } from "../app";

describe("Cron: reading-reminders", () => {
  beforeEach(async () => {
    // Clear tables
    await testDb.delete(notifications);
    await testDb.delete(tenancies);
    await testDb.delete(billingPeriods);
    await testDb.delete(properties);
    await testDb.delete(user);
  });

  async function seedCronFixtures(reminderDay: number, includeTenant = false) {
    const prevMonthStr = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 1,
      1
    )
      .toISOString()
      .split("T")[0];
    await testDb.insert(user).values([
      {
        id: "owner-1",
        email: "owner@example.com",
        name: "Owner",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ...(includeTenant
        ? [
            {
              id: "tenant-1",
              email: "tenant@example.com",
              name: "Tenant",
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]
        : []),
    ]);
    await testDb.insert(properties).values({
      id: "prop-1",
      ownerId: "owner-1",
      name: "Test Property",
      readingReminderDay: reminderDay,
    });
    if (includeTenant) {
      await testDb.insert(tenancies).values({
        id: "tenancy-1",
        propertyId: "prop-1",
        tenantId: "tenant-1",
        splitPercentage: 100,
        status: "active",
        invitedAt: new Date(),
      });
    }
    await testDb.insert(billingPeriods).values({
      id: "period-1",
      propertyId: "prop-1",
      periodMonth: prevMonthStr,
      calculationMode: "grid_only",
      status: "draft",
    });
  }

  it("sends notification when reminder day matches today", async () => {
    const today = new Date().getDate();
    await seedCronFixtures(today);

    const res = await app.request(
      "/api/cron/reading-reminders",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(200);

    const notifs = await testDb.select().from(notifications);
    expect(notifs.length).toBe(1);
    expect(notifs[0].userId).toBe("owner-1");
  });

  it("skips when reminder day does not match today", async () => {
    const today = new Date().getDate();
    const otherDay = today === 28 ? 1 : today + 1; // pick a day that is not today
    await seedCronFixtures(otherDay);

    const res = await app.request(
      "/api/cron/reading-reminders",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(200);

    const notifs = await testDb.select().from(notifications);
    expect(notifs.length).toBe(0);
  });

  it("sends to owner and all active tenants", async () => {
    const today = new Date().getDate();
    await seedCronFixtures(today, true);

    const res = await app.request(
      "/api/cron/reading-reminders",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(200);

    const notifs = await testDb.select().from(notifications);
    expect(notifs.length).toBe(2);
    expect(notifs.some((n) => n.userId === "owner-1")).toBe(true);
    expect(notifs.some((n) => n.userId === "tenant-1")).toBe(true);
  });

  it("returns 400 with no Authorization header", async () => {
    const res = await app.request(
      "/api/cron/reading-reminders",
      {},
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 with wrong token", async () => {
    const res = await app.request(
      "/api/cron/reading-reminders",
      { headers: { Authorization: "Bearer wrong-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 if CRON_SECRET is not configured", async () => {
    const res = await app.request(
      "/api/cron/reading-reminders",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      } // No CRON_SECRET
    );
    expect(res.status).toBe(401);
  });
});

describe("Cron: cleanup-stale-rate-limits", () => {
  beforeEach(async () => {
    await testDb.delete(otpRateLimit);
    await testDb.delete(passwordChangeLimit);
    await testDb.delete(uploadDailyCount);
    await testDb.delete(readingDailyCount);
    await testDb.delete(user);
  });

  it("deletes OTP rows older than 30 days and keeps newer ones", async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await testDb.insert(otpRateLimit).values([
      {
        id: crypto.randomUUID(),
        email: "stale@example.com",
        attempts: 2,
        lastSentAt: thirtyOneDaysAgo,
      },
      {
        id: crypto.randomUUID(),
        email: "fresh@example.com",
        attempts: 1,
        lastSentAt: new Date(),
      },
    ]);

    const res = await app.request(
      "/api/cron/cleanup-stale-rate-limits",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      deleted: Record<string, number>;
    };
    expect(json.success).toBe(true);
    expect(json.deleted.otpRateLimit).toBe(1);

    const remaining = await testDb.select().from(otpRateLimit);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].email).toBe("fresh@example.com");
  });

  it("deletes password-change rows older than 30 days and keeps newer ones", async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await testDb.insert(passwordChangeLimit).values([
      {
        id: crypto.randomUUID(),
        userId: "stale-user",
        count: 3,
        windowStart: thirtyOneDaysAgo,
      },
      {
        id: crypto.randomUUID(),
        userId: "fresh-user",
        count: 1,
        windowStart: new Date(),
      },
    ]);

    const res = await app.request(
      "/api/cron/cleanup-stale-rate-limits",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      deleted: Record<string, number>;
    };
    expect(json.deleted.passwordChangeLimit).toBe(1);

    const remaining = await testDb.select().from(passwordChangeLimit);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe("fresh-user");
  });

  it("deletes upload and reading counters older than 2 days", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const todayKey = new Date().toISOString().slice(0, 10);

    await testDb.insert(user).values({
      id: "counter-user",
      email: "counter@example.com",
      name: "Counter User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await testDb.insert(uploadDailyCount).values([
      {
        id: `counter-user:${threeDaysAgo}`,
        userId: "counter-user",
        dateKey: threeDaysAgo,
        count: 5,
      },
      {
        id: `counter-user:${todayKey}`,
        userId: "counter-user",
        dateKey: todayKey,
        count: 2,
      },
    ]);

    await testDb.insert(readingDailyCount).values([
      {
        id: `counter-user:${threeDaysAgo}`,
        userId: "counter-user",
        dateKey: threeDaysAgo,
        count: 3,
      },
      {
        id: `counter-user:${todayKey}`,
        userId: "counter-user",
        dateKey: todayKey,
        count: 1,
      },
    ]);

    const res = await app.request(
      "/api/cron/cleanup-stale-rate-limits",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      deleted: Record<string, number>;
    };
    expect(json.deleted.uploadDailyCount).toBe(1);
    expect(json.deleted.readingDailyCount).toBe(1);

    const remainingUploads = await testDb.select().from(uploadDailyCount);
    expect(remainingUploads).toHaveLength(1);
    expect(remainingUploads[0].dateKey).toBe(todayKey);

    const remainingReadings = await testDb.select().from(readingDailyCount);
    expect(remainingReadings).toHaveLength(1);
    expect(remainingReadings[0].dateKey).toBe(todayKey);
  });

  it("returns 401 with wrong token", async () => {
    const res = await app.request(
      "/api/cron/cleanup-stale-rate-limits",
      { headers: { Authorization: "Bearer wrong-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        CRON_SECRET: "test-secret",
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 if CRON_SECRET is not configured", async () => {
    const res = await app.request(
      "/api/cron/cleanup-stale-rate-limits",
      { headers: { Authorization: "Bearer test-secret" } },
      {
        DB: testDb as unknown as Bindings["DB"],
        ENVIRONMENT: "test",
        BETTER_AUTH_URL: "http://localhost",
      }
    );
    expect(res.status).toBe(401);
  });
});
