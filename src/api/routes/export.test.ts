/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import { user, properties, tenancies } from "../../db/schema";
import { exportRouter } from "./export";

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

const mockEnv = { DB: {} };

describe("Export API", () => {
  let app: Hono;

  beforeEach(async () => {
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
    ]);
    app = new Hono();
    app.route("/export", exportRouter);
  });

  it("GET /all returns empty downloads for user with no data", async () => {
    const res = await app.request("/export/all", {}, mockEnv as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { downloads: unknown[] };
    expect(body.downloads).toEqual([]);
  });

  it("GET /all includes owner-property entry for owned property", async () => {
    await testDb
      .insert(properties)
      .values({
        id: "p1",
        name: "My House",
        ownerId: "owner-id",
        hasSolar: false,
      });

    const res = await app.request("/export/all", {}, mockEnv as never);
    const body = (await res.json()) as {
      downloads: { type: string; url: string }[];
    };
    expect(
      body.downloads.some(
        (d) => d.type === "owner-property" && d.url.includes("p1")
      )
    ).toBe(true);
  });

  it("GET /all includes tenancy entry for tenant user", async () => {
    currentUser = { id: "tenant-id" };
    await testDb
      .insert(properties)
      .values({
        id: "p2",
        name: "Rented",
        ownerId: "owner-id",
        hasSolar: false,
      });
    await testDb
      .insert(tenancies)
      .values({
        id: "t1",
        propertyId: "p2",
        tenantId: "tenant-id",
        status: "active",
      });

    const res = await app.request("/export/all", {}, mockEnv as never);
    const body = (await res.json()) as {
      downloads: { type: string; url: string }[];
    };
    expect(
      body.downloads.some((d) => d.type === "tenancy" && d.url.includes("t1"))
    ).toBe(true);
  });
});
