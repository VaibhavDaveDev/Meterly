import { useState, useMemo } from 'react';
import type { Property } from '../types/db';
import { useToast } from './use-toast';
import { apiClient } from '../lib/api-client';
import { usePropertyData } from './use-property-data';

interface UsePropertyDetailsProps {
  property: Property;
  initialTenantCount: number;
  isOwner: boolean;
}

export function usePropertyDetails({ property, initialTenantCount, isOwner: _isOwner }: UsePropertyDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  
  // Invite state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSplit, setInviteSplit] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [isStartingPeriod, setIsStartingPeriod] = useState(false);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [periodMonth, setPeriodMonth] = useState('');

  // Local property state (for Settings tab updates)
  const [localProperty, setLocalProperty] = useState<Property>(property);

  // Filter state
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const {
    tenancies,
    billsData,
    isLoadingTenants,
    isLoadingBills,
    tenantCount,
    activePeriod,
    refetchTenancies,
    refetchLatestPeriod
  } = usePropertyData(property.id, activeTab, filterYear, filterStatus, initialTenantCount, _isOwner);

  // Fetch start values + rates for active period for overview if needed
  // Note: we might not need this on overview if reading is fully moved to separate page, 
  // but we keep it simple for now in case other components depend on startValues/currentRates on overview.

  const handleInvite = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsInviting(true);

    const payload: Record<string, unknown> = { email: inviteEmail };
    if (inviteSplit) {
      payload.splitPercentage = parseFloat(inviteSplit);
    }

    const { error } = await apiClient.post(`/properties/${property.id}/tenancies/invite`, payload);
    
    setIsInviting(false);

    if (error) {
      toast({ variant: "destructive", title: "Failed to invite tenant", description: error.message });
      return;
    }

    toast({ title: "Invitation Sent", description: `An email has been sent to ${inviteEmail}.` });
    setIsInviteOpen(false);
    setInviteEmail('');
    setInviteSplit('');
    
    if (activeTab === 'tenants') refetchTenancies();
  };

  const handleStartPeriod = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStartingPeriod(true);

    const { error } = await apiClient.post(`/properties/${property.id}/periods`, { periodMonth });

    setIsStartingPeriod(false);

    if (error) {
      toast({ variant: "destructive", title: "Error starting period", description: error.message });
      return;
    }

    toast({ title: "Billing Period Started", description: "You can now submit meter readings for this month." });
    setIsPeriodModalOpen(false);
    refetchLatestPeriod();
  };


  // Available years derived from bills (for filter dropdown)
  const availableYears = useMemo(() => {
    if (!billsData) return ['all'];
    const years = new Set(billsData.bills.map(p => new Date(p.periodMonth).getFullYear().toString()));
    return ['all', ...Array.from(years).sort((a, b) => Number(b) - Number(a))];
  }, [billsData]);

  // CSV download (we'll implement this properly in PropertyDetailsTabBills but keeping a placeholder here if needed)
  const downloadCsv = () => {
    // Note: since the filtering is server-side now, the component will handle it, or we export all filtered data.
    if (!billsData) return;
    const header = ['Period', 'Tenant', 'Consumption (Units)', 'Total Due (₹)', 'Status'];
    const rows: string[] = [];
    billsData.bills.forEach(p => {
      const monthLabel = new Date(p.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
      p.tenants.forEach(t => {
        rows.push([
          monthLabel,
          t.tenantName || 'Unknown',
          p.totalConsumption?.toFixed(2) || '0.00',
          t.totalDue?.toFixed(2),
          t.status
        ].join(','));
      });
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${property.name.replace(/\s+/g, '_')}_bills.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format data for the overview chart (last 12 months, grouped by month-year)
  const chartData = useMemo(() => {
    if (!billsData) return [];
    const modeChangeMonth = property.soloModeChangedAt
      ? new Date(property.soloModeChangedAt).toLocaleString('default', { month: 'short', year: '2-digit' })
      : null;

    return [...billsData.bills]
      .sort((a, b) => new Date(a.periodMonth).getTime() - new Date(b.periodMonth).getTime())
      .slice(-12)
      .map(p => {
        const label = new Date(p.periodMonth).toLocaleString('default', { month: 'short', year: '2-digit' });
        const totalDue = p.tenants.reduce((sum, t) => sum + t.totalDue, 0);
        return {
          name: label,
          total: totalDue,
          cost: totalDue,
          consumption: p.totalConsumption || 0,
          isModeChange: label === modeChangeMonth
        };
      });
  }, [billsData, property.soloModeChangedAt]);

  const modeChangeLabel = property.soloModeChangedAt
    ? new Date(property.soloModeChangedAt).toLocaleString('default', { month: 'short', year: '2-digit' })
    : null;

  return {
    activeTab,
    setActiveTab,
    isInviteOpen,
    setIsInviteOpen,
    inviteEmail,
    setInviteEmail,
    inviteSplit,
    setInviteSplit,
    isInviting,
    isStartingPeriod,
    isPeriodModalOpen,
    setIsPeriodModalOpen,
    periodMonth,
    setPeriodMonth,
    activePeriod,
    localProperty,
    setLocalProperty,
    tenancies,
    billsData,
    isLoadingTenants,
    isLoadingBills,
    tenantCount,
    filterYear,
    setFilterYear,
    filterStatus,
    setFilterStatus,
    availableYears,
    handleInvite,
    handleStartPeriod,
    downloadCsv,
    chartData,
    modeChangeLabel,
    property,
    isOwner: _isOwner,
  };
}
