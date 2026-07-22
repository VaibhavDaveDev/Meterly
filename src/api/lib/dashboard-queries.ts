/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, and, desc, inArray, isNull, isNotNull } from "drizzle-orm";
import { properties, bills, billingPeriods, tenancies } from "../../db/schema";
import type { Database } from "../../db";
import type { Property, Tenancy, Bill, BillingPeriod } from "../../types/db";

function sortMonthlyMap<T, R extends { month: string }>(
  map: Map<string, T>,
  mapper: (month: string, val: T) => R
): R[] {
  return Array.from(map.entries())
    .map(([month, val]) => mapper(month, val))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function getOwnerPropertyStats(db: Database, propertyIds: string[]) {
  if (propertyIds.length === 0)
    return { activeTenants: 0, totalInvitedTenants: 0, totalPeriods: 0 };

  const tenants = await db
    .select()
    .from(tenancies)
    .where(
      and(
        inArray(tenancies.propertyId, propertyIds),
        eq(tenancies.status, "active"),
        eq(tenancies.isOwnerTenancy, false)
      )
    );
  const invitedTenants = await db
    .select()
    .from(tenancies)
    .where(
      and(
        inArray(tenancies.propertyId, propertyIds),
        eq(tenancies.status, "invited")
      )
    );
  const periods = await db
    .select()
    .from(billingPeriods)
    .where(inArray(billingPeriods.propertyId, propertyIds));

  return {
    activeTenants: tenants.length,
    totalInvitedTenants: invitedTenants.length,
    totalPeriods: periods.length,
  };
}

function processOwnerBills(
  myProperties: Property[],
  allPropBills: Array<{
    bill: any;
    period: any;
    tenantEmail: string | null;
    propertyId: string;
  }>
) {
  let totalExportEarnings = 0;
  let outstandingAmount = 0;

  const monthlyExportMap = new Map<string, number>();
  const billsVsPaidMap = new Map<string, { billed: number; paid: number }>();
  const propertyConsumptionList: Array<{
    property: string;
    month: string;
    consumption: number;
  }> = [];
  const outstandingBillsList: Array<{
    id: string;
    property: string;
    tenant: string;
    amount: number;
    month: string;
    status: string;
  }> = [];
  const importVsExportMap = new Map<
    string,
    { imported: number; exported: number }
  >();
  const solarGenVsIncomeMap = new Map<
    string,
    { solarKwh: number; exportEarnings: number }
  >();

  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

  let thisMonthUnits = 0;
  let thisMonthBilled = 0;
  let thisMonthCollected = 0;
  let thisMonthSolarEarnings = 0;
  let lastMonthUnits = 0;
  let lastMonthBilled = 0;
  let lastMonthCollected = 0;
  let lastMonthSolarEarnings = 0;

  const periodExportHandled = new Set<string>();
  const propertyMap = new Map<string, Property>(
    myProperties.map((p: Property) => [p.id, p])
  );

  for (const { bill, period, tenantEmail, propertyId } of allPropBills) {
    const property = propertyMap.get(propertyId)!;
    const monthStr = period.periodMonth.substring(0, 7);

    if (property.hasSolar && !periodExportHandled.has(period.id)) {
      periodExportHandled.add(period.id);
      const refund = Number(bill.exportRefund) || 0;
      totalExportEarnings += refund;
      monthlyExportMap.set(
        monthStr,
        (monthlyExportMap.get(monthStr) || 0) + refund
      );

      const solarGen = Number(bill.solarGenerated) || 0;
      if (!solarGenVsIncomeMap.has(monthStr))
        solarGenVsIncomeMap.set(monthStr, { solarKwh: 0, exportEarnings: 0 });
      const sgData = solarGenVsIncomeMap.get(monthStr)!;
      sgData.solarKwh += solarGen;
      sgData.exportEarnings += refund;

      const imported = Number(bill.gridImported) || 0;
      const exported = Number(bill.gridExported) || 0;
      if (!importVsExportMap.has(monthStr))
        importVsExportMap.set(monthStr, { imported: 0, exported: 0 });
      const iveData = importVsExportMap.get(monthStr)!;
      iveData.imported += imported;
      iveData.exported += exported;

      if (monthStr === thisMonthStr) thisMonthSolarEarnings += refund;
      else if (monthStr === lastMonthStr) lastMonthSolarEarnings += refund;
    }

    const due = Number(bill.totalDue) || 0;
    const units = Number(bill.tenantConsumption) || 0;
    if (!billsVsPaidMap.has(monthStr))
      billsVsPaidMap.set(monthStr, { billed: 0, paid: 0 });
    const vsData = billsVsPaidMap.get(monthStr)!;
    vsData.billed += due;

    const isPaid = bill.status === "paid";
    if (isPaid) {
      vsData.paid += due;
    } else {
      outstandingAmount += due;
      outstandingBillsList.push({
        id: bill.id,
        property: property.name,
        tenant: tenantEmail || "Owner",
        amount: due,
        month: monthStr,
        status: bill.status,
      });
    }

    if (monthStr === thisMonthStr) {
      thisMonthBilled += due;
      thisMonthUnits += units;
      if (isPaid) thisMonthCollected += due;
    } else if (monthStr === lastMonthStr) {
      lastMonthBilled += due;
      lastMonthUnits += units;
      if (isPaid) lastMonthCollected += due;
    }

    propertyConsumptionList.push({
      property: property.name,
      month: monthStr,
      consumption: Number(bill.tenantConsumption) || 0,
    });
  }

  const monthlyExportEarnings = sortMonthlyMap(
    monthlyExportMap,
    (month, earnings) => ({ month, earnings })
  );

  let runningProfit = 0;
  const cumulativeProfit = monthlyExportEarnings.map((m) => {
    runningProfit += m.earnings;
    return { month: m.month, cumulative: runningProfit };
  });

  const billsVsPaid = sortMonthlyMap(billsVsPaidMap, (month, data) => ({
    month,
    billed: data.billed,
    paid: data.paid,
  }));
  const importVsExport = sortMonthlyMap(importVsExportMap, (month, data) => ({
    month,
    imported: data.imported,
    exported: data.exported,
  }));
  const solarGenVsIncome = sortMonthlyMap(
    solarGenVsIncomeMap,
    (month, data) => ({
      month,
      solarKwh: data.solarKwh,
      exportEarnings: data.exportEarnings,
    })
  );

  const momComparison = {
    lastMonth: {
      units: lastMonthUnits,
      billed: lastMonthBilled,
      collected: lastMonthCollected,
      solarEarnings: lastMonthSolarEarnings,
    },
    thisMonth: {
      units: thisMonthUnits,
      billed: thisMonthBilled,
      collected: thisMonthCollected,
      solarEarnings: thisMonthSolarEarnings,
    },
  };

  return {
    totalExportEarnings,
    outstandingAmount,
    outstandingBillsList,
    propertyConsumptionList,
    monthlyExportEarnings,
    cumulativeProfit,
    billsVsPaid,
    importVsExport,
    solarGenVsIncome,
    momComparison,
  };
}

export async function getOwnerDashboardStats(db: Database, ownerId: string) {
  const myProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, ownerId));

  if (myProperties.length === 0) {
    return {
      totalProperties: 0,
      activeTenants: 0,
      totalInvitedTenants: 0,
      totalPeriods: 0,
      outstandingAmount: 0,
      totalExportEarnings: 0,
      monthlyExportEarnings: [],
      billsVsPaid: [],
      outstandingBills: [],
      propertyConsumption: [],
      importVsExport: [],
      cumulativeProfit: [],
      momComparison: null,
      solarGenVsIncome: [],
      properties: [],
    };
  }

  const propertyIds = myProperties.map((p: Property) => p.id);
  const { activeTenants, totalInvitedTenants, totalPeriods } =
    await getOwnerPropertyStats(db, propertyIds);

  const allPropBills =
    propertyIds.length > 0
      ? await db
          .select({
            bill: bills,
            period: billingPeriods,
            tenantEmail: tenancies.inviteEmail,
            propertyId: billingPeriods.propertyId,
          })
          .from(bills)
          .innerJoin(
            billingPeriods,
            eq(bills.billingPeriodId, billingPeriods.id)
          )
          .innerJoin(tenancies, eq(bills.tenancyId, tenancies.id))
          .where(inArray(billingPeriods.propertyId, propertyIds))
          .orderBy(desc(billingPeriods.periodMonth))
      : [];

  const processed = processOwnerBills(myProperties, allPropBills);

  return {
    totalProperties: myProperties.length,
    activeTenants,
    totalInvitedTenants,
    totalPeriods,
    outstandingAmount: processed.outstandingAmount,
    totalExportEarnings: processed.totalExportEarnings,
    monthlyExportEarnings: processed.monthlyExportEarnings,
    billsVsPaid: processed.billsVsPaid,
    outstandingBills: processed.outstandingBillsList,
    propertyConsumption: processed.propertyConsumptionList,
    importVsExport: processed.importVsExport,
    cumulativeProfit: processed.cumulativeProfit,
    momComparison: processed.momComparison,
    solarGenVsIncome: processed.solarGenVsIncome,
    properties: myProperties
      .filter((p) => !p.archivedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
      })),
  };
}

