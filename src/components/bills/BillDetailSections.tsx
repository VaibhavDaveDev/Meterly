import React, { useState, useId, useMemo } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Timeline } from "../ui/timeline";
import type {
  BillDetailData,
  CustomCharge,
  BillEditHistory,
} from "../../hooks/use-bill-detail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { formatCurrency } from "../../lib/format";

// --- Parameter Object Types (per AGENTS.md Parameter Object Pattern) ---

/** All state and handlers for the owner's meter-reading edit dialog. */
export type OwnerEditContext = {
  ownerEditValues: {
    importEnd: number;
    exportEnd: number;
    solarGenerationEnd: number;
  };
  setOwnerEditValues: React.Dispatch<
    React.SetStateAction<{
      importEnd: number;
      exportEnd: number;
      solarGenerationEnd: number;
    }>
  >;
  ownerEditReason: string;
  setOwnerEditReason: (val: string) => void;
  handleOwnerEdit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  isOwnerEditing: boolean;
  ownerEditCharges: CustomCharge[];
  setOwnerEditCharges: React.Dispatch<React.SetStateAction<CustomCharge[]>>;
  onDialogOpenChange?: (open: boolean) => void;
};

/** All state and handlers for the tenant's bill-edit request dialog. */
export type TenantEditContext = {
  isModalOpen: boolean;
  setIsModalOpen: (val: boolean) => void;
  editReason: string;
  setEditReason: (val: string) => void;
  handleRequestEdit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  isRequestingEdit: boolean;
};

function fmt(n: number | string | undefined | null, decimals = 2) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number | string | undefined | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return formatCurrency(n);
}

