/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import { user, properties } from "../../db/schema";
import { dashboardRouter } from "./dashboard";

const currentUser: { id: string } = { id: "owner-id" };
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

describe("Dashboard API", () => {
  let app: Hono;

  beforeEach(async () => {
    await testDb.delete(properties);
    await testDb.delete(user);
    await testDb.insert(user).values({
      id: "owner-id",
      name: "Owner",
      email: "o@test.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    app = new Hono();
    app.route("/dashboard", dashboardRouter);
  });

  it("GET /owner returns 200 with stats for authenticated owner", async () => {
    const res = await app.request("/dashboard/owner", {}, mockEnv as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("GET /tenant returns 200 with stats for authenticated tenant", async () => {
    const res = await app.request("/dashboard/tenant", {}, mockEnv as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
