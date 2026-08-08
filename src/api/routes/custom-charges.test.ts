/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { testDb } from "../../test/setup";
import { user, properties, customCharges } from "../../db/schema";
import { chargesRouter as customChargesRouter } from "./custom-charges";
import { eq } from "drizzle-orm";

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

describe("Custom Charges API", () => {
  let app: Hono;
  let chargeId: string;
  let propertyId: string;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
    await testDb.delete(customCharges);
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
        id: "stranger-id",
        name: "Stranger",
        email: "s@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    propertyId = "prop-" + Math.random();
    await testDb.insert(properties).values({
      id: propertyId,
      name: "Prop",
      ownerId: "owner-id",
      hasSolar: false,
    });

    chargeId = "charge-1";
    await testDb.insert(customCharges).values({
      id: chargeId,
      propertyId,
      name: "Cleaning",
      amount: 50,
    });

    app = new Hono();
    app.route("/custom-charges", customChargesRouter);
  });

  it("POST / returns 200 and persists the charge", async () => {
    const res = await app.request(
      `/custom-charges/${propertyId}/charges`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Internet", amount: 30 }),
      },
      mockEnv as never
    );
    expect(res.status).toBe(200);
    // Verify the charge was actually written to DB
    const rows = await testDb
      .select()
      .from(customCharges)
      .where(eq(customCharges.name, "Internet"));
    expect(rows.length).toBe(1);
    expect(rows[0].amount).toBe(30);
    expect(rows[0].propertyId).toBe(propertyId);
  });

  it("POST / unauthorized — leaves DB unchanged", async () => {
    currentUser = { id: "stranger-id" };
    const before = await testDb
      .select()
      .from(customCharges)
      .orderBy(customCharges.id);
    const res = await app.request(
      `/custom-charges/${propertyId}/charges`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Unauthorized charge", amount: 99 }),
      },
      mockEnv as never
    );
    expect(res.status).toBe(403);
    const after = await testDb
      .select()
      .from(customCharges)
      .orderBy(customCharges.id);
    // Full snapshot comparison — row count AND content must be identical
    expect(after).toEqual(before);
  });

  it("DELETE /{id} removes the charge from DB", async () => {
    const res = await app.request(
      `/custom-charges/charges/${chargeId}`,
      { method: "DELETE" },
      mockEnv as never
    );
    expect(res.status).toBe(200);
    const rows = await testDb
      .select()
      .from(customCharges)
      .where(eq(customCharges.id, chargeId));
    expect(rows.length).toBe(0);
  });

  it("DELETE /{id} returns 403 for unauthorized user", async () => {
    currentUser = { id: "stranger-id" };
    const res = await app.request(
      `/custom-charges/charges/${chargeId}`,
      { method: "DELETE" },
      mockEnv as never
    );
    expect(res.status).toBe(403);
  });
});
