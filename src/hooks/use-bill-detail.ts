import { useState, useEffect } from 'react';

export interface CustomCharge {
  name: string;
  amount: number;
  chargedToTenant: boolean;
}

export interface BillEditHistory {
  id: string;
  editedByName: string;
  versionBefore: number;
  versionAfter: number;
  reason: string;
  editedAt: string;
  newValues: Record<string, string | number | boolean | null>;
  oldValues: Record<string, string | number | boolean | null> | null;
}

export interface BillDetailData {
  bill: {
    id: string;
    totalDue: string | number;
    status: 'pending' | 'paid';
    recalculationCount: number;
    customChargesJson: string | null;
    splitPercentage: number;
    totalConsumption: string | number;
    tenantConsumption: string | number;
    orderIndex?: number | null;
    consumptionRate: string | number;
    consumptionCost: string | number;
    exportRate: string | number;
    exportRefund: string | number | null;
    gridExported: string | number;
    solarSelfConsumed: string | number;
    customChargesTotal: string | number;
    recalculationOf: string | null;
    billingPeriodId: string;
    tenancyId: string;
    markedPaidAt: string | Date | null;
    markedPaidBy: string | null;
    recalculatedAt?: string | Date | null;
    solarGenerated?: string | number;
    gridImported?: string | number;
  };
  period: {
    id: string;
    periodMonth: string;
    calculationMode: 'standard' | 'solar';
    status: 'draft' | 'confirmed';
  };
  property: {
    id: string;
    name: string;
  };
  reading: {
    id: string;
    importStart: number;
    importEnd: number;
    exportStart: number | null;
    exportEnd: number | null;
    solarGenerationStart: number | null;
    solarGenerationEnd: number | null;
    submittedAt: string | Date;
  };
  submitterName?: string;
  editHistory: BillEditHistory[];
  isOwner: boolean;
  isTenant: boolean;
  canRequestEdit: boolean;
  pendingEditRequestCount: number;
  pendingEditRequest: {
    id: string;
    reason: string;
    proposedValues: ProposedValues;
    createdAt: string;
  } | null;
}

export interface ProposedValues {
  importStart?: number;
  importEnd?: number;
  exportStart?: number | null;
  exportEnd?: number | null;
  solarGenerationStart?: number | null;
  solarGenerationEnd?: number | null;
}

export function useBillDetail(billId: string, tenancyId: string) {
  const [data, setData] = useState<BillDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [proposedValues, setProposedValues] = useState<ProposedValues>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillDetails();
  }, [billId]);

  const fetchBillDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bills/${billId}`);
      const json = await res.json() as { data: BillDetailData, error?: { message: string } };
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch bill details');
      }
      setData(json.data);
      
      if (json.data.reading) {
        setProposedValues({
          importStart: json.data.reading.importStart,
          importEnd: json.data.reading.importEnd,
          exportStart: json.data.reading.exportStart,
          exportEnd: json.data.reading.exportEnd,
          solarGenerationStart: json.data.reading.solarGenerationStart,
          solarGenerationEnd: json.data.reading.solarGenerationEnd,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    try {
      const res = await fetch(`/api/bills/${billId}/mark-paid`, { method: 'PATCH' });
      if (res.ok) fetchBillDetails();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelEditRequest = async (requestId: string) => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      // ponytail: direct fetch call to cancel edit requests
      const res = await fetch(`/api/edit-requests/${requestId}/cancel`, {
        method: 'PATCH',
      });
      const json = await res.json() as { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message || 'Failed to cancel request');
      await fetchBillDetails();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCancelError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubmitEditRequest = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editReason.trim()) {
      setEditError('Please provide a reason for this edit.');
      return;
    }
    
    if (!data?.period.id) return;
    
    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      // ponytail: fix POST route to /api/edit-requests instead of /api/periods/...
      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriodId: data.period.id,
          reason: editReason,
          proposedValues,
          tenancyId
        })
      });
      const json = await res.json() as { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message || 'Failed to submit request');
      
      setEditSuccess(true);
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(false);
        setEditReason('');
        fetchBillDetails();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditError(message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return {
    data,
    loading,
    error,
    isEditModalOpen,
    setIsEditModalOpen,
    editReason,
    setEditReason,
    proposedValues,
    setProposedValues,
    isSubmittingEdit,
    editSuccess,
    editError,
    isCancelling,
    cancelError,
    handleCancelEditRequest,
    handleMarkPaid,
    handleSubmitEditRequest
  };
}
