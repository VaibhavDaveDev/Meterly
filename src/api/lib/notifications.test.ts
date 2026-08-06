/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createNotification } from "./notifications";
import { testDb } from "../../test/setup";
import { notifications, user } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { getDb } from "../../db";

describe("createNotification", () => {
  beforeEach(async () => {
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
  });

  it("inserts a notification row with correct fields", async () => {
    await createNotification(
      testDb as unknown as ReturnType<typeof getDb>,
      "user-1",
      "bill_ready",
      "Bill Ready",
      "Your bill is ready.",
      { periodId: "p1" }
    );

    const rows = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, "user-1"));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("bill_ready");
    expect(rows[0].title).toBe("Bill Ready");
    expect(rows[0].body).toBe("Your bill is ready.");
    expect(JSON.parse(rows[0].metadata as string)).toEqual({ periodId: "p1" });
    expect(rows[0].readAt).toBeNull();
  });

  it("defaults metadata to empty object when not provided", async () => {
    await createNotification(
      testDb as unknown as ReturnType<typeof getDb>,
      "user-1",
      "system",
      "Hello",
      "World"
    );
    const [row] = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, "user-1"));
    expect(JSON.parse(row.metadata as string)).toEqual({});
  });
});