async function processTenanciesList(
  db: Database,
  tenanciesDB: Array<{ tenancy: Tenancy; property: Property | null }>
) {
  const list: Array<{
    propertyName: string;
    stayRange: string;
    totalBills: number;
    allPaid: boolean;
    tenancyId: string;
    isPropertyDeleted: boolean;
  }> = [];

  for (const pt of tenanciesDB) {
    const tBills = await db
      .select()
      .from(bills)
      .where(eq(bills.tenancyId, pt.tenancy.id));
    const allPaid =
      tBills.length > 0 && tBills.every((b: Bill) => b.status === "paid");

    let stayRange = "Unknown";
    if (pt.tenancy.joinedAt) {
      const joinDate = new Date(pt.tenancy.joinedAt);
      const leaveDate = pt.tenancy.leftAt
        ? new Date(pt.tenancy.leftAt)
        : new Date();
      stayRange = `${joinDate.toLocaleString("default", { month: "short" })} ${joinDate.getFullYear()} - ${leaveDate.toLocaleString("default", { month: "short" })} ${leaveDate.getFullYear()}`;
    }

    const propertyName =
      pt.property?.name ??
      (tBills.length > 0 ? tBills[0].snapshotPropertyName : null) ??
      "Deleted Property";

    list.push({
      propertyName,
      stayRange,
      totalBills: tBills.length,
      allPaid,
      tenancyId: pt.tenancy.id,
      isPropertyDeleted: pt.tenancy.status === "property_deleted",
    });
  }
  return list;
}

