/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import { user, properties, tenancies } from "../../db/schema";
import { tenanciesRouter } from "./tenancies";

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

describe("Tenancies API", () => {
  let app: Hono;
  let propertyId: string;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
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

    propertyId = "prop-" + Math.random();
    await testDb
      .insert(properties)
      .values({
        id: propertyId,
        name: "Prop",
        ownerId: "owner-id",
        hasSolar: false,
      });

    await testDb.insert(tenancies).values({
      id: "tenancy-1",
      propertyId,
      tenantId: "tenant-id",
      status: "active",
    });

    app = new Hono();
    app.route("/tenancies", tenanciesRouter);
  });

  it("GET / returns 200 and tenancies for the property owner", async () => {
    const res = await app.request(
      `/tenancies/${propertyId}/tenancies`,
      {},
      mockEnv as never
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { active: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.active.length).toBeGreaterThan(0);
  });

  it("GET / returns 403 for unauthorized user", async () => {
    currentUser = { id: "stranger-id" };
    const res = await app.request(
      `/tenancies/${propertyId}/tenancies`,
      {},
      mockEnv as never
    );
    expect(res.status).toBe(403);
  });

  it("GET / returns 403 for the tenant of the property", async () => {
    // Only owners should list all tenancies
    currentUser = { id: "tenant-id" };
    const res = await app.request(
      `/tenancies/${propertyId}/tenancies`,
      {},
      mockEnv as never
    );
    expect(res.status).toBe(403);
  });
});
