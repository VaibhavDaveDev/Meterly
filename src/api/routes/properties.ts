import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  properties,
  tenancies,
  bills,
  billingPeriods,
  meterReadings,
  editRequests,
  propertyRates,
  customCharges,
  notifications,
  user as userTable,
} from "../../db/schema";
import { authMiddleware } from "../middleware/auth";
import { ensureOwnerTenancy, deactivateOwnerTenancy } from "../lib/solo-mode";
import { requirePropertyAccess, requireOwner } from "../lib/property-auth";
import { sweepOrphanedPropertyData } from "../lib/property-cleanup";
import { createNotification } from "../lib/notifications";
import type { Bindings, Variables } from "../app";
import { SuccessResponse, SimpleSuccessResponse, ErrorResponse, IdParam } from "../lib/openapi-schemas";

const propertiesRouter = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

propertiesRouter.use('*', authMiddleware);

const CreatePropertySchema = z.object({
  name: z
    .string()
    .min(1, "Property name is required")
    .max(100, "Property name too long (max 100 characters)"),
  address: z
    .string()
    .max(200, "Address too long (max 200 characters)")
    .optional(),
  hasSolar: z.boolean().default(false),
  solarGenInitial: z.number().min(0).optional(),
  solarExportInitial: z.number().min(0).optional(),
  importInitial: z.number().min(0).optional(),
  soloMode: z.boolean().default(false), // true = owner tracks own bills, skip tenant invite
});

const checkNameRoute = createRoute({
  method: 'get',
  path: '/check-name',
  tags: ['Properties'],
  summary: 'Check if a property name already exists for the owner',
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      name: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ exists: z.boolean() }) } },
      description: 'Check result',
    },
  },
});

propertiesRouter.openapi(checkNameRoute, async (c) => {
  const user = c.get("user");
  const { name } = c.req.valid('query');
  const db = getDb(c.env.DB);

  if (!name) {
    return c.json({ exists: false }, 200);
  }

  const [existing] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.ownerId, user.id), eq(properties.name, name)))
    .limit(1);

  return c.json({ exists: !!existing }, 200);
});

const listPropertiesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Properties'],
  summary: 'List all properties where user is owner or tenant',
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      include_archived: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Properties retrieved',
    },
  },
});

propertiesRouter.openapi(listPropertiesRoute, async (c) => {
  const user = c.get("user");
  const db = getDb(c.env.DB);
  const { include_archived } = c.req.valid('query');
  const includeArchived = include_archived === "true";

  // Properties owned by user
  const ownedProps = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.ownerId, user.id),
        includeArchived ? undefined : sql`${properties.archivedAt} IS NULL`
      )
    );

  // Augment owned properties with extra dashboard data
  const augmentedOwned = [];
  for (const prop of ownedProps) {
    // 1. Tenant count
    const activeT = await db
      .select()
      .from(tenancies)
      .where(
        and(eq(tenancies.propertyId, prop.id), eq(tenancies.status, "active"))
      );

    // 2. Current period status
    const [currentPeriod] = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.propertyId, prop.id))
      .orderBy(desc(billingPeriods.periodMonth))
      .limit(1);

    // 3. Last bill stats (handled by latest confirmed logic below)

    let lastBillTotal = null;
    let lastBillMonth = null;
    let lastBillPaidCount = null;
    let lastBillTenantCount = null;

    // The previous logic was a bit messy, let's just get the latest confirmed period
    const latestConfirmedPeriods = await db
      .select()
      .from(billingPeriods)
      .where(
        and(
          eq(billingPeriods.propertyId, prop.id),
          eq(billingPeriods.status, "confirmed")
        )
      )
      .orderBy(desc(billingPeriods.periodMonth))
      .limit(1);

    if (latestConfirmedPeriods.length > 0) {
      const p = latestConfirmedPeriods[0];
      const pBills = await db
        .select()
        .from(bills)
        .where(eq(bills.billingPeriodId, p.id));
      lastBillMonth = p.periodMonth;
      lastBillTotal = pBills.reduce((acc, b) => acc + Number(b.totalDue), 0);
      lastBillTenantCount = pBills.length;
      lastBillPaidCount = pBills.filter((b) => b.status === "paid").length;
    }

    augmentedOwned.push({
      ...prop,
      tenantCount: activeT.length,
      currentPeriodStatus: currentPeriod ? currentPeriod.status : null,
      currentPeriodMonth: currentPeriod ? currentPeriod.periodMonth : null,
      lastBillTotal,
      lastBillMonth,
      lastBillPaidCount,
      lastBillTenantCount,
    });
  }

  // Properties where user is currently a tenant
  const tenantActiveData = await db
    .select({ property: properties, tenancy: tenancies })
    .from(tenancies)
    .innerJoin(properties, eq(tenancies.propertyId, properties.id))
    .where(
      and(eq(tenancies.tenantId, user.id), eq(tenancies.status, "active"))
    );

  const augmentedTenantActive = [];
  for (const row of tenantActiveData) {
    const activeT = await db
      .select()
      .from(tenancies)
      .where(
        and(
          eq(tenancies.propertyId, row.property.id),
          eq(tenancies.status, "active")
        )
      );
    const realTenants = activeT.filter((t) => !t.isOwnerTenancy);
    augmentedTenantActive.push({
      ...row.property,
      splitPercentage: row.tenancy.splitPercentage,
      tenantCount: realTenants.length,
    });
  }

  // Properties where user was previously a tenant (inactive)
  const tenantPast = await db
    .select({ property: properties })
    .from(tenancies)
    .innerJoin(properties, eq(tenancies.propertyId, properties.id))
    .where(
      and(eq(tenancies.tenantId, user.id), eq(tenancies.status, "inactive"))
    );

  return c.json({
    success: true as const,
    data: {
      owned: augmentedOwned,
      tenant: augmentedTenantActive,
      tenantPast: tenantPast.map((t) => t.property),
    },
  }, 200);
});

const createPropertyRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Properties'],
  summary: 'Create a new property',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreatePropertySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Property created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Validation error',
    },
  },
});

propertiesRouter.openapi(createPropertyRoute, async (c) => {
  const user = c.get("user");
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const newPropertyId = crypto.randomUUID();
  await db.insert(properties).values({
    id: newPropertyId,
    ownerId: user.id,
    name: data.name,
    address: data.address,
    hasSolar: data.hasSolar,
    solarGenInitial: data.hasSolar
      ? (data.solarGenInitial ?? 0)
      : 0,
    solarExportInitial: data.hasSolar
      ? (data.solarExportInitial ?? 0)
      : 0,
    importInitial: data.hasSolar
      ? (data.importInitial ?? 0)
      : null,
    solarActivatedAt: data.hasSolar ? new Date() : null,
    soloMode: data.soloMode,
    soloModeChangedAt: data.soloMode ? new Date() : null,
  });

  // If solo mode: auto-create an owner tenancy so billing engine works without real tenants
  if (data.soloMode) {
    await ensureOwnerTenancy(db, newPropertyId, user.id);
  }

  // If user was only a tenant, upgrade them to 'both'
  await db
    .update(userTable)
    .set({ primaryRole: "both" })
    .where(and(eq(userTable.id, user.id), eq(userTable.primaryRole, "tenant")));

  const [newProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, newPropertyId))
    .limit(1);

  return c.json({
    success: true as const,
    data: newProperty,
  }, 200);
});

const getPropertyRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Properties'],
  summary: 'Get property details',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Property retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
  },
});

propertiesRouter.openapi(getPropertyRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const access = await requirePropertyAccess(db, propertyId, user.id);
  if (!access) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not have access to this property",
        },
      },
      403
    );
  }
  const { property } = access;

  return c.json({
    success: true as const,
    data: property,
  }, 200);
});

const getPropertyPeriodsRoute = createRoute({
  method: 'get',
  path: '/{id}/periods',
  tags: ['Properties'],
  summary: 'Get billing periods for a property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    query: z.object({
      context: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Periods retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
  },
});

