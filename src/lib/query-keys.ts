export const queryKeys = {
  // Dashboard
  dashboardOwner: () => ["dashboard", "owner"] as const,
  dashboardTenant: () => ["dashboard", "tenant"] as const,

  // Users / invites
  currentUser: () => ["users", "me"] as const,
  pendingInvites: () => ["invites", "pending"] as const,

  // Notifications
  notifications: (limit?: number) =>
    limit
      ? (["notifications", { limit }] as const)
      : (["notifications"] as const),

  // Properties
  propertyTenancies: (propertyId: string) =>
    ["property", propertyId, "tenancies"] as const,
  propertyBills: (
    propertyId: string,
    year: string,
    status: string,
    tab?: string
  ) =>
    tab !== undefined
      ? (["property", propertyId, "bills", year, status, tab] as const)
      : (["property", propertyId, "bills", year, status] as const),
  propertyPeriod: (propertyId: string) =>
    ["property", propertyId, "period"] as const,
  propertyEditRequestCount: (propertyId: string) =>
    ["property", propertyId, "editRequestCount"] as const,
  propertyCharges: (propertyId: string) =>
    ["property", propertyId, "charges"] as const,

  // Bills
  billDetail: (billId: string) => ["bill", billId] as const,
} as const;