function queryPastTenancies(db: Database, tenantId: string, archived: boolean) {
  return db
    .select({
      tenancy: tenancies,
      property: properties,
    })
    .from(tenancies)
    .leftJoin(properties, eq(tenancies.propertyId, properties.id))
    .where(
      and(
        eq(tenancies.tenantId, tenantId),
        inArray(tenancies.status, ["inactive", "property_deleted"]),
        archived
          ? isNotNull(tenancies.archivedByTenantAt)
          : isNull(tenancies.archivedByTenantAt)
      )
    );
}

async function fetchPastTenancyData(db: Database, tenantId: string) {
  const pastTenanciesDB = await queryPastTenancies(db, tenantId, false);
  const pastTenanciesList = await processTenanciesList(db, pastTenanciesDB);

  const archivedTenanciesDB = await queryPastTenancies(db, tenantId, true);
  const archivedTenanciesList = await processTenanciesList(
    db,
    archivedTenanciesDB
  );

  return { pastTenanciesList, archivedTenanciesList };
}

async function populateActiveTenancyBills(
  db: Database,
  activeTenanciesList: Array<{
    propertyName: string;
    propertyAddress: string | null;
    propertyId: string;
    tenancyId: string;
    billStatus: "paid" | "pending" | null;
    currentBillAmount: number | null;
    dueDate: string | null;
    currentRates?: {
      consumptionRate: number;
      exportRate: number | null;
    } | null;
  }>,
  tenancyIds: string[]
) {
  const allMyBills: Array<{
    bill: Bill;
    period: BillingPeriod;
    property: Property;
  }> = [];

  if (tenancyIds.length > 0) {
    const tBills = await db
      .select({
        bill: bills,
        period: billingPeriods,
        property: properties,
      })
      .from(bills)
      .innerJoin(billingPeriods, eq(bills.billingPeriodId, billingPeriods.id))
      .innerJoin(properties, eq(billingPeriods.propertyId, properties.id))
      .where(inArray(bills.tenancyId, tenancyIds))
      .orderBy(desc(billingPeriods.periodMonth));

    allMyBills.push(...tBills);

    for (const at of activeTenanciesList) {
      const prop = await db
        .select()
        .from(properties)
        .where(eq(properties.id, at.propertyId))
        .limit(1);
      if (prop[0]) {
        at.propertyName = prop[0].name;
        at.propertyAddress = prop[0].address;
      }

      const latestBill = tBills.find(
        (b: { bill: Bill; period: BillingPeriod; property: Property }) =>
          b.bill.tenancyId === at.tenancyId
      );
      if (latestBill) {
        at.billStatus = latestBill.bill.status as "paid" | "pending";
        at.currentBillAmount = Number(latestBill.bill.totalDue);
      }

      const { propertyRates } = await import("../../db/schema");
      const rates = await db
        .select()
        .from(propertyRates)
        .where(eq(propertyRates.propertyId, at.propertyId))
        .orderBy(desc(propertyRates.effectiveFrom))
        .limit(1);
      if (rates[0]) {
        at.currentRates = {
          consumptionRate: Number(rates[0].consumptionRate),
          exportRate:
            rates[0].exportRate !== null ? Number(rates[0].exportRate) : null,
        };
      }
    }
  }

  allMyBills.sort((a, b) =>
    b.period.periodMonth.localeCompare(a.period.periodMonth)
  );
  return allMyBills;
}

