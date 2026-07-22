/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Timeline } from '../ui/timeline';
import type { TimelineItem } from '../ui/timeline';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../lib/api-client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { ArrowLeft } from 'lucide-react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

interface BillDetailProps {
  data: {
    bill: Record<string, unknown> & {
      id: string;
      totalDue: number;
      status: string;
      splitPercentage: number;
      consumptionRate: number;
      exportRate: number;
      tenantConsumption: number;
      totalConsumption: number;
      gridExported: number;
      gridImported: number;
      solarSelfConsumed: number;
      solarGenerated: number;
      exportRefund: number;
      consumptionCost: number;
      customChargesJson: string;
      customChargesTotal: number;
    };
    period: Record<string, unknown> & { id: string; periodMonth: string; calculationMode: string; oneOffCharges?: string | null };
    property: Record<string, unknown> & { id: string; name: string; address?: string };
    reading: Record<string, unknown> & {
      importStart: number;
      importEnd: number;
      solarGenerationStart: number;
      solarGenerationEnd: number;
      exportStart: number;
      exportEnd: number;
      submittedBy: string;
      createdAt: string;
      version: number;
      history?: unknown;
    };
    tenancy: Record<string, unknown> & { inviteEmail: string };
    isOwner: boolean;
    isTenant: boolean;
    submitterName?: string | null;
  };
}

function fmt(n: number | undefined | null, decimals = 2) {
  return (n ?? 0).toFixed(decimals);
}

function fmtCurrency(n: number | undefined | null) {
  return `₹${fmt(n, 2)}`;
}

function CalcStep({
  number,
  title,
  formula,
  result,
  unit = 'units',
  description,
}: {
  number: number;
  title: string;
  formula: string;
  result: number;
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
          <p className="text-xs text-muted-foreground font-mono m-0">{formula}</p>
          <p className="text-sm font-bold font-mono m-0">
            = {fmt(result)} {unit}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground italic mt-1 m-0">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Section Components ---

function BillHeader({ monthString, property, tenancy, currentStatus, totalDue }: any) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bill — {monthString}</h1>
        <p className="text-muted-foreground mt-1">{property.name}{property.address ? ` · ${property.address}` : ''}</p>
        <p className="text-muted-foreground text-sm">Tenant: {tenancy.inviteEmail}</p>
      </div>
      <div className="flex flex-col items-start md:items-end gap-3">
        <div className="text-left md:text-right flex flex-col items-start md:items-end">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold mb-1">Payment Status</span>
          <Badge variant={currentStatus === 'paid' ? 'paid' : 'unpaid'} className="text-sm px-3 py-1">
            {currentStatus === 'paid' ? '✓ Paid' : 'Unpaid'}
          </Badge>
        </div>
        <div className="text-left md:text-right">
          <span className="text-xs text-muted-foreground uppercase tracking-wide block">Total Due</span>
          <span className="text-4xl font-bold font-mono text-foreground">{fmtCurrency(totalDue)}</span>
        </div>
      </div>
    </div>
  );
}