propertiesRouter.openapi(getPropertyPeriodsRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const { context, limit: limitStr } = c.req.valid('query');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const db = getDb(c.env.DB);

  const access = await requirePropertyAccess(db, propertyId, user.id);
  if (!access) {
    return c.json(
      {
        success: false as const,
        error: { code: "UNAUTHORIZED", message: "Access denied" },
      },
      403
    );
  }
  const { tenancy } = access;

  // Fetch periods
  const baseQuery = db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.propertyId, propertyId))
    .orderBy(desc(billingPeriods.periodMonth));
  const periods = await (limit ? baseQuery.limit(limit) : baseQuery);
  if (periods.length === 0) {
    return c.json({ success: true as const, data: { activePeriod: null, stats: null } }, 200);
  }

  // If we only want the current/latest period
  if (context === "current" || limit === 1) {
    const activePeriod = periods[0];
    const pBills = await db
      .select()
      .from(bills)
      .where(eq(bills.billingPeriodId, activePeriod.id));

    // Fetch tenants info for names
    const tIds = pBills.map((b) => b.tenancyId);
    let tInfo: (typeof tenancies.$inferSelect)[] = [];
    let userNameMap = new Map<string, string>();
    if (tIds.length > 0) {
      // Drizzle inArray needs at least one element
      const { inArray } = await import("drizzle-orm");
      tInfo = await db
        .select()
        .from(tenancies)
        .where(inArray(tenancies.id, tIds));

      const userIds = tInfo.map((t) => t.tenantId).filter(Boolean) as string[];
      if (userIds.length > 0) {
        const userNames = await db
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(inArray(userTable.id, userIds));
        userNameMap = new Map(userNames.map((u) => [u.id, u.name]));
      }
    }
    const tenantMap = new Map(
      tInfo.map((t) => [
        t.id,
        (t.tenantId && userNameMap.get(t.tenantId)) ||
          t.inviteEmail ||
          "Unknown",
      ])
    );

    const augmentedBills = pBills.map((b) => ({
      billId: b.id,
      tenantName: tenantMap.get(b.tenancyId) || "Unknown Tenant",
      amount: Number(b.totalDue),
      status: b.status,
      isSelf: b.tenancyId === tenancy?.id,
    }));

    const paidThisPeriod = augmentedBills.filter(
      (b) => b.status === "paid"
    ).length;

    return c.json({
      success: true as const,
      data: {
        activePeriod: {
          id: activePeriod.id,
          periodMonth: activePeriod.periodMonth,
          calculationMode: activePeriod.calculationMode,
          status: activePeriod.status,
          submittedAt: activePeriod.submittedAt
            ? activePeriod.submittedAt.toISOString()
            : null,
          submittedByName: activePeriod.submittedBy,
          bills: augmentedBills,
        },
        stats: {
          totalTenants: augmentedBills.length,
          paidThisPeriod,
        },
      },
    }, 200);
  }

  return c.json({
    success: true as const,
    data: periods,
  }, 200);
});

const SoloModeSchema = z.object({
  soloMode: z.boolean(),
});

const toggleSoloModeRoute = createRoute({
  method: 'patch',
  path: '/{id}/mode',
  tags: ['Properties'],
  summary: 'Toggle solo mode on/off',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: SoloModeSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Solo mode toggled',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or invalid input',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Cannot switch with active tenants',
    },
  },
});

propertiesRouter.openapi(toggleSoloModeRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PROPERTY_NOT_FOUND",
          message: "Property not found or you are not the owner",
        },
      },
      404
    );
  }

  const turningOnSolo = data.soloMode && !property.soloMode;
  const turningOffSolo = !data.soloMode && property.soloMode;

  // Guard: cannot switch to solo while real tenants are active
  if (turningOnSolo) {
    const activeTenants = await db
      .select()
      .from(tenancies)
      .where(
        and(
          eq(tenancies.propertyId, propertyId),
          eq(tenancies.status, "active")
        )
      );
    const activeTenant = activeTenants.find((t) => !t.isOwnerTenancy);

    if (activeTenant) {
      return c.json(
        {
          success: false as const,
          error: {
            code: "ACTIVE_TENANTS_EXIST",
            message:
              "Cannot switch to solo mode while active tenants exist. Remove all tenants first.",
          },
        },
        409
      );
    }
  }

  // Flip the mode
  await db
    .update(properties)
    .set({
      soloMode: data.soloMode,
      soloModeChangedAt: new Date(), // record when mode changed (used by UI timeline marker)
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  if (turningOnSolo) {
    // Create or reactivate the owner tenancy
    await ensureOwnerTenancy(db, propertyId, user.id);
  } else if (turningOffSolo) {
    // Deactivate the owner tenancy so billing engine won't use it
    await deactivateOwnerTenancy(db, propertyId, user.id);
  }

  const [updated] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return c.json({ success: true as const, data: updated }, 200);
});