function buildTenantBillCharts(
  allMyBills: Array<{ bill: Bill; period: BillingPeriod; property: Property }>
) {
  let ytdPaid = 0;
  const currentBill = allMyBills[0]?.bill || null;
  const lastBill = allMyBills[1]?.bill || null;

  let momChange = 0;
  if (currentBill && lastBill && Number(lastBill.totalDue) > 0) {
    momChange =
      ((Number(currentBill.totalDue) - Number(lastBill.totalDue)) /
        Number(lastBill.totalDue)) *
      100;
  }

  const monthlyTrendMap = new Map<string, number>();
  const unitsConsumedMap = new Map<string, number>();
  const solarSavingsMap = new Map<
    string,
    { withoutSolar: number; actual: number }
  >();

  for (const { bill, period, property } of allMyBills) {
    const monthStr = period.periodMonth.substring(0, 7);
    const due = Number(bill.totalDue) || 0;
    const units = Number(bill.tenantConsumption) || 0;

    if (bill.status === "paid") {
      ytdPaid += due;
    }

    monthlyTrendMap.set(monthStr, (monthlyTrendMap.get(monthStr) || 0) + due);
    unitsConsumedMap.set(
      monthStr,
      (unitsConsumedMap.get(monthStr) || 0) + units
    );

    if (property.hasSolar) {
      const standardCost = units * (Number(bill.consumptionRate) || 0);

      solarSavingsMap.set(monthStr, {
        withoutSolar: standardCost + (Number(bill.customChargesTotal) || 0),
        actual: due,
      });
    }
  }

  const monthlyTrend = sortMonthlyMap(monthlyTrendMap, (month, amount) => ({
    month,
    amount,
  }));
  const unitsConsumed = sortMonthlyMap(unitsConsumedMap, (month, units) => ({
    month,
    units,
  }));
  const solarSavings = sortMonthlyMap(solarSavingsMap, (month, data) => ({
    month,
    withoutSolar: data.withoutSolar,
    actual: data.actual,
  }));
  const consumptionVsBill = sortMonthlyMap(
    monthlyTrendMap,
    (month, amount) => ({
      month,
      amount,
      units: unitsConsumedMap.get(month) || 0,
    })
  );

  let billBreakdown = { grid: 0, solar: 0, charges: 0 };
  if (currentBill) {
    billBreakdown = {
      grid: Number(currentBill.consumptionCost) || 0,
      solar: 0,
      charges: Number(currentBill.customChargesTotal) || 0,
    };
  }

  let momComparison = null;
  const getMomMonthData = (monthStr: string) => ({
    units: unitsConsumedMap.get(monthStr) || 0,
    amount: monthlyTrendMap.get(monthStr) || 0,
    solarSavings: solarSavingsMap.has(monthStr)
      ? solarSavingsMap.get(monthStr)!.withoutSolar -
        solarSavingsMap.get(monthStr)!.actual
      : 0,
  });

  if (monthlyTrend.length >= 2) {
    momComparison = {
      lastMonth: getMomMonthData(monthlyTrend[monthlyTrend.length - 2].month),
      thisMonth: getMomMonthData(monthlyTrend[monthlyTrend.length - 1].month),
    };
  } else if (monthlyTrend.length === 1) {
    momComparison = {
      lastMonth: { units: 0, amount: 0, solarSavings: 0 },
      thisMonth: getMomMonthData(monthlyTrend[0].month),
    };
  }

  return {
    currentBill,
    lastBill,
    momChange,
    ytdPaid,
    monthlyTrend,
    unitsConsumed,
    billBreakdown,
    solarSavings,
    consumptionVsBill,
    momComparison,
  };
}

