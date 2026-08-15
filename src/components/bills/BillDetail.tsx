import React, { useMemo, useState, useEffect } from "react";
import { Button } from "../ui/button";
import { useToast } from "../../hooks/use-toast";
import { apiClient } from "../../lib/api-client";
import { ArrowLeft } from "lucide-react";

import type { BillDetailData, CustomCharge } from "../../hooks/use-bill-detail";

interface BillDetailProps {
  data: BillDetailData;
}

import {
  BillHeader,
  BillActionBar,
  MeterReadingsTable,
  SolarBreakdownSection,
  TotalConsumptionSection,
  FinalBillSection,
  OwnerExportCreditSection,
} from "./BillDetailSections";
import type { OwnerEditContext, TenantEditContext } from "./BillDetailSections";

// --- Main Component ---

export function BillDetail({ data }: BillDetailProps) {
  const {
    bill,
    period,
    property,
    reading,
    tenancy,
    isOwner,
    isTenant,
    submitterName,
  } = data;
  const { toast } = useToast();

  const isSolar = period.calculationMode === "solar";
  const solarGenerated = Number(
    bill.solarGenerated ??
      (reading.solarGenerationEnd ?? 0) - (reading.solarGenerationStart ?? 0)
  );
  const gridExported = Number(
    bill.gridExported ?? (reading.exportEnd ?? 0) - (reading.exportStart ?? 0)
  );
  const gridImported = Number(
    bill.gridImported ?? reading.importEnd - reading.importStart
  );
  const solarSelfConsumed = Number(
    bill.solarSelfConsumed ?? Math.max(0, solarGenerated - gridExported)
  );
  const totalConsumption = Number(
    bill.totalConsumption ?? gridImported + solarSelfConsumed
  );
  const tenantShare = Number(
    bill.tenantConsumption ?? (totalConsumption * bill.splitPercentage) / 100
  );
  const periodDate = new Date(period.periodMonth);
  const monthString = isNaN(periodDate.getTime())
    ? "Unknown Period"
    : periodDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isRequestingEdit, setIsRequestingEdit] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(bill.status);

  const [isOwnerEditing, setIsOwnerEditing] = useState(false);
  const [ownerEditReason, setOwnerEditReason] = useState("");
  const [ownerEditValues, setOwnerEditValues] = useState({
    importEnd: reading.importEnd,
    exportEnd: reading.exportEnd ?? 0,
    solarGenerationEnd: reading.solarGenerationEnd ?? 0,
  });

  const customCharges = useMemo<CustomCharge[]>(() => {
    try {
      return JSON.parse(bill.customChargesJson || "[]") as CustomCharge[];
    } catch {
      return [];
    }
  }, [bill.customChargesJson]);

  const [ownerEditCharges, setOwnerEditCharges] =
    useState<CustomCharge[]>(customCharges);

  // Tracks whether the owner edit dialog is actively open.
  // Prevents syncing customCharges into ownerEditCharges while the owner is editing.
  const [isOwnerEditDialogOpen, setIsOwnerEditDialogOpen] = useState(false);

  // Sync ownerEditCharges with customCharges when bill data changes,
  // but only when the edit dialog is not open (so we don't wipe in-progress edits).
  useEffect(() => {
    if (!isOwnerEditDialogOpen) {
      setOwnerEditCharges(customCharges);
    }
  }, [customCharges, isOwnerEditDialogOpen]);

  const handleMarkPaid = async () => {
    setIsMarkingPaid(true);
    const { error } = await apiClient.patch(`/bills/${bill.id}/mark-paid`, {});
    setIsMarkingPaid(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return;
    }
    setCurrentStatus("paid");
    toast({ title: "Success", description: "Bill marked as paid." });
  };

  const handleRequestEdit = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setIsRequestingEdit(true);
    const { error } = await apiClient.post(`/edit-requests`, {
      billingPeriodId: period.id,
      reason: editReason,
      proposedValues: {},
    });
    setIsRequestingEdit(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return;
    }
    toast({
      title: "Request Sent",
      description: "The property owner has been notified.",
    });
    setIsModalOpen(false);
    setEditReason("");
  };

  const handleOwnerEdit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsOwnerEditing(true);
    const { error } = await apiClient.patch(
      `/properties/${property.id}/periods/${period.id}/readings`,
      {
        importEnd: ownerEditValues.importEnd,
        exportEnd: ownerEditValues.exportEnd,
        solarGenerationEnd: ownerEditValues.solarGenerationEnd,
        reason: ownerEditReason,
        oneOffCharges: ownerEditCharges,
      }
    );
    setIsOwnerEditing(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return;
    }
    toast({ title: "Success", description: "Readings updated successfully." });
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() =>
          window.history.length > 1
            ? window.history.back()
            : (window.location.href = "/dashboard")
        }
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <BillHeader
        monthString={monthString}
        property={property}
        tenancy={tenancy}
        currentStatus={currentStatus}
        totalDue={bill.totalDue}
      />

      <BillActionBar
        isOwner={isOwner}
        isTenant={isTenant}
        currentStatus={currentStatus}
        handleMarkPaid={handleMarkPaid}
        isMarkingPaid={isMarkingPaid}
        isSolar={isSolar}
        ownerEdit={
          isOwner
            ? ({
                ownerEditValues,
                setOwnerEditValues,
                ownerEditReason,
                setOwnerEditReason,
                handleOwnerEdit,
                isOwnerEditing,
                ownerEditCharges,
                setOwnerEditCharges,
                onDialogOpenChange: setIsOwnerEditDialogOpen,
              } satisfies OwnerEditContext)
            : undefined
        }
        tenantEdit={
          isTenant
            ? ({
                isModalOpen,
                setIsModalOpen,
                editReason,
                setEditReason,
                handleRequestEdit,
                isRequestingEdit,
              } satisfies TenantEditContext)
            : undefined
        }
      />

      <MeterReadingsTable
        reading={reading}
        isSolar={isSolar}
        solarGenerated={solarGenerated}
        gridExported={gridExported}
        gridImported={gridImported}
        submitterName={submitterName}
        editHistory={data.editHistory}
      />

      {isSolar && (
        <SolarBreakdownSection
          reading={reading}
          solarGenerated={solarGenerated}
          gridExported={gridExported}
          solarSelfConsumed={solarSelfConsumed}
          gridImported={gridImported}
        />
      )}

      <TotalConsumptionSection
        isSolar={isSolar}
        reading={reading}
        gridImported={gridImported}
        solarSelfConsumed={solarSelfConsumed}
        totalConsumption={totalConsumption}
        bill={bill}
        tenantShare={tenantShare}
      />

      <FinalBillSection
        bill={bill}
        tenantShare={tenantShare}
        customCharges={customCharges}
        isSolar={isSolar}
      />

      {isSolar && (
        <OwnerExportCreditSection gridExported={gridExported} bill={bill} />
      )}
    </div>
  );
}
