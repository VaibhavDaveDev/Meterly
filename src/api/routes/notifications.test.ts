/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import { notifications, user } from "../../db/schema";
import { eq } from "drizzle-orm";
import { notificationsRouter } from "./notifications";

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

describe("Notifications API", () => {
  let app: Hono;

  beforeEach(async () => {
    currentUser = { id: "user-1" };
    await testDb.delete(notifications);
    await testDb.delete(user);
    await testDb.insert(user).values({
      id: "user-1",
      name: "User",
      email: "u@test.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    app = new Hono();
    app.route("/notifications", notificationsRouter);
  });

  it("GET / returns empty array when no notifications", async () => {
    const res = await app.request("/notifications", {}, mockEnv as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("GET / returns notifications for current user only", async () => {
    await testDb.insert(user).values({
      id: "user-2",
      name: "Other",
      email: "other@test.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await testDb.insert(notifications).values([
      {
        id: "n1",
        userId: "user-1",
        type: "system",
        title: "T1",
        body: "B1",
        metadata: "{}",
      },
      {
        id: "n2",
        userId: "user-2",
        type: "system",
        title: "T2",
        body: "B2",
        metadata: "{}",
      },
    ]);

    const res = await app.request("/notifications", {}, mockEnv as never);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("n1");
  });

  it("PATCH /{id}/read marks the notification as read", async () => {
    await testDb.insert(notifications).values({
      id: "n1",
      userId: "user-1",
      type: "bill_ready",
      title: "T",
      body: "B",
      metadata: "{}",
    });

    const res = await app.request(
      "/notifications/n1/read",
      { method: "PATCH" },
      mockEnv as never
    );
    expect(res.status).toBe(200);

    const [row] = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, "n1"));
    expect(row.readAt).not.toBeNull();
  });

  it("POST /read-all marks all unread notifications as read", async () => {
    await testDb.insert(notifications).values([
      {
        id: "n1",
        userId: "user-1",
        type: "system",
        title: "T1",
        body: "B",
        metadata: "{}",
      },
      {
        id: "n2",
        userId: "user-1",
        type: "system",
        title: "T2",
        body: "B",
        metadata: "{}",
      },
    ]);

    const res = await app.request(
      "/notifications/read-all",
      { method: "POST" },
      mockEnv as never
    );
    expect(res.status).toBe(200);

    const rows = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, "user-1"));
    expect(rows.every((r) => r.readAt !== null)).toBe(true);
  });
});
