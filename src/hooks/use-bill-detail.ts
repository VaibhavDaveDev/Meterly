import React, { useState, useEffect } from "react";

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
    status: "pending" | "paid";
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
    calculationMode: "standard" | "solar" | "grid_only";
    status: "draft" | "confirmed" | "pending_approval" | "submitted";
  };
  property: {
    id: string;
    name: string;
    address?: string | null;
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
    createdAt?: string | Date;
    version?: number;
    submittedBy?: string;
  };
  tenancy: {
    inviteEmail: string;
  };
  submitterName?: string | null;
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

import { useAsyncResource } from "./use-async-resource";
import { apiClient } from "../lib/api-client";

export function useBillDetail(billId: string, tenancyId: string) {
  const {
    data,
    loading,
    error,
    refetch: fetchBillDetails,
  } = useAsyncResource<BillDetailData>(`/bills/${billId}`);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [proposedValues, setProposedValues] = useState<ProposedValues>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isEditModalOpen && data?.reading) {
      setProposedValues({
        importStart: data.reading.importStart,
        importEnd: data.reading.importEnd,
        exportStart: data.reading.exportStart,
        exportEnd: data.reading.exportEnd,
        solarGenerationStart: data.reading.solarGenerationStart,
        solarGenerationEnd: data.reading.solarGenerationEnd,
      });
    }
  }, [isEditModalOpen, data?.reading]);

  const handleMarkPaid = async () => {
    try {
      const { error } = await apiClient.patch(`/bills/${billId}/mark-paid`, {});
      if (!error) fetchBillDetails();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelEditRequest = async (requestId: string) => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const { error } = await apiClient.patch(
        `/edit-requests/${requestId}/cancel`,
        {}
      );
      if (error) throw new Error(error.message || "Failed to cancel request");
      await fetchBillDetails();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCancelError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubmitEditRequest = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!editReason.trim()) {
      setEditError("Please provide a reason for this edit.");
      return;
    }

    if (!data?.period.id) return;

    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      const { error } = await apiClient.post("/edit-requests", {
        billingPeriodId: data.period.id,
        reason: editReason,
        proposedValues,
        tenancyId,
      });
      if (error) throw new Error(error.message || "Failed to submit request");

      setEditSuccess(true);
      successTimerRef.current = setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(false);
        setEditReason("");
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
    handleSubmitEditRequest,
  };
}