const SolarToggleSchema = z
  .object({
    hasSolar: z.boolean(),
    solarGenInitial: z.number().min(0).optional(),
    solarExportInitial: z.number().min(0).optional(),
    importInitial: z.number().min(0).optional(),
  })
  .refine(
    (data) =>
      !data.hasSolar ||
      (data.solarGenInitial !== undefined &&
        data.solarExportInitial !== undefined &&
        data.importInitial !== undefined),
    {
      message: "Initial meter readings are required when enabling solar mode",
      path: ["solarGenInitial"],
    }
  );

const toggleSolarRoute = createRoute({
  method: 'patch',
  path: '/{id}/solar',
  tags: ['Properties'],
  summary: 'Enable/disable solar mode',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: SolarToggleSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Solar mode toggled',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or validation error',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

propertiesRouter.openapi(toggleSolarRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PROPERTY_NOT_FOUND",
          message: "Property not found or you are not the owner",
        },
      },
      404
    );
  }

  await db
    .update(properties)
    .set({
      hasSolar: data.hasSolar,
      solarGenInitial: data.solarGenInitial ?? 0,
      solarExportInitial: data.solarExportInitial ?? 0,
      importInitial: data.hasSolar
        ? (data.importInitial ?? 0)
        : null,
      solarActivatedAt: data.hasSolar ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  const [updatedProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return c.json({
    success: true as const,
    data: updatedProperty,
  }, 200);
});

const getPropertyBillsRoute = createRoute({
  method: 'get',
  path: '/{id}/bills',
  tags: ['Properties'],
  summary: 'Get all bills for a property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    query: z.object({
      year: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Bills retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

propertiesRouter.openapi(getPropertyBillsRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const { year: yearQuery, status: statusFilterQuery } = c.req.valid('query');
  const year = yearQuery || "all";
  const statusFilter = statusFilterQuery || "all";
  const db = getDb(c.env.DB);

  const access = await requirePropertyAccess(db, propertyId, user.id);
  if (!access) {
    return c.json(
      {
        success: false as const,
        error: { code: "NOT_FOUND", message: "Property not found" },
      },
      404
    );
  }
  const { property } = access;
  const isOwner = property.ownerId === user.id;

  if (!isOwner) {
    // Tenants are redirected to `/tenancies/:id/bills` in the UI, but API shouldn't crash if called.
    // We can just return a not authorized error or minimal payload, the UI handles redirect.
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Tenants should use the tenancy route",
        },
      },
      403
    );
  }

  // Owner flow: get all periods for property (with filtering)
  const periodsQuery = db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.propertyId, propertyId))
    .orderBy(desc(billingPeriods.periodMonth));
  const periods = await periodsQuery;

  // Filter periods by year if requested
  let filteredPeriods = periods;
  if (year !== "all") {
    filteredPeriods = periods.filter((p) => p.periodMonth.startsWith(year));
  }

  // Get all bills for these periods
  const periodIds = filteredPeriods.map((p) => p.id);

  let allBills: {
    bill: typeof bills.$inferSelect;
    tenantName: string | null;
    tenantEmail: string | null;
    splitPercentage: number | null;
  }[] = [];
  if (periodIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    allBills = await db
      .select({
        bill: bills,
        tenantEmail: tenancies.inviteEmail,
        tenantName: userTable.name,
        splitPercentage: tenancies.splitPercentage,
      })
      .from(bills)
      .innerJoin(tenancies, eq(bills.tenancyId, tenancies.id))
      .leftJoin(userTable, eq(tenancies.tenantId, userTable.id))
      .where(inArray(bills.billingPeriodId, periodIds));
  }

  // Group bills by period
  const groupedData = [];
  let totalBilled = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;

  for (const p of filteredPeriods) {
    let pBills = allBills.filter((b) => b.bill.billingPeriodId === p.id);

    // Apply status filter on bills
    if (statusFilter !== "all") {
      pBills = pBills.filter((b) => b.bill.status === statusFilter);
    }

    // Skip period if it has no bills after filtering (and we are actually filtering)
    if (statusFilter !== "all" && pBills.length === 0) continue;

    const tenants = pBills.map((b) => ({
      billId: b.bill.id,
      tenantName: b.tenantName || b.tenantEmail || "Unknown",
      splitPercentage: b.splitPercentage || 0,
      totalDue: Number(b.bill.totalDue),
      status: b.bill.status as "pending" | "paid",
      markedPaidAt: b.bill.markedPaidAt
        ? new Date(b.bill.markedPaidAt).toISOString()
        : null,
    }));

    // Aggregate summary
    pBills.forEach((b) => {
      totalBilled += Number(b.bill.totalDue);
      if (b.bill.status === "paid") {
        totalCollected += Number(b.bill.totalDue);
      } else {
        totalOutstanding += Number(b.bill.totalDue);
      }
    });

    const firstBill = pBills.length > 0 ? pBills[0].bill : null;

    groupedData.push({
      id: p.id,
      periodMonth: p.periodMonth,
      calculationMode: p.calculationMode,
      periodStatus: p.status,
      tenants,
      totalConsumption: firstBill ? Number(firstBill.totalConsumption || 0) : 0,
      exportRefund:
        p.calculationMode === "solar" && firstBill
          ? Number(firstBill.exportRefund || 0)
          : null,
    });
  }

  return c.json({
    success: true as const,
    data: {
      bills: groupedData,
      summary: {
        totalBilled,
        totalCollected,
        totalOutstanding,
      },
    },
  }, 200);
});

