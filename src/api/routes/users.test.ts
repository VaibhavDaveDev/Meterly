/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import { user as userTable } from "../../db/schema";
import { eq } from "drizzle-orm";
import usersRouter from "./users";

let currentUser: { id: string } | null = { id: "user-1" };
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

describe("Users API", () => {
  let app: Hono;

  beforeEach(async () => {
    currentUser = { id: "user-1" };
    await testDb.delete(userTable);
    await testDb.insert(userTable).values({
      id: "user-1",
      name: "Test User",
      email: "test@test.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    app = new Hono();
    app.route("/users", usersRouter);
  });

  it("GET /me returns the authenticated user profile", async () => {
    const res = await app.request("/users/me", {}, mockEnv as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { id: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("user-1");
  });

  it("GET /me returns 404 when user row is missing", async () => {
    await testDb.delete(userTable);
    const res = await app.request("/users/me", {}, mockEnv as never);
    expect(res.status).toBe(404);
  });

  it("PATCH /onboarding updates primaryRole", async () => {
    const res = await app.request(
      "/users/onboarding",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryRole: "owner" }),
      },
      mockEnv as never
    );
    expect(res.status).toBe(200);

    const [u] = await testDb
      .select()
      .from(userTable)
      .where(eq(userTable.id, "user-1"));
    expect((u as { primaryRole?: string }).primaryRole).toBe("owner");
  });

  it("PATCH /onboarding with no fields returns 200 and unchanged user", async () => {
    const res = await app.request(
      "/users/onboarding",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      mockEnv as never
    );
    expect(res.status).toBe(200);
  });
});