function BillActionBar({
  isOwner, isTenant, billStatus, currentStatus, handleMarkPaid, isMarkingPaid,
  isModalOpen, setIsModalOpen, editReason, setEditReason, handleRequestEdit, isRequestingEdit,
  ownerEditValues, setOwnerEditValues, ownerEditReason, setOwnerEditReason, handleOwnerEdit, isOwnerEditing, isSolar,
  ownerEditCharges, setOwnerEditCharges
}: any) {
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [newChargeToTenant, setNewChargeToTenant] = useState(true);

  const handleAddCharge = () => {
    if (!newChargeName || !newChargeAmount) return;
    setOwnerEditCharges([...ownerEditCharges, { name: newChargeName, amount: parseFloat(newChargeAmount), chargedToTenant: newChargeToTenant }]);
    setNewChargeName('');
    setNewChargeAmount('');
    setNewChargeToTenant(true);
  };

  const handleRemoveCharge = (index: number) => {
    setOwnerEditCharges(ownerEditCharges.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {isOwner && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Edit Readings</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Meter Readings</DialogTitle>
              <DialogDescription>
                Modify the readings for this bill. This will recalculate the bill and notify the tenant.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleOwnerEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Import End</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={ownerEditValues.importEnd} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOwnerEditValues((p: Record<string, number>) => ({ ...p, importEnd: parseFloat(e.target.value) || 0 }))} 
                  required 
                />
              </div>
              {isSolar && (
                <>
                  <div className="space-y-2">
                    <Label>Solar Generation End</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={ownerEditValues.solarGenerationEnd} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOwnerEditValues((p: Record<string, number>) => ({ ...p, solarGenerationEnd: parseFloat(e.target.value) || 0 }))} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Export End</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={ownerEditValues.exportEnd} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOwnerEditValues((p: Record<string, number>) => ({ ...p, exportEnd: parseFloat(e.target.value) || 0 }))} 
                      required 
                    />
                  </div>
                </>
              )}
              <div className="space-y-2 pt-2 border-t">
                <Label>One-off Custom Charges</Label>
                <div className="space-y-2">
                  {ownerEditCharges.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-md border text-sm">
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.chargedToTenant ? 'Charged to Tenant' : 'Paid by Owner'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">₹{c.amount}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleRemoveCharge(i)}>×</Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1 space-y-1">
                      <Input placeholder="Charge name" value={newChargeName} onChange={e => setNewChargeName(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="w-24 space-y-1">
                      <Input type="number" placeholder="Amt" value={newChargeAmount} onChange={e => setNewChargeAmount(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="charge-tenant-switch">
                      Charge to Tenant
                    </Label>
                    <div className="flex items-center gap-3">
                      <Switch 
                        id="charge-tenant-switch"
                        checked={newChargeToTenant} 
                        onCheckedChange={setNewChargeToTenant} 
                        className="scale-75"
                      />
                      <Button type="button" variant="secondary" size="sm" className="h-7 text-xs px-2" onClick={handleAddCharge}>Add</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Reason for Edit</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={ownerEditReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOwnerEditReason(e.target.value)}
                  required
                  minLength={10}
                  placeholder="Provide a reason for the audit log..."
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isOwnerEditing || ownerEditReason.length < 10}>
                  {isOwnerEditing ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {billStatus === 'pending' && isOwner && (
        <Button
          onClick={() => handleMarkPaid()}
          disabled={isMarkingPaid}
        >
          {isMarkingPaid ? 'Processing...' : 'Mark as Paid'}
        </Button>
      )}
      {isTenant && currentStatus !== 'paid' && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Request Edit / Report Issue</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleRequestEdit}>
              <DialogHeader>
                <DialogTitle>Request Bill Edit</DialogTitle>
                <DialogDescription>
                  If you believe the meter readings or calculations are incorrect, explain the issue here. The property owner will be notified.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="reason">Reason for edit request</Label>
                <textarea
                  id="reason"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-2"
                  required
                  minLength={10}
                  value={editReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditReason(e.target.value)}
                  placeholder="e.g., The end of month reading on my meter is 12450, not 12550."
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isRequestingEdit || editReason.length < 10}>
                  {isRequestingEdit ? 'Sending...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <Button variant="secondary" onClick={() => window.print()}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect width="12" height="8" x="6" y="14"></rect>
        </svg>
        Print / Save PDF
      </Button>
    </div>
  );
}

function MeterReadingsTable({ reading, isSolar, solarGenerated, gridExported, gridImported, submitterName }: any) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">Meter Readings</h2>
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
                <td className="py-3 font-medium text-foreground">Solar Generation</td>
                <td className="py-3 text-right font-mono text-muted-foreground">{fmt(reading.solarGenerationStart)}</td>
                <td className="py-3 text-center text-muted-foreground">→</td>
                <td className="py-3 text-right font-mono text-foreground">{fmt(reading.solarGenerationEnd)}</td>
                <td className="py-3 text-right font-mono font-semibold text-amber-500">+{fmt(solarGenerated)}</td>
              </tr>
            )}
            {isSolar && (
              <tr>
                <td className="py-3 font-medium text-foreground">Export to Grid</td>
                <td className="py-3 text-right font-mono text-muted-foreground">{fmt(reading.exportStart)}</td>
                <td className="py-3 text-center text-muted-foreground">→</td>
                <td className="py-3 text-right font-mono text-foreground">{fmt(reading.exportEnd)}</td>
                <td className="py-3 text-right font-mono font-semibold text-blue-500">+{fmt(gridExported)}</td>
              </tr>
            )}
            <tr>
              <td className="py-3 font-medium text-foreground">Import from Grid</td>
              <td className="py-3 text-right font-mono text-muted-foreground">{fmt(reading.importStart)}</td>
              <td className="py-3 text-center text-muted-foreground">→</td>
              <td className="py-3 text-right font-mono text-foreground">{fmt(reading.importEnd)}</td>
              <td className="py-3 text-right font-mono font-semibold text-emerald-500">+{fmt(gridImported)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Submission + Edit History */}
      <div className="pt-4 border-t border-border mt-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs text-muted-foreground">
            Submitted by <span className="font-medium text-foreground">{submitterName ?? reading.submittedBy}</span>
          </p>
          {reading.version > 1 && (
            <Badge variant="warning">Version {reading.version}</Badge>
          )}
        </div>

        {Array.isArray(reading.history) && (reading.history as unknown[]).length > 0 && (() => {
          const timelineItems: TimelineItem[] = (reading.history as Array<any>).map((edit: any) => {
            let oldV: Record<string, string> = {};
            let newV: Record<string, string> = {};
            try { oldV = JSON.parse(edit.oldValues || '{}'); } catch { /* ignore */ }
            try { newV = JSON.parse(edit.newValues || '{}'); } catch { /* ignore */ }

            const diff = Object.keys(newV).map(k => ({
              key: k,
              old: oldV[k] ?? '',
              new: newV[k],
            }));

            return {
              id: edit.id,
              timestamp: new Date(edit.editedAt).toLocaleString(),
              title: `Edited by ${edit.editorName}`,
              description: edit.reason ? `Reason: ${edit.reason}` : undefined,
              diff,
              variant: 'info' as const,
            };
          });

          return (
            <div className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Edit History</p>
              <Timeline items={timelineItems} />
            </div>
          );
        })()}
      </div>
    </section>
  );
}

