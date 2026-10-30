import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "../../test/setup";
import { user, verification, tenancies, properties } from "../../db/schema";
import { app, type Bindings } from "../app";

const BASE_ENV: Partial<Bindings> = {
  DB: testDb as unknown as Bindings["DB"],
  CRON_SECRET: "test-secret",
  ENVIRONMENT: "test",
  BETTER_AUTH_URL: "http://localhost",
};

describe("Cron: purge-unverified-accounts", () => {
  beforeEach(async () => {
    await testDb.delete(verification);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);
  });

  it("deletes unverified users older than TTL (default 48h)", async () => {
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

    await testDb.insert(user).values([
      // stale unverified — should be deleted
      {
        id: "stale-unverified",
        name: "Stale User",
        email: "stale@example.com",
        emailVerified: false,
        createdAt: fiftyHoursAgo,
        updatedAt: fiftyHoursAgo,
      },
      // fresh unverified — within TTL, should survive
      {
        id: "fresh-unverified",
        name: "Fresh User",
        email: "fresh@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // verified — should always survive
      {
        id: "verified-user",
        name: "Verified User",
        email: "verified@example.com",
        emailVerified: true,
        createdAt: fiftyHoursAgo,
        updatedAt: fiftyHoursAgo,
      },
    ]);

    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { headers: { Authorization: "Bearer test-secret" } },
      BASE_ENV
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { deleted: { users: number } };
    };
    expect(json.success).toBe(true);
    expect(json.data.deleted.users).toBe(1);

    const remaining = await testDb.select().from(user);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((u) => u.id)).not.toContain("stale-unverified");
  });

  it("respects custom TTL from env", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    await testDb.insert(user).values({
      id: "two-hour-old",
      name: "Two Hour User",
      email: "two@example.com",
      emailVerified: false,
      createdAt: threeHoursAgo,
      updatedAt: threeHoursAgo,
    });

    // With TTL=2h, this 3h-old record should be deleted
    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { headers: { Authorization: "Bearer test-secret" } },
      { ...BASE_ENV, UNVERIFIED_ACCOUNT_TTL_HOURS: "2" }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { deleted: { users: number } };
    };
    expect(json.data.deleted.users).toBe(1);
  });

  it("authenticates successfully via X-Cron-Secret header (POST)", async () => {
    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { method: "POST", headers: { "X-Cron-Secret": "test-secret" } },
      BASE_ENV
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { headers: { Authorization: "Bearer wrong" } },
      BASE_ENV
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 with no auth header", async () => {
    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      {},
      BASE_ENV
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("rejects non-positive or invalid TTL values with 400 INVALID_CONFIG", async () => {
    const invalidValues = ["-1", "0", "2oops", "abc", "1.5"];
    for (const val of invalidValues) {
      const res = await app.request(
        "/api/cron/purge-unverified-accounts",
        { headers: { Authorization: "Bearer test-secret" } },
        { ...BASE_ENV, UNVERIFIED_ACCOUNT_TTL_HOURS: val }
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INVALID_CONFIG");
    }
  });

  it("cleans associated verification and tenancy records when deleting stale unverified users", async () => {
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

    await testDb.insert(user).values({
      id: "stale-user",
      name: "Stale User",
      email: "stale@example.com",
      emailVerified: false,
      createdAt: fiftyHoursAgo,
      updatedAt: fiftyHoursAgo,
    });

    await testDb.insert(verification).values([
      {
        id: "ver-1",
        identifier: "email-verification-otp-stale@example.com",
        value: "123456",
        expiresAt: new Date(Date.now() + 600000),
        createdAt: fiftyHoursAgo,
        updatedAt: fiftyHoursAgo,
      },
      {
        id: "ver-2",
        identifier: "forget-password-otp-stale@example.com",
        value: "654321",
        expiresAt: new Date(Date.now() + 600000),
        createdAt: fiftyHoursAgo,
        updatedAt: fiftyHoursAgo,
      },
      {
        id: "ver-3",
        identifier: "stale@example.com",
        value: "112233",
        expiresAt: new Date(Date.now() + 600000),
        createdAt: fiftyHoursAgo,
        updatedAt: fiftyHoursAgo,
      },
    ]);

    await testDb.insert(properties).values({
      id: "prop-1",
      name: "Prop 1",
      ownerId: "some-owner",
    });

    await testDb.insert(tenancies).values({
      id: "tenancy-1",
      propertyId: "prop-1",
      tenantId: "stale-user",
      status: "invited",
    });

    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { headers: { Authorization: "Bearer test-secret" } },
      BASE_ENV
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: {
        deleted: {
          users: number;
          otpVerifications: number;
          softDeletedTenancies: number;
        };
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.deleted.users).toBe(1);
    expect(json.data.deleted.otpVerifications).toBe(3);
    expect(json.data.deleted.softDeletedTenancies).toBe(1);

    const remainingVerifications = await testDb.select().from(verification);
    expect(remainingVerifications).toHaveLength(0);

    // Tenancy MUST NOT be hard-deleted. It must remain as a soft-deleted row
    // with tenant_id nulled (FK released) and deletedByTenantAt set.
    const remainingTenancies = await testDb.select().from(tenancies);
    expect(remainingTenancies).toHaveLength(1);
    expect(remainingTenancies[0].tenantId).toBeNull();
    expect(remainingTenancies[0].deletedByTenantAt).not.toBeNull();
  });

  it("processes tenancy and verification deletes in batches when >100 stale users exist", async () => {
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
    const BATCH_SIZE = 110; // deliberately over D1's 100-param limit

    for (let i = 0; i < BATCH_SIZE; i += 50) {
      const chunkUsers = Array.from(
        { length: Math.min(50, BATCH_SIZE - i) },
        (_, idx) => {
          const num = i + idx;
          return {
            id: `batch-user-${num}`,
            name: `Batch User ${num}`,
            email: `batch${num}@example.com`,
            emailVerified: false,
            createdAt: fiftyHoursAgo,
            updatedAt: fiftyHoursAgo,
          };
        }
      );
      await testDb.insert(user).values(chunkUsers);

      const chunkVers = Array.from(
        { length: Math.min(50, BATCH_SIZE - i) },
        (_, idx) => {
          const num = i + idx;
          return {
            id: `batch-ver-${num}`,
            identifier: `email-verification-otp-batch${num}@example.com`,
            value: "123456",
            expiresAt: new Date(Date.now() + 600000),
            createdAt: fiftyHoursAgo,
            updatedAt: fiftyHoursAgo,
          };
        }
      );
      await testDb.insert(verification).values(chunkVers);
    }

    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { headers: { Authorization: "Bearer test-secret" } },
      BASE_ENV
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { deleted: { users: number; otpVerifications: number } };
    };
    expect(json.success).toBe(true);
    expect(json.data.deleted.users).toBe(BATCH_SIZE);
    expect(json.data.deleted.otpVerifications).toBe(BATCH_SIZE);

    const remaining = await testDb.select().from(verification);
    expect(remaining).toHaveLength(0);
  });

  it("does not touch tenancy or verification records for users who verified their email", async () => {
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);

    await testDb.insert(user).values({
      id: "verified-late",
      name: "Late Verified User",
      email: "late@example.com",
      emailVerified: true, // verified
      createdAt: fiftyHoursAgo,
      updatedAt: fiftyHoursAgo,
    });

    await testDb.insert(verification).values({
      id: "ver-late",
      identifier: "email-verification-otp-late@example.com",
      value: "123456",
      expiresAt: new Date(Date.now() + 600000),
      createdAt: fiftyHoursAgo,
      updatedAt: fiftyHoursAgo,
    });

    await testDb.insert(properties).values({
      id: "prop-late",
      name: "Prop Late",
      ownerId: "some-owner",
    });

    await testDb.insert(tenancies).values({
      id: "tenancy-late",
      propertyId: "prop-late",
      tenantId: "verified-late",
      status: "active",
    });

    const res = await app.request(
      "/api/cron/purge-unverified-accounts",
      { headers: { Authorization: "Bearer test-secret" } },
      BASE_ENV
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: {
        deleted: {
          users: number;
          otpVerifications: number;
          softDeletedTenancies: number;
        };
      };
    };
    expect(json.data.deleted.users).toBe(0);
    expect(json.data.deleted.otpVerifications).toBe(0);
    expect(json.data.deleted.softDeletedTenancies).toBe(0);

    const remainingTenancies = await testDb.select().from(tenancies);
    expect(remainingTenancies).toHaveLength(1);
    expect(remainingTenancies[0].tenantId).toBe("verified-late");
    expect(remainingTenancies[0].deletedByTenantAt).toBeNull();

    const remainingVerifications = await testDb.select().from(verification);
    expect(remainingVerifications).toHaveLength(1);
  });
});