const exportBillsCsvRoute = createRoute({
  method: 'get',
  path: '/{id}/export/csv',
  tags: ['Properties'],
  summary: 'Owner downloads property billing history',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'text/csv': { schema: z.string() } },
      description: 'CSV file',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
  },
});

propertiesRouter.openapi(exportBillsCsvRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the property owner can export this data",
        },
      },
      403
    );
  }

  const result = await db
    .select({
      bill: bills,
      periodMonth: billingPeriods.periodMonth,
      tenantName:
        sql<string>`COALESCE(${userTable.name}, ${tenancies.inviteEmail})`.as(
          "tenant_name"
        ),
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(bills.billingPeriodId, billingPeriods.id))
    .innerJoin(tenancies, eq(bills.tenancyId, tenancies.id))
    .leftJoin(userTable, eq(tenancies.tenantId, userTable.id))
    .where(eq(billingPeriods.propertyId, propertyId))
    .orderBy(desc(billingPeriods.periodMonth));

  let csv =
    "Month,Tenant,Total Consumption,Split %,Tenant Consumption,Solar Self-Consumed,Consumption Cost,Export Refund,Custom Charges,Total Due,Status\n";
  result.forEach((row) => {
    const tenantName = row.tenantName || "Pending";
    csv += `"${row.periodMonth}","${tenantName}",${row.bill.totalConsumption},${row.bill.splitPercentage},${row.bill.tenantConsumption},${row.bill.solarSelfConsumed},${row.bill.consumptionCost},${row.bill.exportRefund},${row.bill.customChargesTotal},${row.bill.totalDue},${row.bill.status}\n`;
  });

  return c.text(csv, 200, {
    "Content-Type": "text/csv",
    "Content-Disposition": `attachment; filename="property-${propertyId}-bills.csv"`,
  });
});

// DELETE /api/properties/:id - Hard delete a property and ALL its child data.
//
// Deletion order (leaves → root, respecting FK constraints in SQLite):
//   1. edit_requests          (references billing_periods)
//   2. meter_reading_edits    (references meter_readings)
//   3. bills                  (references billing_periods + tenancies)
//   4. meter_readings         (references billing_periods)
//   5. custom_charges         (references properties)
//   6. billing_periods        (references properties)
//   7. tenancies              (references properties)
//   8. property_rates         (references properties)
//   9. notifications          (userId-scoped, filtered by metadata property_id)
//  10. properties             (root)
//
// R2 cleanup: bill photos are stored at `{userId}/{periodId}/{timestamp}.webp`.
// We collect all period IDs for this property, then purge every R2 object whose
// key starts with any of those period IDs. Runs via ctx.waitUntil so it does not
// block the HTTP response — if it fails, the DB data is already gone (acceptable
// for storage cleanup; no user-visible data remains).
const deletePropertyRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Properties'],
  summary: 'Hard delete a property and all child data',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SimpleSuccessResponse } },
      description: 'Property deleted',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Unauthorized',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Has pending requests',
    },
  },
});

