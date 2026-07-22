import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../app";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  billPhotos,
  editRequests,
  properties,
  tenancies,
  billingPeriods,
} from "../../db/schema";
import { validateUploadedFile } from "../lib/file-validation";
import { SuccessResponse, SimpleSuccessResponse, ErrorResponse, IdParam } from "../lib/openapi-schemas";

const uploadsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

uploadsRouter.use('*', authMiddleware);

const uploadPhotoRoute = createRoute({
  method: 'post',
  path: '/bill-photo',
  tags: ['Uploads'],
  summary: 'Upload a bill photo',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Photo uploaded successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Bad request',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Conflict',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Rate limit exceeded',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Internal server error',
    },
  },
});

uploadsRouter.openapi(uploadPhotoRoute, async (c) => {
  const user = c.get("user");
  const r2 = c.env.BILL_PHOTOS;
  const db = getDb(c.env.DB);

  if (!r2) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 bucket is not configured",
        },
      },
      500
    );
  }

  // --- Rate limiting ---
  const MAX_UPLOADS_PER_DAY = c.env.MAX_UPLOADS_PER_DAY
    ? parseInt(c.env.MAX_UPLOADS_PER_DAY, 10)
    : 60;

  const [uploadsCount] = await db
    .select({ count: sql<number>`count(${billPhotos.id})` })
    .from(billPhotos)
    .where(
      and(
        eq(billPhotos.uploadedBy, user.id),
        sql`${billPhotos.uploadedAt} >= strftime('%s', 'now', 'start of day')`
      )
    );
  const count = uploadsCount?.count ?? 0;

  if (count >= MAX_UPLOADS_PER_DAY) {
    c.header("Retry-After", "86400");
    return c.json(
      {
        success: false as const,
        error: {
          code: "RATE_LIMITED",
          message: `Upload limit reached (${MAX_UPLOADS_PER_DAY}/day). Try again tomorrow.`,
        },
      },
      429
    );
  }

  // --- Parse multipart ---
  const formData = await c.req.formData();
  const photo = formData.get("photo") as File | null;
  const periodId = formData.get("periodId") as string | null;
  const propertyId = formData.get("propertyId") as string | null;
  const purpose = formData.get("purpose") as
    | "import_meter"
    | "export_meter"
    | "solar_meter"
    | "bill_document"
    | null;
  const editRequestId = formData.get("editRequestId") as string | null;

  if (!photo || !periodId || !propertyId || !purpose) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "MISSING_FIELDS",
          message: "photo, periodId, propertyId, and purpose are required",
        },
      },
      400
    );
  }

  const VALID_PURPOSES = [
    "import_meter",
    "export_meter",
    "solar_meter",
    "bill_document",
  ] as const;
  if (!VALID_PURPOSES.includes(purpose as never)) {
    return c.json(
      {
        success: false as const,
        error: { code: "INVALID_PURPOSE", message: "Invalid purpose value." },
      },
      400
    );
  }

  // --- Auth Check ---
  const tenancyCheck = await db.query.tenancies.findFirst({
    where: and(
      eq(tenancies.propertyId, propertyId),
      eq(tenancies.tenantId, user.id)
    ),
  });
  const propertyCheck = await db.query.properties.findFirst({
    where: and(eq(properties.id, propertyId), eq(properties.ownerId, user.id)),
  });

  if (!tenancyCheck && !propertyCheck) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "FORBIDDEN",
          message: "Not authorized for this property",
        },
      },
      403
    );
  }

  const validation = await validateUploadedFile(
    photo,
    purpose === "bill_document" ? "bill-document" : "meter-photo"
  );
  if (!validation.valid) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INVALID_FILE",
          message: validation.error || "Invalid file.",
        },
      },
      400
    );
  }

  // --- Store in R2 ---
  // Key: propertyId/periodId/userId/timestamp.webp
  const timestamp = Date.now();
  const ext = photo.type === "image/webp" ? "webp" : "jpg";
  const objectKey = `${propertyId}/${periodId}/${user.id}/${timestamp}.${ext}`;

  await r2.put(objectKey, await photo.arrayBuffer(), {
    httpMetadata: { contentType: photo.type },
    customMetadata: {
      uploadedBy: user.id,
      periodId,
      propertyId,
      purpose,
      uploadedAt: new Date().toISOString(),
    },
  });

  // --- Cap enforcement in DB (Max 3 per period) ---
  try {
    const MAX_PHOTOS = 3;
    const existing = await db
      .select()
      .from(billPhotos)
      .where(
        and(
          eq(billPhotos.billingPeriodId, periodId),
          eq(billPhotos.uploadedBy, user.id)
        )
      );

    if (existing.length >= MAX_PHOTOS) {
      await r2.delete(objectKey);
      return c.json(
        {
          success: false as const,
          error: {
            code: "MAX_PHOTOS_EXCEEDED",
            message: `You can only attach up to ${MAX_PHOTOS} photos per reading. Any additional photos will not be saved.`,
          },
        },
        400
      );
    }

    const newVersion =
      existing.length > 0 ? Math.max(...existing.map((p) => p.version)) + 1 : 1;
    await db.insert(billPhotos).values({
      id: crypto.randomUUID(),
      propertyId,
      billingPeriodId: periodId,
      uploadedBy: user.id,
      objectKey,
      purpose,
      version: newVersion,
      status: "active",
      editRequestId: editRequestId ?? null,
    });
  } catch (err) {
    // If anything fails in the DB after we put the object in R2, clean it up
    await r2.delete(objectKey);
    throw err;
  }

  // --- Increment rate limit counter is handled automatically since we write to DB ---

  return c.json({
    success: true as const,
    data: {
      objectKey,
      sizeKb: Math.round(photo.size / 1024),
    },
  }, 200);
});

