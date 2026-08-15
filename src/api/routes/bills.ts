import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  properties,
  bills,
  billingPeriods,
  tenancies,
  meterReadings,
  editRequests,
  meterReadingEdits,
} from "../../db/schema";
import { user as userTable } from "../../db/schema/auth";
import { authMiddleware } from "../middleware/auth";
import { createNotification } from "../lib/notifications";
import { sendEmail, checkEmailRateLimit } from "../lib/email";
import {
  SuccessResponse,
  ErrorResponse,
  IdParam,
  createSuccessResponse,
} from "../lib/openapi-schemas";
import type { Bindings, Variables } from "../app";

const billsRouter = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

billsRouter.use("*", authMiddleware);

const BillResponseSchema = createSuccessResponse(
  z
    .object({
      bill: z.any(),
      period: z.any(),
      property: z.any(),
      reading: z.any(),
      tenancy: z.any(),
      isOwner: z.boolean(),
      isTenant: z.boolean(),
      submitterName: z.string().nullable(),
      editHistory: z.array(z.any()),
      canRequestEdit: z.boolean(),
      pendingEditRequestCount: z.number(),
      pendingEditRequest: z.any().nullable(),
    })
    .openapi({
      example: {
        bill: {},
        period: {},
        property: {},
        reading: {},
        tenancy: {},
        isOwner: true,
        isTenant: false,
        submitterName: null,
        editHistory: [],
        canRequestEdit: false,
        pendingEditRequestCount: 0,
        pendingEditRequest: null,
      },
    })
);

const getBillRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Bills"],
  summary: "Get bill details",
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: BillResponseSchema } },
      description: "Bill details retrieved",
    },
    403: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Bill not found",
    },
  },
});

billsRouter.openapi(getBillRoute, async (c) => {
  const { id: billId } = c.req.valid("param");
  const db = getDb(c.env.DB);

  const [bill] = await db
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);
  if (!bill) {
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );
  }

  const user = c.get("user");

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, bill.billingPeriodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );
  }
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, period.propertyId))
    .limit(1);
  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(eq(tenancies.id, bill.tenancyId))
    .limit(1);
  if (!property || !tenancy) {
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );
  }
  const [reading] = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.billingPeriodId, period.id))
    .limit(1);

  if (property.ownerId !== user.id && tenancy.tenantId !== user.id) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not have access to this bill",
        },
      },
      403
    );
  }

  let submitterName = null;
  if (reading?.submittedBy) {
    const [submitter] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, reading.submittedBy))
      .limit(1);
    submitterName = submitter?.name || null;
  }

  // ponytail: fetch active pending request if one exists for this tenant/period (guard null tenantId)
  const tenantUserId = tenancy.tenantId;
  const pendingRequests = tenantUserId
    ? await db
        .select()
        .from(editRequests)
        .where(
          and(
            eq(editRequests.billingPeriodId, period.id),
            eq(editRequests.requestedBy, tenantUserId),
            eq(editRequests.status, "pending")
          )
        )
        .orderBy(desc(editRequests.createdAt))
    : [];

  const pendingRequest = pendingRequests[0] ?? null;
  const pendingEditRequestCount = pendingRequests.length;

  // ponytail: query edit history with the editor name mapped
  const editHistoryRows = reading
    ? await db
        .select({
          id: meterReadingEdits.id,
          editedByName: userTable.name,
          versionBefore: meterReadingEdits.versionBefore,
          versionAfter: meterReadingEdits.versionAfter,
          reason: meterReadingEdits.reason,
          newValues: meterReadingEdits.newValues,
          oldValues: meterReadingEdits.oldValues,
          editedAt: meterReadingEdits.editedAt,
        })
        .from(meterReadingEdits)
        .leftJoin(userTable, eq(meterReadingEdits.editedBy, userTable.id))
        .where(eq(meterReadingEdits.meterReadingId, reading.id))
        .orderBy(desc(meterReadingEdits.editedAt))
    : [];

  const parseJsonSafe = (raw: string | null) => {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  };

  const formattedEditHistory = editHistoryRows.map((row) => {
    return {
      ...row,
      oldValues: parseJsonSafe(row.oldValues),
      newValues: parseJsonSafe(row.newValues),
      editedAt: row.editedAt?.toISOString() || null,
    };
  });

  return c.json(
    {
      success: true as const,
      data: {
        bill,
        period,
        property,
        reading,
        tenancy,
        isOwner: property.ownerId === user.id,
        isTenant: tenancy.tenantId === user.id,
        submitterName,
        editHistory: formattedEditHistory,
        canRequestEdit:
          tenancy.tenantId === user.id && period.status === "confirmed",
        pendingEditRequestCount,
        pendingEditRequest: pendingRequest
          ? {
              id: pendingRequest.id,
              reason: pendingRequest.reason,
              proposedValues: parseJsonSafe(pendingRequest.proposedValues),
              createdAt: pendingRequest.createdAt?.toISOString() || null,
            }
          : null,
      },
    },
    200
  );
});

