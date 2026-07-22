export type PendingInvite = {
  inviteToken: string;
  propertyName: string;
  propertyAddress: string | null;
  splitPercentage: number | null;
};

export type UserProfile = {
  id: string;
  name?: string;
  primaryRole: "owner" | "tenant" | "both";
};

export type OwnerDashboardStats = {
  totalProperties: number;
  activeTenants: number;
  totalInvitedTenants: number;
  totalPeriods: number;
  outstandingAmount: number;
  totalExportEarnings: number;
  monthlyExportEarnings: { month: string; earnings: number }[];
  billsVsPaid: { month: string; billed: number; paid: number }[];
  outstandingBills: Array<{
    id: string;
    property: string;
    tenant: string;
    month: string;
    amount: number;
    status: string;
  }>;
  propertyConsumption: Array<{
    month: string;
    property: string;
    consumption: number;
  }>;
  importVsExport: Array<{ month: string; imported: number; exported: number }>;
  cumulativeProfit: Array<{ month: string; cumulative: number }>;
  momComparison: {
    lastMonth: {
      units: number;
      billed: number;
      collected: number;
      solarEarnings: number;
    };
    thisMonth: {
      units: number;
      billed: number;
      collected: number;
      solarEarnings: number;
    };
  } | null;
  solarGenVsIncome: Array<{
    month: string;
    solarKwh: number;
    exportEarnings: number;
  }>;
  properties: Array<{ id: string; name: string; address?: string | null }>;
};

export type BillDataBrief = {
  totalDue: number | null;
  status: "pending" | "paid";
};

export type TenantDashboardStats = {
  currentBill: BillDataBrief | null;
  lastBill: BillDataBrief | null;
  momChange: number;
  ytdPaid: number;
  monthlyTrend: { month: string; amount: number }[];
  unitsConsumed: { month: string; units: number }[];
  billBreakdown: { grid: number; solar: number; charges: number };
  solarSavings: { month: string; withoutSolar: number; actual: number }[];
  activeTenancies: Array<{
    propertyName: string;
    propertyAddress: string | null;
    propertyId: string;
    tenancyId: string;
    billStatus: "paid" | "pending" | null;
    currentBillAmount: number | null;
    currentRates?: {
      consumptionRate: number;
      exportRate: number | null;
    } | null;
  }>;
  pastTenancies: Array<{
    propertyName: string;
    stayRange: string;
    totalBills: number;
    allPaid: boolean;
    tenancyId: string;
    isPropertyDeleted?: boolean;
  }>;
  archivedTenancies?: Array<{
    propertyName: string;
    stayRange: string;
    totalBills: number;
    allPaid: boolean;
    tenancyId: string;
    isPropertyDeleted?: boolean;
  }>;
  consumptionVsBill: Array<{ month: string; units: number; amount: number }>;
  momComparison: {
    lastMonth: { units: number; amount: number; solarSavings: number };
    thisMonth: { units: number; amount: number; solarSavings: number };
  } | null;
};