const listPhotosRoute = createRoute({
  method: 'get',
  path: '/bill-photos',
  tags: ['Uploads'],
  summary: 'List bill photos for a period',
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      periodId: z.string().openapi({ example: 'uuid-1234' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Photos listed successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Bad request',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Period not found',
    },
  },
});

uploadsRouter.openapi(listPhotosRoute, async (c) => {
  const user = c.get("user");
  const db = getDb(c.env.DB);
  const { periodId } = c.req.valid('query');

  // Get period and check access
  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodId))
    .limit(1);

  if (!period) {
    return c.json(
      { success: false as const, error: { code: 'NOT_FOUND', message: "Period not found" } },
      404
    );
  }

  // Check if user is owner or tenant
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, period.propertyId))
    .limit(1);
  const isOwner = property.ownerId === user.id;
  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(
      and(
        eq(tenancies.propertyId, period.propertyId),
        eq(tenancies.tenantId, user.id)
      )
    )
    .limit(1);

  if (!isOwner && !tenancy) {
    return c.json({ success: false as const, error: { code: 'UNAUTHORIZED', message: "Access denied" } }, 403);
  }

  // Get all photos for this period
  const photos = await db
    .select()
    .from(billPhotos)
    .where(
      and(
        eq(billPhotos.billingPeriodId, periodId),
        eq(billPhotos.status, "active")
      )
    )
    .orderBy(desc(billPhotos.uploadedAt));

  return c.json({ success: true as const, data: photos }, 200);
});

// Since the path contains a wildcard, OpenAPIHono might have issues with openapi() method for `*`. 
// We can define it as a generic route if possible, or use `{objectKey}` param but wildcard `*` is not standard OpenAPI.
// So we use `{objectKey}` with a custom path parameter and use standard OpenAPI spec.

export const getPhotoRoute = createRoute({
  method: 'get',
  path: '/bill-photo/{objectKey}',
  tags: ['Uploads'],
  summary: 'Get a bill photo',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      objectKey: z.string().openapi({ example: 'propertyId/periodId/userId/timestamp.webp' }),
    }),
  },
  responses: {
    200: {
      description: 'Photo streamed successfully',
      content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Bad request',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Internal server error',
    },
  },
});

// Use hono router fallback for `*` because of OpenAPI spec path matching with forward slashes in params
uploadsRouter.get("/bill-photo/*", async (c) => {
  const user = c.get("user");
  const r2 = c.env.BILL_PHOTOS;
  const db = getDb(c.env.DB);

  if (!r2) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 bucket is not configured",
        },
      },
      500
    );
  }

  // Extract full object key from path (everything after /bill-photo/)
  const objectKey = c.req.path.replace("/api/uploads/bill-photo/", "");

  // Security: object key format is propertyId/periodId/userId/timestamp.ext
  const parts = objectKey.split("/");
  if (parts.length < 4) {
    return c.json(
      {
        success: false as const,
        error: { code: "INVALID_KEY", message: "Invalid file key." },
      },
      400
    );
  }

  const propertyId = parts[0];
  const uId = parts[2];

  // Check if owner or tenant of this property
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: { code: "NOT_FOUND", message: "Property not found." },
      },
      404
    );
  }

  const isOwner = property.ownerId === user.id;
  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(
      and(eq(tenancies.propertyId, propertyId), eq(tenancies.tenantId, user.id))
    )
    .limit(1);
  const isTenant = !!tenancy;

  if (uId !== user.id && !isOwner && !isTenant) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not have access to this file.",
        },
      },
      403
    );
  }

  const object = await r2.get(objectKey);
  if (!object) {
    return c.json(
      {
        success: false as const,
        error: { code: "NOT_FOUND", message: "File not found." },
      },
      404
    );
  }

  // Stream the image
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/webp",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

const deletePhotoRoute = createRoute({
  method: 'delete',
  path: '/bill-photo/{id}',
  tags: ['Uploads'],
  summary: 'Delete a bill photo',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SimpleSuccessResponse } },
      description: 'Photo deleted successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Conflict',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Internal server error',
    },
  },
});

uploadsRouter.openapi(deletePhotoRoute, async (c) => {
  const user = c.get("user");
  const { id: photoId } = c.req.valid('param');
  const db = getDb(c.env.DB);
  const r2 = c.env.BILL_PHOTOS;

  if (!r2) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 bucket not configured",
        },
      },
      500
    );
  }

  const [photo] = await db
    .select()
    .from(billPhotos)
    .where(
      and(
        eq(billPhotos.id, photoId),
        eq(billPhotos.uploadedBy, user.id)
      )
    )
    .limit(1);

  if (!photo) {
    return c.json(
      {
        success: false as const,
        error: { code: "NOT_FOUND", message: "Photo not found" },
      },
      404
    );
  }

  // Block: cannot delete a photo linked to a pending edit request
  if (photo.editRequestId) {
    const [editReq] = await db
      .select()
      .from(editRequests)
      .where(
        and(
          eq(editRequests.id, photo.editRequestId),
          eq(editRequests.status, "pending")
        )
      )
      .limit(1);
    if (editReq) {
      return c.json(
        {
          success: false as const,
          error: {
            code: "EDIT_REQUEST_PENDING",
            message:
              "Cannot delete a photo attached to a pending edit request.",
          },
        },
        409
      );
    }
  }

  await r2.delete(photo.objectKey);
  await db.delete(billPhotos).where(eq(billPhotos.id, photoId));

  return c.json({ success: true as const }, 200);
});

export { uploadsRouter };