propertiesRouter.openapi(deletePropertyRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the property owner can delete this property",
        },
      },
      403
    );
  }

  // Collect child IDs needed for cascade
  const propertyPeriods = await db
    .select({ id: billingPeriods.id })
    .from(billingPeriods)
    .where(eq(billingPeriods.propertyId, propertyId));
  const periodIds = propertyPeriods.map((p) => p.id);

  // Check for pending edit requests
  if (periodIds.length > 0) {
    const [pendingRequest] = await db
      .select({ id: editRequests.id })
      .from(editRequests)
      .where(
        and(
          inArray(editRequests.billingPeriodId, periodIds),
          eq(editRequests.status, "pending")
        )
      )
      .limit(1);

    if (pendingRequest) {
      return c.json(
        {
          success: false as const,
          error: {
            code: "HAS_PENDING_REQUESTS",
            message:
              "Cannot delete property with pending edit requests. Review or reject them first.",
          },
        },
        409
      );
    }
  }

  const propertyTenancies = await db
    .select({
      id: tenancies.id,
      tenantId: tenancies.tenantId,
      status: tenancies.status,
      isOwnerTenancy: tenancies.isOwnerTenancy,
    })
    .from(tenancies)
    .where(eq(tenancies.propertyId, propertyId));
  const tenancyIds = propertyTenancies.map((t) => t.id);
  const activeTenantsToNotify = propertyTenancies.filter(
    (t) => t.status === "active" && !t.isOwnerTenancy && t.tenantId
  );

  // --- Selective Cascade Delete ---

  // STEP 1: Snapshot property name/address into all bills for this property's periods
  if (periodIds.length > 0 && tenancyIds.length > 0) {
    await db
      .update(bills)
      .set({
        snapshotPropertyName: property.name,
        snapshotPropertyAddress: property.address ?? null,
      })
      .where(inArray(bills.tenancyId, tenancyIds));
  }

  // STEP 2: Soft-delete tenancies (status → 'property_deleted')
  // Do NOT hard-delete — bills FK depends on tenancies
  if (tenancyIds.length > 0) {
    await db
      .update(tenancies)
      .set({
        status: "property_deleted",
        leftAt: new Date(),
      })
      .where(eq(tenancies.propertyId, propertyId));
  }

  // STEP 3: Delete operational data.
  // Billing periods, bills, meter_readings, and bill_photos are KEPT — they form the tenant's permanent billing history.
  // Bills FK to billingPeriodId, so we cannot delete periods without breaking bill access.
  if (periodIds.length > 0) {
    await db
      .delete(editRequests)
      .where(inArray(editRequests.billingPeriodId, periodIds));
    // billingPeriods, meterReadings, meterReadingEdits, and billPhotos intentionally NOT deleted
  }

  await db
    .delete(customCharges)
    .where(eq(customCharges.propertyId, propertyId));
  await db
    .delete(propertyRates)
    .where(eq(propertyRates.propertyId, propertyId));

  // Notifications: stored per-user but tagged with property_id in metadata JSON.
  // SQLite doesn't have JSON_CONTAINS, so use a LIKE filter on the metadata column.
  await db
    .delete(notifications)
    .where(
      sql`json_extract(${notifications.metadata}, '$.property_id') = ${propertyId}`
    );

  // Delete the property itself
  await db.delete(properties).where(eq(properties.id, propertyId));

  // --- R2 cleanup (skipped) ---
  // Photos are intentionally kept to preserve proof of billing history.
  // HOWEVER, we will check if ALL tenants have ALREADY archived their tenancies,
  // in which case this property is fully orphaned and we can wipe the historical data.
  c.executionCtx.waitUntil(sweepOrphanedPropertyData(db, c.env, propertyId));

  // Send notifications to active tenants
  for (const t of activeTenantsToNotify) {
    if (t.tenantId) {
      c.executionCtx.waitUntil(
        createNotification(
          db,
          t.tenantId,
          "system",
          "Property Deleted",
          `The property ${property.name} has been deleted by the owner. Your past bills are still available.`,
          { propertyId }
        )
      );
    }
  }

  return c.json({ success: true as const }, 200);
});

const SettingsSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  paymentTrackingEnabled: z.boolean().optional(),
  readingsRequireApproval: z.boolean().optional(),
  maxPendingEditRequests: z.number().min(0).optional(),
  readingReminderDay: z.number().min(1).max(28).optional(),
});

const updateSettingsRoute = createRoute({
  method: 'patch',
  path: '/{id}/settings',
  tags: ['Properties'],
  summary: 'Update property settings',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: SettingsSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Settings updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID or validation error',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

propertiesRouter.openapi(updateSettingsRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PROPERTY_NOT_FOUND",
          message: "Property not found or you are not the owner",
        },
      },
      404
    );
  }

  await db
    .update(properties)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  const [updatedProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return c.json({
    success: true as const,
    data: updatedProperty,
  }, 200);
});

const archivePropertyRoute = createRoute({
  method: 'patch',
  path: '/{id}/archive',
  tags: ['Properties'],
  summary: 'Archive a property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Property archived',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Active tenants exist',
    },
  },
});

propertiesRouter.openapi(archivePropertyRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "PROPERTY_NOT_FOUND",
          message: "Property not found or you are not the owner",
        },
      },
      404
    );
  }

  // Block if active tenants exist
  const activeTenants = await db
    .select()
    .from(tenancies)
    .where(
      and(eq(tenancies.propertyId, propertyId), eq(tenancies.status, "active"))
    );
  // Filter out the owner's own tenancy for solo mode
  const realActiveTenants = activeTenants.filter((t) => !t.isOwnerTenancy);

  if (realActiveTenants.length > 0) {
    return c.json(
      {
        success: false as const,
        error: {
          code: "ACTIVE_TENANTS_EXIST",
          message:
            "Cannot archive a property while it has active tenants. Remove them first.",
        },
      },
      409
    );
  }

  await db
    .update(properties)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  const [updatedProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return c.json({
    success: true as const,
    data: updatedProperty,
  }, 200);
});

const unarchivePropertyRoute = createRoute({
  method: 'patch',
  path: '/{id}/unarchive',
  tags: ['Properties'],
  summary: 'Unarchive a property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Property unarchived',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

propertiesRouter.openapi(unarchivePropertyRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json(
      {
        success: false,
        error: {
          code: "PROPERTY_NOT_FOUND",
          message: "Property not found or you are not the owner",
        },
      },
      404
    );
  }

  await db
    .update(properties)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  const [updatedProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return c.json({
    success: true as const,
    data: updatedProperty,
  }, 200);
});

const getPropertyChartDataRoute = createRoute({
  method: 'get',
  path: '/{id}/chart-data',
  tags: ['Properties'],
  summary: 'Get chart data for a property',
  security: [{ cookieAuth: [] }],
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponse } },
      description: 'Chart data retrieved',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Missing ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponse } },
      description: 'Property not found',
    },
  },
});

