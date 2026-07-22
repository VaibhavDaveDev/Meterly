import { useState, useEffect } from 'react';
import type { Tenancy } from '../../types/db';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DataTable } from '../ui/data-table';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../hooks/use-toast';
import { EmptyState } from '../common/LoadingStates';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface PropertyDetailsTabTenantsProps {
  propertyId: string;
  isLoadingTenants: boolean;
  tenancies: Tenancy[];
  isOwner: boolean;
  onInviteClick: () => void;
}

// ── Avatar circle from first letter of name or email ──────────────────────────────────
function Avatar({ text }: { text: string | null }) {
  return (
    <span className="avatar-circle" aria-hidden="true">
      {(text || '?').charAt(0).toUpperCase()}
    </span>
  );
}

type TenancyRow = Tenancy & Record<string, unknown>;

export function PropertyDetailsTabTenants({
  propertyId,
  isLoadingTenants,
  tenancies,
  isOwner,
  onInviteClick,
}: PropertyDetailsTabTenantsProps) {
  const { toast } = useToast();
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [tenantToRemove, setTenantToRemove] = useState<TenancyRow | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  const activeTenancies = tenancies.filter(t => t.status === 'active' || t.status === 'invited');

  const handleRemoveTenant = (tenancy: TenancyRow) => {
    setTenantToRemove(tenancy);
    setRemovalReason('');
    setShowRemoveDialog(true);
  };

  const confirmRemoveTenant = async () => {
    if (!tenantToRemove) return;
    setIsRemoving(true);
    
    const { error } = await apiClient.patch(`/tenancies/${tenantToRemove.id}/remove`, {
      removalReason: removalReason || undefined
    });
    
    setIsRemoving(false);
    setShowRemoveDialog(false);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    
    toast({ title: 'Success', description: 'Tenant removed successfully.' });
    window.location.reload();
  };

  useEffect(() => {
    if (!isEditing) {
      const initialSplits: Record<string, number> = {};
      const equalShare = activeTenancies.length > 0 ? 100 / activeTenancies.length : 0;
      activeTenancies.forEach(t => {
        initialSplits[t.id] = t.splitPercentage ?? Number(equalShare.toFixed(2));
      });
      setSplits(initialSplits);
    }
  }, [tenancies, isEditing]);

  const handleSplitChange = (id: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) setSplits(prev => ({ ...prev, [id]: num }));
  };

  const totalSplit = Object.values(splits).reduce((sum, val) => sum + val, 0);
  const isValidSplit = Math.abs(totalSplit - 100) < 0.01;

  const handleSaveSplits = async () => {
    if (!isValidSplit) return;
    setIsSaving(true);
    const { error } = await apiClient.patch(`/properties/${propertyId}/tenancies/splits`, splits);
    setIsSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Success', description: 'Splits updated successfully.' });
    setIsEditing(false);
    window.location.reload();
  };

  // Badge variant per status
  function statusVariant(status: string): 'active' | 'invited' | 'muted' {
    if (status === 'active') return 'active';
    if (status === 'invited') return 'invited';
    return 'muted';
  }

  const tableRows: TenancyRow[] = tenancies.map(t => ({ ...t } as TenancyRow));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Tenants &amp; Splits</h3>
          {isOwner && activeTenancies.length > 0 && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <span className={`text-sm font-numbers ${isValidSplit ? 'text-emerald-500' : 'text-red-500 font-bold'}`}>
                    {totalSplit.toFixed(2)}% {isValidSplit ? '✓' : '— must equal 100%'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveSplits} disabled={!isValidSplit || isSaving}>
                    {isSaving ? 'Saving...' : 'Save Splits'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit Splits</Button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        {isLoadingTenants ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : tenancies.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tenants yet"
              description="No tenants have been added to this property."
              action={isOwner && <Button variant="outline" onClick={onInviteClick}>Invite your first tenant</Button>}
            />
          </div>
        ) : (
          <DataTable<TenancyRow>
            data={tableRows}
            columns={[
              {
                header: 'Tenant',
                accessor: (row) => {
                  const displayName = row.tenantName ?? row.inviteEmail ?? '?';
                  return (
                    <div className="flex items-center gap-2.5">
                      <Avatar text={displayName} />
                      <span className="text-sm font-medium truncate">{displayName}</span>
                    </div>
                  );
                },
              },
              {
                header: 'Status',
                accessor: (row) => (
                  <Badge variant={statusVariant(row.status)}>
                    {row.status}
                  </Badge>
                ),
              },
              {
                header: 'Split',
                accessor: (row) => {
                  if (isEditing && (row.status === 'active' || row.status === 'invited')) {
                    return (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="range"
                          min="0" max="100" step="0.01"
                          value={splits[row.id] ?? 0}
                          onChange={(e) => handleSplitChange(row.id, e.target.value)}
                          className="w-24 accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0" max="100" step="0.01"
                          className="w-16 h-7 text-right border border-border rounded px-2 text-sm bg-surface font-numbers"
                          value={splits[row.id] ?? 0}
                          onChange={(e) => handleSplitChange(row.id, e.target.value)}
                        />
                        <span className="text-muted-foreground text-sm">%</span>
                      </div>
                    );
                  }
                  return (
                    <span className="font-numbers font-medium">
                      {splits[row.id] ?? row.splitPercentage ?? '—'}%
                    </span>
                  );
                },
                align: 'right',
              },
              {
                header: 'Joined',
                accessor: (row) =>
                row.invitedAt
                  ? new Date(row.invitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—',
                className: 'text-muted-foreground',
              },
              {
                header: '',
                accessor: (row) => {
                  if (!isOwner || isEditing) return null;

                  return (
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {row.status === 'invited' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/invite/${row.inviteToken}`);
                              toast({ title: 'Copied', description: 'Invite link copied to clipboard.' });
                            }}
                          >
                            Copy link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={async () => {
                              const { error } = await apiClient.post(`/tenancies/${row.id}/resend-invite`, {});
                              if (error) {
                                toast({ variant: 'destructive', title: 'Error', description: error.message });
                              } else {
                                toast({ title: 'Sent', description: 'Invite email resent.' });
                              }
                            }}
                          >
                            Resend
                          </Button>
                        </>
                      )}

                      {(row.status === 'active' || row.status === 'invited') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => handleRemoveTenant(row)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                },
                align: 'right',
              },
            ]}
          />
        )}

        {/* Invite another */}
        {isOwner && tenancies.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <Button variant="outline" size="sm" onClick={onInviteClick}>Invite another tenant</Button>
          </div>
        )}
      </div>

      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Remove Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this tenant? Their active tenancy status will end.
            </DialogDescription>
          </DialogHeader>

          {tenantToRemove && (Number(tenantToRemove.unpaidBills) > 0) && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-500 font-medium">
              Warning: This tenant has {String(tenantToRemove.unpaidBills)} unpaid bill(s). 
              Removing them will not delete the bills from your records.
            </div>
          )}

          <div className="space-y-2 py-2">
            <label htmlFor="removal-reason" className="text-sm font-medium text-foreground">
              Removal Reason (Optional)
            </label>
            <textarea
              id="removal-reason"
              placeholder="e.g. End of lease agreement"
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value.slice(0, 500))}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {removalReason.length} / 500 characters
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowRemoveDialog(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmRemoveTenant} disabled={isRemoving}>
              {isRemoving ? 'Removing...' : 'Remove Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
