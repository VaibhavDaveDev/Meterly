import { useState, useEffect } from 'react';
import type { Tenancy } from '../types/db';
import { apiClient } from '../lib/api-client';
import type { ActiveBillingPeriod } from '../components/properties/types';

type PropertyBillsResponse = {
  bills: Array<{
    id: string;
    periodMonth: string;
    calculationMode: 'solar' | 'grid_only';
    periodStatus: string;
    tenants: Array<{
      billId: string;
      tenantName: string;
      splitPercentage: number;
      totalDue: number;
      status: 'pending' | 'paid';
      markedPaidAt: string | null;
    }>;
    totalConsumption: number;
    exportRefund: number | null;
  }>;
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
  };
};

export function usePropertyData(
  propertyId: string,
  activeTab: string,
  filterYear: string,
  filterStatus: string,
  initialTenantCount: number,
  isOwner: boolean
) {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [billsData, setBillsData] = useState<PropertyBillsResponse | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [tenantCount, setTenantCount] = useState(initialTenantCount);
  const [activePeriod, setActivePeriod] = useState<ActiveBillingPeriod | null>(null);

  const fetchTenancies = async () => {
    setIsLoadingTenants(true);
    const { data } = await apiClient.get<{ active: Tenancy[]; invited: Tenancy[]; past: Tenancy[] }>(`/properties/${propertyId}/tenancies`);
    if (data) {
      const allTenancies = [...data.active, ...data.invited, ...data.past];
      setTenancies(allTenancies);
      setTenantCount(data.active.length);
    }
    setIsLoadingTenants(false);
  };

  const fetchBills = async () => {
    if (!isOwner) return;
    setIsLoadingBills(true);
    const qs = activeTab === 'bills' ? `?year=${filterYear}&status=${filterStatus}` : '';
    const { data } = await apiClient.get<PropertyBillsResponse>(`/properties/${propertyId}/bills${qs}`);
    if (data) {
      setBillsData(data);
    }
    setIsLoadingBills(false);
  };

  const fetchLatestPeriod = async () => {
    const { data } = await apiClient.get<{
      activePeriod: ActiveBillingPeriod | null;
      stats?: {
        totalTenants: number;
        paidThisPeriod: number;
      } | null;
    }>(`/properties/${propertyId}/periods?limit=1&context=current`);
    if (data && data.activePeriod) {
      setActivePeriod(data.activePeriod);
    } else {
      setActivePeriod(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'tenants') {
      fetchTenancies();
    } else if (activeTab === 'bills') {
      if (isOwner) fetchBills();
    }
  }, [activeTab, propertyId, filterYear, filterStatus, isOwner]);

  useEffect(() => {
    fetchLatestPeriod();
    if (activeTab === 'overview') {
      if (isOwner) fetchBills();
    }
  }, [propertyId, activeTab, isOwner]);

  return {
    tenancies,
    billsData,
    isLoadingTenants,
    isLoadingBills,
    tenantCount,
    activePeriod,
    refetchTenancies: fetchTenancies,
    refetchBills: fetchBills,
    refetchLatestPeriod: fetchLatestPeriod,
  };
}