propertiesRouter.openapi(getPropertyChartDataRoute, async (c) => {
  const user = c.get("user");
  const { id: propertyId } = c.req.valid('param');
  const db = getDb(c.env.DB);

  const property = await requireOwner(db, propertyId, user.id);
  if (!property) {
    return c.json({ success: false as const, error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const allData = await db
    .select({
      period: billingPeriods,
      reading: meterReadings,
      bill: bills,
    })
    .from(billingPeriods)
    .innerJoin(
      meterReadings,
      eq(billingPeriods.id, meterReadings.billingPeriodId)
    )
    .leftJoin(bills, eq(billingPeriods.id, bills.billingPeriodId))
    .where(
      and(
        eq(billingPeriods.propertyId, propertyId),
        eq(billingPeriods.status, "confirmed")
      )
    )
    .orderBy(billingPeriods.periodMonth);

  const periodsMap = new Map<
    string,
    {
      month: string;
      totalRevenue: number;
      totalConsumption: number;
      solarSavings: number | null;
      import: number;
      export: number;
      generated: number;
      billed: number;
      paid: number;
      exportEarnings: number;
    }
  >();

  for (const row of allData) {
    const month = row.period.periodMonth.slice(0, 7);
    if (!periodsMap.has(month)) {
      periodsMap.set(month, {
        month,
        totalRevenue: 0,
        totalConsumption:
          Number(row.reading.importEnd || 0) -
          Number(row.reading.importStart || 0),
        solarSavings: property.hasSolar ? 0 : null,
        import:
          Number(row.reading.importEnd || 0) -
          Number(row.reading.importStart || 0),
        export:
          Number(row.reading.exportEnd || 0) -
          Number(row.reading.exportStart || 0),
        generated:
          Number(row.reading.solarGenerationEnd || 0) -
          Number(row.reading.solarGenerationStart || 0),
        billed: 0,
        paid: 0,
        exportEarnings: 0,
      });
    }
    const p = periodsMap.get(month)!;
    if (row.bill) {
      const due = Number(row.bill.totalDue || 0);
      p.totalRevenue += due;
      p.billed += due;
      if (row.bill.status === "paid") p.paid += due;

      if (property.hasSolar) {
        const tenantConsumption = Number(row.bill.tenantConsumption || 0);
        const consumptionRate = Number(row.bill.consumptionRate || 0);
        const consumptionCost = Number(row.bill.consumptionCost || 0);
        const exportRefund = Number(row.bill.exportRefund || 0);

        p.exportEarnings += exportRefund;

        const billSolarSavings =
          tenantConsumption * consumptionRate - consumptionCost + exportRefund;
        p.solarSavings! += billSolarSavings;
      }
    }
  }

  // Join bills → tenancies → user table for tenant breakdown
  const tenantBills = await db
    .select({
      bill: bills,
      periodMonth: billingPeriods.periodMonth,
      tenantName: userTable.name,
      tenantEmail: tenancies.inviteEmail,
    })
    .from(bills)
    .innerJoin(billingPeriods, eq(bills.billingPeriodId, billingPeriods.id))
    .innerJoin(tenancies, eq(bills.tenancyId, tenancies.id))
    .leftJoin(userTable, eq(tenancies.tenantId, userTable.id))
    .where(
      and(
        eq(billingPeriods.propertyId, propertyId),
        eq(billingPeriods.status, "confirmed")
      )
    )
    .orderBy(billingPeriods.periodMonth);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const breakdownMap = new Map<string, Record<string, number | string>>();
  for (const row of tenantBills) {
    const month = row.periodMonth.slice(0, 7);
    const name = row.tenantName || row.tenantEmail || "Unknown";
    if (!breakdownMap.has(month)) breakdownMap.set(month, { month });
    const bm = breakdownMap.get(month)!;
    bm[name] = round2(Number(bm[name] || 0) + Number(row.bill.totalDue || 0));
  }
  const tenantBreakdown = Array.from(breakdownMap.values());

  const monthlyRevenue = Array.from(periodsMap.values()).map((p) => ({
    month: p.month,
    revenue: round2(p.totalRevenue),
  }));
  const monthlyConsumption = Array.from(periodsMap.values()).map((p) => ({
    month: p.month,
    units: round2(p.totalConsumption),
  }));

  const solarSavings = property.hasSolar
    ? Array.from(periodsMap.values()).map((p) => ({
        month: p.month,
        actual: round2(p.totalRevenue),
        withoutSolar: round2(p.totalRevenue + p.solarSavings!),
      }))
    : null;

  const importExport = Array.from(periodsMap.values()).map((p) => ({
    month: p.month,
    import: round2(p.import),
    export: round2(p.export),
  }));
  const billVsCollected = Array.from(periodsMap.values()).map((p) => ({
    month: p.month,
    billed: round2(p.billed),
    paid: round2(p.paid),
  }));

  let cumulative = 0;
  const cumulativeExportEarnings = property.hasSolar
    ? Array.from(periodsMap.values()).map((p) => {
        cumulative += p.exportEarnings;
        return { month: p.month, cumulative: round2(cumulative) };
      })
    : null;

  const solarDetail = property.hasSolar
    ? Array.from(periodsMap.values()).map((p) => ({
        month: p.month,
        generated: round2(p.generated),
        exported: round2(p.export),
        exportEarnings: round2(p.exportEarnings),
      }))
    : null;

  return c.json({
    success: true as const,
    data: {
      monthlyRevenue,
      monthlyConsumption,
      solarSavings,
      importExport,
      billVsCollected,
      tenantBreakdown,
      solarDetail,
      cumulativeExportEarnings,
    },
  }, 200);
});

export { propertiesRouter };