function SolarBreakdownSection({ reading, solarGenerated, gridExported, solarSelfConsumed, gridImported }: any) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">Solar Breakdown</h2>
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

function TotalConsumptionSection({ isSolar, reading, gridImported, solarSelfConsumed, totalConsumption, bill, tenantShare }: any) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">Total Consumption</h2>
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
          <p className="text-sm font-medium">Your Share: <span className="font-mono">{fmt(bill.splitPercentage)}%</span> of the property</p>
          <p className="text-xs text-muted-foreground font-mono">
            Total Consumption ({fmt(totalConsumption)}) × {fmt(bill.splitPercentage)}% = {fmt(tenantShare)} units your share
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalBillSection({ bill, tenantShare, customCharges, isSolar }: any) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4 hover:border-accent/40 transition-colors">
      <h2 className="text-lg font-semibold border-b border-border pb-2">Your Bill</h2>

      <div className="space-y-2">
        <div className="flex justify-between items-center py-2">
          <div>
            <p className="font-medium">Consumption</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {fmt(tenantShare)} units × {fmtCurrency(bill.consumptionRate)}/unit
            </p>
          </div>
          <span className="font-mono font-semibold">{fmtCurrency(bill.consumptionCost)}</span>
        </div>

        {customCharges.length > 0 && (
          <>
            <div className="border-t pt-2 space-y-2">
              {customCharges.map((charge: any, i: number) => (
                <div key={`${charge.name}-${i}`} className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">{charge.name}</span>
                  <span className="font-mono text-sm">{fmtCurrency(charge.amount)}</span>
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
        <p className="font-medium text-foreground mb-1.5 uppercase tracking-wide">Rates effective for this period</p>
        <p>Consumption rate: <span className="font-mono text-foreground">{fmtCurrency(bill.consumptionRate)}</span>/unit</p>
        {isSolar && (
          <>
            <p>Export rate: <span className="font-mono text-foreground">{fmtCurrency(bill.exportRate)}</span>/unit (owner earns this, not charged to you)</p>
          </>
        )}
      </div>
    </section>
  );
}

function OwnerExportCreditSection({ gridExported, bill }: any) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-muted/10 p-6 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Owner&apos;s Export Credit — Not Charged To You
      </h2>
      <p className="text-xs text-muted-foreground font-mono">
        Exported to Grid ({fmt(gridExported)}) × {fmtCurrency(bill.exportRate)}/unit
      </p>
      <p className="text-xl font-bold font-mono text-emerald-600">
        = {fmtCurrency(bill.exportRefund)}
      </p>
      <p className="text-xs text-muted-foreground">
        Your landlord earns this amount from the electricity grid for exporting solar power. It is not subtracted from your bill.
      </p>
    </section>
  );
}

// --- Main Component ---

export function BillDetail({ data }: BillDetailProps) {
  const { bill, period, property, reading, tenancy, isOwner, isTenant, submitterName } = data;
  const { toast } = useToast();

  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isRequestingEdit, setIsRequestingEdit] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(bill.status);

  const [isOwnerEditing, setIsOwnerEditing] = useState(false);
  const [ownerEditReason, setOwnerEditReason] = useState('');
  const [ownerEditValues, setOwnerEditValues] = useState({
    importEnd: reading.importEnd,
    exportEnd: reading.exportEnd,
    solarGenerationEnd: reading.solarGenerationEnd,
  });

  const existingOneOffCharges = (() => {
    try {
      return JSON.parse(period.oneOffCharges || '[]');
    } catch {
      return [];
    }
  })();
  const [ownerEditCharges, setOwnerEditCharges] = useState(existingOneOffCharges);

  const customCharges = JSON.parse(bill.customChargesJson || '[]') as Array<{ id: string; name: string; amount: number }>;
  const monthString = new Date(period.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
  const isSolar = period.calculationMode === 'solar';

  // Derived values for step formulas
  const solarGenerated = reading.solarGenerationEnd - reading.solarGenerationStart;
  const gridExported = reading.exportEnd - reading.exportStart;
  const gridImported = reading.importEnd - reading.importStart;
  const solarSelfConsumed = Math.max(0, solarGenerated - gridExported);
  const totalConsumption = gridImported + solarSelfConsumed;
  const tenantShare = totalConsumption * (bill.splitPercentage / 100);

  const handleMarkPaid = async () => {
    setIsMarkingPaid(true);
    const { error } = await apiClient.patch(`/bills/${bill.id}/mark-paid`, {});
    setIsMarkingPaid(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setCurrentStatus('paid');
    toast({ title: 'Success', description: 'Bill marked as paid.' });
  };

  const handleRequestEdit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsRequestingEdit(true);
    const { error } = await apiClient.post(`/edit-requests`, {
      billingPeriodId: period.id,
      reason: editReason,
      proposedValues: {},
    });
    setIsRequestingEdit(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Request Sent', description: 'The property owner has been notified.' });
    setIsModalOpen(false);
    setEditReason('');
  };

  const handleOwnerEdit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsOwnerEditing(true);
    const { error } = await apiClient.patch(`/properties/${property.id}/periods/${period.id}/readings`, {
      importEnd: ownerEditValues.importEnd,
      exportEnd: ownerEditValues.exportEnd,
      solarGenerationEnd: ownerEditValues.solarGenerationEnd,
      reason: ownerEditReason,
      oneOffCharges: ownerEditCharges,
    });
    setIsOwnerEditing(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Success', description: 'Readings updated successfully.' });
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Button 
        variant="ghost" 
        className="w-fit"
        onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/dashboard'}
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
        isOwner={isOwner} isTenant={isTenant} billStatus={bill.status} currentStatus={currentStatus} 
        handleMarkPaid={handleMarkPaid} isMarkingPaid={isMarkingPaid}
        isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
        editReason={editReason} setEditReason={setEditReason}
        handleRequestEdit={handleRequestEdit} isRequestingEdit={isRequestingEdit}
        ownerEditValues={ownerEditValues} setOwnerEditValues={setOwnerEditValues}
        ownerEditReason={ownerEditReason} setOwnerEditReason={setOwnerEditReason}
        handleOwnerEdit={handleOwnerEdit} isOwnerEditing={isOwnerEditing}
        isSolar={isSolar}
        ownerEditCharges={ownerEditCharges} setOwnerEditCharges={setOwnerEditCharges}
      />

      <MeterReadingsTable 
        reading={reading} isSolar={isSolar} 
        solarGenerated={solarGenerated} gridExported={gridExported} 
        gridImported={gridImported} submitterName={submitterName} 
      />

      {isSolar && (
        <SolarBreakdownSection 
          reading={reading} solarGenerated={solarGenerated} 
          gridExported={gridExported} solarSelfConsumed={solarSelfConsumed} 
          gridImported={gridImported} 
        />
      )}

      <TotalConsumptionSection 
        isSolar={isSolar} reading={reading} gridImported={gridImported} 
        solarSelfConsumed={solarSelfConsumed} totalConsumption={totalConsumption} 
        bill={bill} tenantShare={tenantShare} 
      />

      <FinalBillSection 
        bill={bill} tenantShare={tenantShare} customCharges={customCharges} isSolar={isSolar} 
      />

      {isSolar && (
        <OwnerExportCreditSection gridExported={gridExported} bill={bill} />
      )}
    </div>
  );
}
