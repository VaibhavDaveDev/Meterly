import { useState, useEffect } from 'react';
import { useToast } from './use-toast';
import { apiClient } from '../lib/api-client';
import type { Property } from '../types/db';

export function usePropertySettings(property: Property, onPropertyUpdate: (updated: Property) => void) {
  const { toast } = useToast();

  const [isSolarOpen, setIsSolarOpen] = useState(false);
  const [isSolarLoading, setIsSolarLoading] = useState(false);
  const [solarForm, setSolarForm] = useState({ solarGenInitial: 0, solarExportInitial: 0, importInitial: 0 });

  const [isSoloLoading, setIsSoloLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  const [localProperty, setLocalProperty] = useState<Property>(property);
  useEffect(() => {
    setLocalProperty(property);
  }, [property]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showSoloWarningModal, setShowSoloWarningModal] = useState(false);
  const [activeTenantsList, setActiveTenantsList] = useState<Array<{ id: string; inviteEmail: string | null; status: string; isOwnerTenancy: boolean; tenantName: string | null }>>([]);
  const [unpaidBillsCount, setUnpaidBillsCount] = useState<number>(0);

  useEffect(() => {
    // Fetch danger zone stats
    apiClient.get<{ active: Array<{ id: string; inviteEmail: string | null; status: string; isOwnerTenancy: boolean; tenantName: string | null }> }>(`/properties/${property.id}/tenancies`).then(({ data }) => {
      if (data && data.active) {
        setActiveTenantsList(data.active);
      }
    });

    interface TenantBillSummary {
      billId: string;
      tenantName: string;
      splitPercentage: number;
      totalDue: number;
      status: 'pending' | 'paid';
      markedPaidAt: string | null;
    }

    interface PeriodBillSummary {
      id: string;
      periodMonth: string;
      calculationMode: 'solar' | 'grid_only';
      periodStatus: 'draft' | 'pending_approval' | 'submitted' | 'confirmed';
      tenants: TenantBillSummary[];
      totalConsumption: number;
      exportRefund: number | null;
    }

    interface BillsResponse {
      bills: PeriodBillSummary[];
      summary: {
        totalBilled: number;
        totalCollected: number;
        totalOutstanding: number;
      };
    }

    apiClient.get<BillsResponse>(`/properties/${property.id}/bills?status=pending`).then(({ data }) => {
      if (data && data.bills) {
        const count = data.bills.reduce((acc: number, p: PeriodBillSummary) => acc + p.tenants.length, 0);
        setUnpaidBillsCount(count);
      }
    });
  }, [property.id]);

  const confirmArchiveProperty = async () => {
    setIsArchiving(true);
    const { error } = await apiClient.patch(`/properties/${property.id}/archive`, {});
    setIsArchiving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.location.href = '/dashboard';
  };

  const confirmDeleteProperty = async () => {
    setIsDeleting(true);
    const { error } = await apiClient.delete(`/properties/${property.id}`);
    setIsDeleting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.location.href = '/dashboard';
  };

  const handleSolarToggle = async (enable: boolean) => {
    if (enable) {
      setIsSolarOpen(true);
      return;
    }
    setIsSolarLoading(true);
    const { data, error } = await apiClient.patch<Property>(`/properties/${localProperty.id}/solar`, {
      hasSolar: false,
    });
    setIsSolarLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    if (data) {
      setLocalProperty(data);
      onPropertyUpdate(data);
    }
    toast({ title: 'Solar disabled', description: 'Future billing periods will use grid-only mode.' });
  };

  const handleEnableSolarSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSolarLoading(true);
    const { data, error } = await apiClient.patch<Property>(`/properties/${localProperty.id}/solar`, {
      hasSolar: true,
      solarGenInitial: solarForm.solarGenInitial,
      solarExportInitial: solarForm.solarExportInitial,
      importInitial: solarForm.importInitial,
    });
    setIsSolarLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    if (data) {
      setLocalProperty(data);
      onPropertyUpdate(data);
    }
    setIsSolarOpen(false);
    toast({ title: 'Solar enabled', description: 'Future billing periods will use solar calculation mode.' });
  };

  const fetchActiveTenantsAndShowModal = async () => {
    if (activeTenantsList.length > 0) {
      setShowSoloWarningModal(true);
    }
  };

  const handleSoloToggle = async (enable: boolean) => {
    setIsSoloLoading(true);
    const { data, error } = await apiClient.patch<Property>(`/properties/${localProperty.id}/mode`, {
      soloMode: enable,
    });
    setIsSoloLoading(false);
    if (error) {
      if ((error as { code?: string }).code === 'ACTIVE_TENANTS_EXIST' || error.message.includes('active tenants exist')) {
        fetchActiveTenantsAndShowModal();
        return;
      }
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    if (data) {
      setLocalProperty(data);
      onPropertyUpdate(data);
    }
    toast({
      title: enable ? 'Solo mode enabled' : 'Solo mode disabled',
      description: enable
        ? 'You are now tracking your own bills. No tenant required.'
        : 'Tenant mode enabled. You can invite tenants.',
    });
  };

  const updateSetting = async <K extends keyof Property>(key: K, val: Property[K], successMessage?: string) => {
    setIsSettingsLoading(true);
    const { data } = await apiClient.patch<Property>(`/properties/${localProperty.id}/settings`, { [key]: val });
    setIsSettingsLoading(false);
    if (data) {
      setLocalProperty(data);
      onPropertyUpdate(data);
      if (successMessage) toast({ title: successMessage });
    }
  };

  const updateSettings = async (updates: Partial<Property>, successMessage?: string) => {
    setIsSettingsLoading(true);
    const { data, error } = await apiClient.patch<Property>(`/properties/${localProperty.id}/settings`, updates);
    setIsSettingsLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    if (data) {
      setLocalProperty(data);
      onPropertyUpdate(data);
      if (successMessage) toast({ title: successMessage });
    }
  };

  return {
    localProperty,
    setLocalProperty,
    isSolarOpen,
    setIsSolarOpen,
    isSolarLoading,
    solarForm,
    setSolarForm,
    handleSolarToggle,
    handleEnableSolarSubmit,
    isSoloLoading,
    handleSoloToggle,
    showSoloWarningModal,
    setShowSoloWarningModal,
    activeTenantsList,
    isSettingsLoading,
    updateSetting,
    updateSettings,
    isDeleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    confirmDeleteProperty,
    isArchiving,
    showArchiveConfirm,
    setShowArchiveConfirm,
    confirmArchiveProperty,
    unpaidBillsCount,
  };
}