export async function getTenantDashboardStats(db: Database, tenantId: string) {
  const activeTenancies = await db
    .select()
    .from(tenancies)
    .where(
      and(eq(tenancies.tenantId, tenantId), eq(tenancies.status, "active"))
    );

  if (activeTenancies.length === 0) {
    return {
      currentBill: null,
      lastBill: null,
      momChange: 0,
      ytdPaid: 0,
      monthlyTrend: [],
      unitsConsumed: [],
      billBreakdown: { grid: 0, solar: 0, charges: 0 },
      solarSavings: [],
      consumptionVsBill: [],
      momComparison: null,
      activeTenancies: [],
      pastTenancies: [],
    };
  }

  const activeTenanciesList = activeTenancies.map((t) => ({
    propertyName: "",
    propertyAddress: null as string | null,
    propertyId: t.propertyId,
    tenancyId: t.id,
    billStatus: null as "paid" | "pending" | null,
    currentBillAmount: null as number | null,
    dueDate: null as string | null,
    currentRates: null as {
      consumptionRate: number;
      exportRate: number | null;
    } | null,
  }));

  const { pastTenanciesList, archivedTenanciesList } =
    await fetchPastTenancyData(db, tenantId);
  const tenancyIds = activeTenancies.map((t: Tenancy) => t.id);
  const allMyBills = await populateActiveTenancyBills(
    db,
    activeTenanciesList,
    tenancyIds
  );
  const charts = buildTenantBillCharts(allMyBills);

  return {
    ...charts,
    activeTenancies: activeTenanciesList,
    pastTenancies: pastTenanciesList,
    archivedTenancies: archivedTenanciesList,
  };
}