export function CalcStep({
  number,
  title,
  formula,
  result,
  unit = "units",
  description,
}: {
  number: number;
  title: string;
  formula: string;
  result: number | string | null;
  unit?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised/40 p-4 space-y-1">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
          {number}
        </span>
        <div className="flex-1 space-y-0.5">
          <p className="font-semibold text-sm m-0">{title}</p>
          <p className="text-xs text-muted-foreground font-mono m-0">
            {formula}
          </p>
          <p className="text-sm font-bold font-mono m-0">
            = {fmt(result)} {unit}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground italic mt-1 m-0">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function BillHeader({
  monthString,
  property,
  tenancy,
  currentStatus,
  totalDue,
}: {
  monthString: string;
  property: { id: string; name: string; address?: string | null };
  tenancy: { inviteEmail: string };
  currentStatus: string;
  totalDue: string | number;
}) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bill — {monthString}
        </h1>
        <p className="text-muted-foreground mt-1">
          {property.name}
          {property.address ? ` · ${property.address}` : ""}
        </p>
        <p className="text-muted-foreground text-sm">
          Tenant: {tenancy.inviteEmail}
        </p>
      </div>
      <div className="flex flex-col items-start md:items-end gap-3">
        <div className="text-left md:text-right flex flex-col items-start md:items-end">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold mb-1">
            Payment Status
          </span>
          <Badge
            variant={currentStatus === "paid" ? "paid" : "unpaid"}
            className="text-sm px-3 py-1"
          >
            {currentStatus === "paid" ? "✓ Paid" : "Unpaid"}
          </Badge>
        </div>
        <div className="text-left md:text-right">
          <span className="text-xs text-muted-foreground uppercase tracking-wide block">
            Total Due
          </span>
          <span className="text-4xl font-bold font-mono text-foreground">
            {fmtCurrency(totalDue)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BillActionBar({
  isOwner,
  isTenant,
  currentStatus,
  handleMarkPaid,
  isMarkingPaid,
  isSolar,
  ownerEdit,
  tenantEdit,
}: {
  isOwner: boolean;
  isTenant: boolean;
  currentStatus: string;
  handleMarkPaid: () => void;
  isMarkingPaid: boolean;
  isSolar: boolean;
  ownerEdit?: OwnerEditContext;
  tenantEdit?: TenantEditContext;
}) {
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState("");
  const [newChargeToTenant, setNewChargeToTenant] = useState(true);
  const editReasonId = useId();
  const chargeSwitchId = useId();
  const tenantReasonId = useId();
  const importEndId = useId();
  const solarGenEndId = useId();
  const exportEndId = useId();

  const handleAddCharge = () => {
    if (!newChargeName || !newChargeAmount) return;
    const amount = parseFloat(newChargeAmount);
    if (!Number.isFinite(amount)) return;
    ownerEdit?.setOwnerEditCharges((prev) => [
      ...prev,
      {
        name: newChargeName,
        amount,
        chargedToTenant: newChargeToTenant,
      },
    ]);
    setNewChargeName("");
    setNewChargeAmount("");
    setNewChargeToTenant(true);
  };

  const handleRemoveCharge = (index: number) => {
    ownerEdit?.setOwnerEditCharges((prev) =>
      prev.filter((_: CustomCharge, i: number) => i !== index)
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {isOwner && ownerEdit && (
        <Dialog onOpenChange={ownerEdit.onDialogOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline">Edit Readings</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Meter Readings</DialogTitle>
              <DialogDescription>
                Modify the readings for this bill. This will recalculate the
                bill and notify the tenant.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={ownerEdit.handleOwnerEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={importEndId}>Import End</Label>
                <Input
                  id={importEndId}
                  type="number"
                  step="0.01"
                  value={ownerEdit.ownerEditValues.importEnd}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    ownerEdit.setOwnerEditValues((p) => ({
                      ...p,
                      importEnd: parseFloat(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>
              {isSolar && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={solarGenEndId}>Solar Generation End</Label>
                    <Input
                      id={solarGenEndId}
                      type="number"
                      step="0.01"
                      value={ownerEdit.ownerEditValues.solarGenerationEnd}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        ownerEdit.setOwnerEditValues((p) => ({
                          ...p,
                          solarGenerationEnd: parseFloat(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={exportEndId}>Export End</Label>
                    <Input
                      id={exportEndId}
                      type="number"
                      step="0.01"
                      value={ownerEdit.ownerEditValues.exportEnd}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        ownerEdit.setOwnerEditValues((p) => ({
                          ...p,
                          exportEnd: parseFloat(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2 pt-2 border-t">
                <Label>One-off Custom Charges</Label>
                <div className="space-y-2">
                  {ownerEdit.ownerEditCharges.map(
                    (c: CustomCharge, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-muted/50 p-2 rounded-md border text-sm"
                      >
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.chargedToTenant
                              ? "Charged to Tenant"
                              : "Paid by Owner"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono">
                            {fmtCurrency(c.amount)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={() => handleRemoveCharge(i)}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        aria-label="Charge name"
                        placeholder="Charge name"
                        value={newChargeName}
                        onChange={(e) => setNewChargeName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <Input
                        aria-label="Charge amount"
                        type="number"
                        placeholder="Amt"
                        value={newChargeAmount}
                        onChange={(e) => setNewChargeAmount(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <Label
                      className="text-xs text-muted-foreground cursor-pointer"
                      htmlFor={chargeSwitchId}
                    >
                      Charge to Tenant
                    </Label>
                    <div className="flex items-center gap-3">
                      <Switch
                        id={chargeSwitchId}
                        checked={newChargeToTenant}
                        onCheckedChange={setNewChargeToTenant}
                        className="scale-75"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={handleAddCharge}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor={editReasonId}>Reason for Edit</Label>
                <textarea
                  id={editReasonId}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={ownerEdit.ownerEditReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    ownerEdit.setOwnerEditReason(e.target.value)
                  }
                  required
                  minLength={10}
                  placeholder="Provide a reason for the audit log..."
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={
                    ownerEdit.isOwnerEditing ||
                    ownerEdit.ownerEditReason.length < 10
                  }
                >
                  {ownerEdit.isOwnerEditing ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {currentStatus === "pending" && isOwner && (
        <Button onClick={() => handleMarkPaid()} disabled={isMarkingPaid}>
          {isMarkingPaid ? "Processing..." : "Mark as Paid"}
        </Button>
      )}
      {isTenant && currentStatus !== "paid" && tenantEdit && (
        <Dialog
          open={tenantEdit.isModalOpen}
          onOpenChange={tenantEdit.setIsModalOpen}
        >
          <DialogTrigger asChild>
            <Button variant="outline">Request Edit / Report Issue</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={tenantEdit.handleRequestEdit}>
              <DialogHeader>
                <DialogTitle>Request Bill Edit</DialogTitle>
                <DialogDescription>
                  If you believe the meter readings or calculations are
                  incorrect, explain the issue here. The property owner will be
                  notified.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor={tenantReasonId}>Reason for edit request</Label>
                <textarea
                  id={tenantReasonId}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-2"
                  required
                  minLength={10}
                  value={tenantEdit.editReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    tenantEdit.setEditReason(e.target.value)
                  }
                  placeholder="e.g., The end of month reading on my meter is 12450, not 12550."
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => tenantEdit.setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    tenantEdit.isRequestingEdit ||
                    tenantEdit.editReason.length < 10
                  }
                >
                  {tenantEdit.isRequestingEdit
                    ? "Sending..."
                    : "Submit Request"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <Button variant="secondary" onClick={() => window.print()}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect width="12" height="8" x="6" y="14"></rect>
        </svg>
        Print / Save PDF
      </Button>
    </div>
  );
}

export interface ReadingData {
  importStart: string | number;
  importEnd: string | number;
  solarGenerationStart?: string | number | null;
  solarGenerationEnd?: string | number | null;
  exportStart?: string | number | null;
  exportEnd?: string | number | null;
  submittedBy?: string | null;
  version?: number;
}

export function MeterReadingsTable({
  reading,
  isSolar,
  solarGenerated,
  gridExported,
  gridImported,
  submitterName,
  editHistory = [],
}: {
  reading: ReadingData;
  isSolar: boolean;
  solarGenerated: number;
  gridExported: number;
  gridImported: number;
  submitterName?: string | null;
  editHistory?: BillEditHistory[];
}) {
  const timelineItems = useMemo(() => {
    return editHistory.map((edit) => {
      let oldV: Record<string, string> = {};
      let newV: Record<string, string> = {};
      try {
        oldV =
          typeof edit.oldValues === "string"
            ? JSON.parse(edit.oldValues)
            : (edit.oldValues as Record<string, string>) || {};
      } catch {
        /* ignore */
      }
      try {
        newV =
          typeof edit.newValues === "string"
            ? JSON.parse(edit.newValues)
            : (edit.newValues as Record<string, string>) || {};
      } catch {
        /* ignore */
      }

      const diff = Object.keys(newV).map((k) => ({
        key: k,
        old: oldV[k] ?? "",
        new: newV[k],
      }));

      return {
        id: edit.id,
        timestamp: (() => {
          const d = new Date(edit.editedAt);
          return isNaN(d.getTime()) ? "Unknown Date" : d.toLocaleString();
        })(),
        title: `Edited by ${edit.editedByName}`,
        description: edit.reason ? `Reason: ${edit.reason}` : undefined,
        diff,
        variant: "info" as const,
      };
    });
  }, [editHistory]);

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">
        Meter Readings
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left py-2 font-medium">Meter</th>
              <th className="text-right py-2 font-medium">Start</th>
              <th className="text-center py-2 font-medium"></th>
              <th className="text-right py-2 font-medium">End</th>
              <th className="text-right py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isSolar && (
              <tr>
                <td className="py-3 font-medium text-foreground">
                  Solar Generation
                </td>
                <td className="py-3 text-right font-mono text-muted-foreground">
                  {fmt(reading.solarGenerationStart)}
                </td>
                <td className="py-3 text-center text-muted-foreground">→</td>
                <td className="py-3 text-right font-mono text-foreground">
                  {fmt(reading.solarGenerationEnd)}
                </td>
                <td className="py-3 text-right font-mono font-semibold text-amber-500">
                  +{fmt(solarGenerated)}
                </td>
              </tr>
            )}
            {isSolar && (
              <tr>
                <td className="py-3 font-medium text-foreground">
                  Export to Grid
                </td>
                <td className="py-3 text-right font-mono text-muted-foreground">
                  {fmt(reading.exportStart)}
                </td>
                <td className="py-3 text-center text-muted-foreground">→</td>
                <td className="py-3 text-right font-mono text-foreground">
                  {fmt(reading.exportEnd)}
                </td>
                <td className="py-3 text-right font-mono font-semibold text-blue-500">
                  +{fmt(gridExported)}
                </td>
              </tr>
            )}
            <tr>
              <td className="py-3 font-medium text-foreground">
                Import from Grid
              </td>
              <td className="py-3 text-right font-mono text-muted-foreground">
                {fmt(reading.importStart)}
              </td>
              <td className="py-3 text-center text-muted-foreground">→</td>
              <td className="py-3 text-right font-mono text-foreground">
                {fmt(reading.importEnd)}
              </td>
              <td className="py-3 text-right font-mono font-semibold text-emerald-500">
                +{fmt(gridImported)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Submission + Edit History */}
      <div className="pt-4 border-t border-border mt-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs text-muted-foreground">
            Submitted by{" "}
            <span className="font-medium text-foreground">
              {submitterName ?? "Unknown"}
            </span>
          </p>
          {(reading.version ?? 1) > 1 && (
            <Badge variant="warning">Version {reading.version}</Badge>
          )}
        </div>

        {editHistory.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Edit History
            </p>
            <Timeline items={timelineItems} />
          </div>
        )}
      </div>
    </section>
  );
}

export function SolarBreakdownSection({
  reading,
  solarGenerated,
  gridExported,
  solarSelfConsumed,
  gridImported,
}: {
  reading: ReadingData;
  solarGenerated: number;
  gridExported: number;
  solarSelfConsumed: number;
  gridImported: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">
        Solar Breakdown
      </h2>
      <div className="space-y-5">
        <CalcStep
          number={1}
          title="Solar Generated"
          formula={`Solar Meter End (${fmt(reading.solarGenerationEnd)}) − Solar Meter Start (${fmt(reading.solarGenerationStart)})`}
          result={solarGenerated}
          description="Your panels produced this much electricity this month."
        />
        <CalcStep
          number={2}
          title="Exported to Grid"
          formula={`Export Meter End (${fmt(reading.exportEnd)}) − Export Meter Start (${fmt(reading.exportStart)})`}
          result={gridExported}
          description="This much solar power went back to the electricity grid."
        />
        <CalcStep
          number={3}
          title="Solar Self-Consumed"
          formula={`Solar Generated (${fmt(solarGenerated)}) − Exported to Grid (${fmt(gridExported)})`}
          result={solarSelfConsumed}
          description="This is the solar power used at home before the rest was exported."
        />
        <CalcStep
          number={4}
          title="Imported from Grid"
          formula={`Import Meter End (${fmt(reading.importEnd)}) − Import Meter Start (${fmt(reading.importStart)})`}
          result={gridImported}
          description="When solar was not enough, this much was drawn from the grid."
        />
      </div>
    </section>
  );
}

export function TotalConsumptionSection({
  isSolar,
  reading,
  gridImported,
  solarSelfConsumed,
  totalConsumption,
  bill,
  tenantShare,
}: {
  isSolar: boolean;
  reading: ReadingData;
  gridImported: number;
  solarSelfConsumed: number;
  totalConsumption: number;
  bill: BillDetailData["bill"];
  tenantShare: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">
        Total Consumption
      </h2>
      <div className="space-y-5">
        {isSolar ? (
          <CalcStep
            number={5}
            title="Total Electricity Used This Month"
            formula={`Imported from Grid (${fmt(gridImported)}) + Solar Self-Consumed (${fmt(solarSelfConsumed)})`}
            result={totalConsumption}
            description="Every unit used this month, regardless of whether it came from solar or the grid."
          />
        ) : (
          <CalcStep
            number={1}
            title="Total Electricity Used This Month"
            formula={`Import Meter End (${fmt(reading.importEnd)}) − Import Meter Start (${fmt(reading.importStart)})`}
            result={totalConsumption}
            description="All electricity drawn from the grid this month."
          />
        )}

        <div className="rounded-lg bg-muted/30 p-4 space-y-2 border">
          <p className="text-sm font-medium">
            Your Share:{" "}
            <span className="font-mono">{fmt(bill.splitPercentage)}%</span> of
            the property
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Total Consumption ({fmt(totalConsumption)}) ×{" "}
            {fmt(bill.splitPercentage)}% = {fmt(tenantShare)} units your share
          </p>
        </div>
      </div>
    </section>
  );
}

export function FinalBillSection({
  bill,
  tenantShare,
  customCharges,
  isSolar,
}: {
  bill: BillDetailData["bill"];
  tenantShare: number;
  customCharges: CustomCharge[];
  isSolar: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">
        Your Bill
      </h2>

      <div className="space-y-2">
        <div className="flex justify-between items-center py-2">
          <div>
            <p className="font-medium">Consumption</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {fmt(tenantShare)} units × {fmtCurrency(bill.consumptionRate)}
              /unit
            </p>
          </div>
          <span className="font-mono font-semibold">
            {fmtCurrency(bill.consumptionCost)}
          </span>
        </div>

        {customCharges.some((c) => c.chargedToTenant) && (
          <>
            <div className="border-t pt-2 space-y-2">
              {customCharges
                .filter((charge: CustomCharge) => charge.chargedToTenant)
                .map((charge: CustomCharge, i: number) => (
                  <div
                    key={`${charge.name}-${i}`}
                    className="flex justify-between items-center py-1"
                  >
                    <span className="text-sm text-muted-foreground">
                      {charge.name}
                    </span>
                    <span className="font-mono text-sm">
                      {fmtCurrency(
                        (charge.amount * Number(bill.splitPercentage)) / 100
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}

        <div className="border-t pt-3 flex justify-between items-center font-bold text-lg">
          <span>Total Due</span>
          <span className="font-mono">{fmtCurrency(bill.totalDue)}</span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-4 space-y-1.5 border border-border mt-4">
        <p className="font-medium text-foreground mb-1.5 uppercase tracking-wide">
          Rates effective for this period
        </p>
        <p>
          Consumption rate:{" "}
          <span className="font-mono text-foreground">
            {fmtCurrency(bill.consumptionRate)}
          </span>
          /unit
        </p>
        {isSolar && (
          <>
            <p>
              Export rate:{" "}
              <span className="font-mono text-foreground">
                {fmtCurrency(bill.exportRate)}
              </span>
              /unit (owner earns this, not charged to you)
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function OwnerExportCreditSection({
  gridExported,
  bill,
}: {
  gridExported: number;
  bill: BillDetailData["bill"];
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-muted/10 p-6 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Owner&apos;s Export Credit — Not Charged To You
      </h2>
      <p className="text-xs text-muted-foreground font-mono">
        Exported to Grid ({fmt(gridExported)}) × {fmtCurrency(bill.exportRate)}
        /unit
      </p>
      <p className="text-xl font-bold font-mono text-emerald-600">
        = {fmtCurrency(bill.exportRefund)}
      </p>
      <p className="text-xs text-muted-foreground">
        Your landlord earns this amount from the electricity grid for exporting
        solar power. It is not subtracted from your bill.
      </p>
    </section>
  );
}
