/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

let currentUser: { id: string } | null = { id: "test-user-id" };

vi.mock("../middleware/auth", () => ({
  authMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>
  ) => {
    c.set("user", currentUser);
    await next();
  },
}));

// Mock file validation to avoid actual FormData Buffer issues in Node
vi.mock("../lib/file-validation", () => ({
  validateUploadedFile: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock pdf-extract to avoid actual parsing
vi.mock("../../lib/pdf-extract", () => ({
  extractFromPdf: vi.fn().mockResolvedValue({
    extractionMethod: "mock",
    presentReadingImport: 100,
    totalAmountDue: 50,
  }),
  extractFromMeterPhoto: vi.fn().mockResolvedValue({
    value: 100,
    confidence: 85,
  }),
}));

import { testDb } from "../../test/setup";
import { eq } from "drizzle-orm";
import {
  properties,
  user,
  billingPeriods,
  tenancies,
  bills,
  billPhotos,
} from "../../db/schema";
import { uploadsRouter } from "./uploads";

describe("Uploads API", () => {
  let app: Hono;
  let propId: string;
  let bpId: string;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
    vi.clearAllMocks();

    await testDb.delete(billPhotos);
    await testDb.delete(bills);
    await testDb.delete(billingPeriods);
    await testDb.delete(tenancies);
    await testDb.delete(properties);
    await testDb.delete(user);

    // Insert users
    await testDb.insert(user).values([
      {
        id: "owner-id",
        name: "Owner User",
        email: "owner@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "stranger-id",
        name: "Stranger User",
        email: "stranger@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    propId = "prop-" + Math.random();
    await testDb.insert(properties).values({
      id: propId,
      name: "Test Prop",
      ownerId: "owner-id",
      hasSolar: true,
    });

    bpId = "bp-" + Math.random();
    await testDb.insert(billingPeriods).values({
      id: bpId,
      propertyId: propId,
      periodMonth: "2024-01",
      calculationMode: "solar",
      status: "draft",
    });

    app = new Hono();
    app.route("/uploads", uploadsRouter);
  });

  const createMockFile = (name: string, type: string) => {
    const data = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG magic bytes
    return new File([data], name, { type });
  };

  const mockEnv = {
    DB: {} as unknown,
    MAX_UPLOADS_PER_DAY: "2",
    KV: { get: vi.fn(), put: vi.fn() },
    BILL_PHOTOS: {
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };

  it("rejects upload from non-owner", async () => {
    currentUser = { id: "stranger-id" };

    const formData = new FormData();
    formData.append("photo", createMockFile("test.jpg", "image/jpeg"));
    formData.append("propertyId", propId);
    formData.append("periodId", bpId);
    formData.append("purpose", "import_meter");

    const res = await app.request(
      "/uploads/bill-photo",
      {
        method: "POST",
        body: formData,
      },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    expect(res.status).toBe(403);
  });

  it("rejects upload when required fields are missing", async () => {
    currentUser = { id: "owner-id" };

    const formData = new FormData();
    formData.append("photo", createMockFile("test.jpg", "image/jpeg"));

    const res = await app.request(
      "/uploads/bill-photo",
      {
        method: "POST",
        body: formData,
      },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    expect(res.status).toBe(400);
  });

  it("stores photo in R2 and inserts bill_photos row with version 1", async () => {
    currentUser = { id: "owner-id" };

    const formData = new FormData();
    formData.append("photo", createMockFile("test.jpg", "image/jpeg"));
    formData.append("propertyId", propId);
    formData.append("periodId", bpId);
    formData.append("purpose", "import_meter");

    const res = await app.request(
      "/uploads/bill-photo",
      {
        method: "POST",
        body: formData,
      },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    if (res.status === 400) {
      console.log(await res.text());
    }
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { objectKey: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.objectKey).toBeDefined();

    // Verify DB insert
    const photos = await testDb
      .select()
      .from(billPhotos)
      .where(eq(billPhotos.objectKey, body.data.objectKey));
    expect(photos.length).toBe(1);
    expect(photos[0].version).toBe(1);
  });

  it("enforces daily upload rate limit and returns 429 after limit is reached", async () => {
    // Pre-insert 2 bill_photos rows for today for this user to simulate the limit being hit
    const today = new Date();
    const inserts = Array.from({ length: 2 }, (_, i) => ({
      id: `photo-rl-${i}`,
      propertyId: propId,
      billingPeriodId: `dummy-bp-${i}`, // Use different periods to avoid the period-level cap of 3
      uploadedBy: "owner-id",
      objectKey: `${propId}/dummy-bp-${i}/owner-id/${i}.webp`,
      purpose: "import_meter" as const,
      version: 1,
      status: "active" as const,
      uploadedAt: today,
    }));
    await testDb.insert(billPhotos).values(inserts);

    currentUser = { id: "owner-id" };
    const formData = new FormData();
    formData.append("photo", createMockFile("test.jpg", "image/jpeg"));
    formData.append("propertyId", propId);
    formData.append("periodId", bpId);
    formData.append("purpose", "import_meter");

    const res = await app.request(
      "/uploads/bill-photo",
      {
        method: "POST",
        body: formData,
      },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