const markPaidRoute = createRoute({
  method: "patch",
  path: "/{id}/mark-paid",
  tags: ["Bills"],
  summary: "Mark bill as paid",
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponse } },
      description: "Bill marked as paid",
    },
    403: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Bill not found",
    },
  },
});

billsRouter.openapi(markPaidRoute, async (c) => {
  const { id: billId } = c.req.valid("param");
  const user = c.get("user");
  const db = getDb(c.env.DB);

  const [bill] = await db
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);
  if (!bill) {
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );
  }

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, bill.billingPeriodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );
  }
  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);

  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the property owner can mark bills as paid",
        },
      },
      403
    );
  }

  await db
    .update(bills)
    .set({
      status: "paid",
      markedPaidAt: new Date(),
      markedPaidBy: user.id,
    })
    .where(eq(bills.id, billId));

  const [updatedBill] = await db
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(eq(tenancies.id, updatedBill.tenancyId))
    .limit(1);
  if (tenancy && tenancy.tenantId) {
    c.executionCtx.waitUntil(
      createNotification(
        db,
        tenancy.tenantId,
        "payment_received",
        "Payment Received",
        `Your payment for bill of ${period.periodMonth} has been marked as received.`,
        { billId, propertyId: property.id }
      )
    );
  }

  return c.json(
    {
      success: true as const,
      data: updatedBill,
    },
    200
  );
});

const remindRoute = createRoute({
  method: "post",
  path: "/{id}/remind",
  tags: ["Bills"],
  summary: "Send payment reminder",
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), message: z.string() }),
        },
      },
      description: "Reminder sent",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Bad request",
    },
    403: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Bill not found",
    },
    429: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Rate limit exceeded",
    },
  },
});

billsRouter.openapi(remindRoute, async (c) => {
  const { id: billId } = c.req.valid("param");
  const user = c.get("user");
  const db = getDb(c.env.DB);

  if (!checkEmailRateLimit(user.id)) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Please wait a minute before sending another reminder",
        },
      },
      429
    );
  }

  const [bill] = await db
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);
  if (!bill)
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );

  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, bill.billingPeriodId))
    .limit(1);
  if (!period) {
    return c.json(
      {
        success: false as const,
        error: { code: "BILL_NOT_FOUND", message: "Bill not found" },
      },
      404
    );
  }
  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(eq(properties.id, period.propertyId), eq(properties.ownerId, user.id))
    )
    .limit(1);

  if (!property)
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Only owner can send reminders",
        },
      },
      403
    );

  const [tenancy] = await db
    .select()
    .from(tenancies)
    .where(eq(tenancies.id, bill.tenancyId))
    .limit(1);
  if (!tenancy || !tenancy.tenantId) {
    return c.json(
      {
        success: false as const,
        error: { code: "NO_TENANT", message: "No active tenant for this bill" },
      },
      400
    );
  }

  const [tenant] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, tenancy.tenantId))
    .limit(1);

  if (tenant) {
    c.executionCtx.waitUntil(
      sendEmail(c.env, {
        to: tenant.email,
        subject: `Payment Reminder: ${property.name} Bill for ${period.periodMonth}`,
        html: `<p>Hi ${tenant.name},</p><p>This is a reminder that your bill for ${period.periodMonth} at ${property.name} is ready and pending payment. The total amount is ₹${bill.totalDue}.</p>`,
      }).catch((err) => console.error("Failed to send reminder:", err))
    );

    c.executionCtx.waitUntil(
      createNotification(
        db,
        tenant.id,
        "payment_reminder",
        "Payment Reminder",
        `Reminder: Your bill of ₹${bill.totalDue} for ${period.periodMonth} is due.`,
        { billId, propertyId: property.id }
      )
    );
  }

  return c.json({ success: true as const, message: "Reminder sent" }, 200);
});

export { billsRouter };
