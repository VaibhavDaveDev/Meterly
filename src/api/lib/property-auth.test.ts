/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { requireOwner, requirePropertyAccess } from "./property-auth";
import { testDb } from "../../test/setup";
import { properties, tenancies, user } from "../../db/schema";
import type { Database } from "../../db";

describe("requireOwner", () => {
  let propId: string;

  beforeEach(async () => {
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);
    await testDb.insert(user).values([
      {
        id: "owner-id",
        name: "Owner",
        email: "owner@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "other-id",
        name: "Other",
        email: "other@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    propId = "prop-" + Math.random();
    await testDb
      .insert(properties)
      .values({
        id: propId,
        name: "Test",
        ownerId: "owner-id",
        hasSolar: false,
      });
  });

  it("returns the property when caller is the owner", async () => {
    const result = await requireOwner(
      testDb as unknown as Database,
      propId,
      "owner-id"
    );
    expect(result).not.toBeNull();
    expect(result?.id).toBe(propId);
  });

  it("returns null when caller is not the owner", async () => {
    const result = await requireOwner(
      testDb as unknown as Database,
      propId,
      "other-id"
    );
    expect(result).toBeNull();
  });

  it("returns null when property does not exist", async () => {
    const result = await requireOwner(
      testDb as unknown as Database,
      "nonexistent-prop",
      "owner-id"
    );
    expect(result).toBeNull();
  });
});

describe("requirePropertyAccess", () => {
  let propId: string;

  beforeEach(async () => {
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);
    await testDb.insert(user).values([
      {
        id: "owner-id",
        name: "Owner",
        email: "owner@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "tenant-id",
        name: "Tenant",
        email: "tenant@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "stranger-id",
        name: "Stranger",
        email: "stranger@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    propId = "prop-" + Math.random();
    await testDb
      .insert(properties)
      .values({
        id: propId,
        name: "Test",
        ownerId: "owner-id",
        hasSolar: false,
      });
    await testDb.insert(tenancies).values({
      id: "tenancy-1",
      propertyId: propId,
      tenantId: "tenant-id",
      status: "active",
    });
  });

  it("returns role=owner for the property owner", async () => {
    const result = await requirePropertyAccess(
      testDb as unknown as Database,
      propId,
      "owner-id"
    );
    expect(result?.role).toBe("owner");
  });

  it("returns role=tenant for an active tenant", async () => {
    const result = await requirePropertyAccess(
      testDb as unknown as Database,
      propId,
      "tenant-id"
    );
    expect(result?.role).toBe("tenant");
  });

  it("returns null for an unauthorized user", async () => {
    const result = await requirePropertyAccess(
      testDb as unknown as Database,
      propId,
      "stranger-id"
    );
    expect(result).toBeNull();
  });

  it("returns null when property does not exist", async () => {
    const result = await requirePropertyAccess(
      testDb as unknown as Database,
      "ghost-prop",
      "owner-id"
    );
    expect(result).toBeNull();
  });
});
