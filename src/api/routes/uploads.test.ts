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

// Mock file validation to avoid actual FormData Buffer issues in Node.
// The buffer is inlined in the factory because vi.mock is hoisted above all
// variable declarations — referencing an outer const would throw a TDZ error.
vi.mock("../lib/file-validation", () => ({
  validateUploadedFile: vi.fn().mockResolvedValue({
    valid: true,
    verifiedMimeType: "image/jpeg",
    buffer: new Uint8Array([0xff, 0xd8, 0xff]).buffer,
  }),
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
import { validateUploadedFile } from "../lib/file-validation";
import {
  properties,
  user,
  billingPeriods,
  tenancies,
  bills,
  billPhotos,
  uploadDailyCount,
} from "../../db/schema";
import { uploadsRouter } from "./uploads";

describe("Uploads API", () => {
  let app: Hono;
  let propId: string;
  let bpId: string;
  // Holds the ArrayBuffer reference the mock resolves with, set each beforeEach
  // so it stays in sync after vi.clearAllMocks() resets call history.
  let mockBuffer: ArrayBuffer;

  beforeEach(async () => {
    currentUser = { id: "owner-id" };
    vi.clearAllMocks();
    // Re-apply mock resolved value after clearAllMocks so buffer is available.
    mockBuffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    (validateUploadedFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      verifiedMimeType: "image/jpeg",
      buffer: mockBuffer,
    });

    await testDb.delete(uploadDailyCount);
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
    expect(body.data.objectKey).toMatch(/\.jpg$/);

    // Verify the validated buffer (not a fresh arrayBuffer()) was passed to R2.
    // This covers the `validation.buffer ?? (await photo.arrayBuffer())` path.
    expect(mockEnv.BILL_PHOTOS.put).toHaveBeenCalledOnce();
    const [, putBody] = (mockEnv.BILL_PHOTOS.put as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(putBody).toBe(mockBuffer);

    // Verify DB insert
    const photos = await testDb
      .select()
      .from(billPhotos)
      .where(eq(billPhotos.objectKey, body.data.objectKey));
    expect(photos.length).toBe(1);
    expect(photos[0].version).toBe(1);
  });

  it("enforces daily upload rate limit and returns 429 after limit is reached", async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    await testDb.insert(uploadDailyCount).values({
      id: `owner-id:${todayKey}`,
      userId: "owner-id",
      dateKey: todayKey,
      count: 2, // Mock MAX_UPLOADS_PER_DAY is 2
    });

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

  it("concurrent reservation does not bypass the limit", async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    await testDb.insert(uploadDailyCount).values({
      id: `owner-id:${todayKey}`,
      userId: "owner-id",
      dateKey: todayKey,
      count: 1, // Mock MAX_UPLOADS_PER_DAY is 2, so 1 more is allowed
    });

    currentUser = { id: "owner-id" };

    const req1 = new FormData();
    req1.append("photo", createMockFile("test1.jpg", "image/jpeg"));
    req1.append("propertyId", propId);
    req1.append("periodId", bpId);
    req1.append("purpose", "import_meter");

    const req2 = new FormData();
    req2.append("photo", createMockFile("test2.jpg", "image/jpeg"));
    req2.append("propertyId", propId);
    req2.append("periodId", bpId);
    req2.append("purpose", "export_meter");

    const [res1, res2] = await Promise.all([
      app.request(
        "/uploads/bill-photo",
        { method: "POST", body: req1 },
        mockEnv as unknown as Parameters<typeof app.request>[2]
      ),
      app.request(
        "/uploads/bill-photo",
        { method: "POST", body: req2 },
        mockEnv as unknown as Parameters<typeof app.request>[2]
      ),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 429]);
  });

  it("decrements daily count when rejected with 403 (forbidden)", async () => {
    currentUser = { id: "stranger-id" };

    const formData = new FormData();
    formData.append("photo", createMockFile("test.jpg", "image/jpeg"));
    formData.append("propertyId", propId);
    formData.append("periodId", bpId);
    formData.append("purpose", "import_meter");

    const res = await app.request(
      "/uploads/bill-photo",
      { method: "POST", body: formData },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    expect(res.status).toBe(403);

    const countRow = await testDb
      .select()
      .from(uploadDailyCount)
      .where(eq(uploadDailyCount.userId, "stranger-id"));

    expect(countRow.length).toBe(1);
    expect(countRow[0].count).toBe(0);
  });

  it("decrements daily count when rejected with 400 (invalid file)", async () => {
    currentUser = { id: "owner-id" };
    vi.mocked(validateUploadedFile).mockResolvedValueOnce({
      valid: false,
      error: "bad file",
    });

    const formData = new FormData();
    formData.append("photo", createMockFile("test.jpg", "image/jpeg"));
    formData.append("propertyId", propId);
    formData.append("periodId", bpId);
    formData.append("purpose", "import_meter");

    const res = await app.request(
      "/uploads/bill-photo",
      { method: "POST", body: formData },
      mockEnv as unknown as Parameters<typeof app.request>[2]
    );

    expect(res.status).toBe(400);

    const countRow = await testDb
      .select()
      .from(uploadDailyCount)
      .where(eq(uploadDailyCount.userId, "owner-id"));

    expect(countRow.length).toBe(1);
    expect(countRow[0].count).toBe(0);
  });
});
