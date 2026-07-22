import React from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatUnits } from '../../lib/format';
import type { Property } from '../../types/db';
import { SunMedium, Users, CheckCircle2, AlertCircle, Zap, Activity, Trash2, DollarSign, Bell, ArchiveRestore } from 'lucide-react';
import { usePropertySettings } from '../../hooks/use-property-settings';

interface PropertySettingsProps {
  property: Property;
  isOwner: boolean;
  onPropertyUpdate: (updated: Property) => void;
}

export function PropertySettings({ property, isOwner, onPropertyUpdate }: PropertySettingsProps) {
  const {
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
  } = usePropertySettings(property, onPropertyUpdate);

  if (!isOwner) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-muted-foreground">
        Settings are only available to the property owner.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GeneralSettings 
        localProperty={localProperty}
        isSettingsLoading={isSettingsLoading}
        onSave={(updates) => updateSettings(updates, 'General settings saved')}
      />
      <SolarSettings 
        localProperty={localProperty}
        isSolarLoading={isSolarLoading}
        onToggle={handleSolarToggle}
      />
      
      <SoloModeSettings 
        localProperty={localProperty}
        isSoloLoading={isSoloLoading}
        onToggle={handleSoloToggle}
      />

      <ReadingApprovalSettings 
        localProperty={localProperty}
        isSettingsLoading={isSettingsLoading}
        onToggle={(val: boolean) => updateSetting('readingsRequireApproval', val, val ? 'Approval required' : 'Auto-approval enabled')}
      />

      <PaymentTrackingSettings 
        localProperty={localProperty}
        isSettingsLoading={isSettingsLoading}
        onToggle={(val: boolean) => updateSetting('paymentTrackingEnabled', val, val ? 'Payment tracking enabled' : 'Payment tracking disabled')}
      />

      <MaxPendingRequestsSettings 
        localProperty={localProperty}
        isSettingsLoading={isSettingsLoading}
        onChange={(val: number | null) => setLocalProperty(prev => ({ ...prev, maxPendingEditRequests: val }))}
        onBlur={(val: number | null) => updateSetting('maxPendingEditRequests', val, 'Setting saved')}
      />

      <ReadingReminderSettings 
        localProperty={localProperty}
        isSettingsLoading={isSettingsLoading}
        onChange={(val: number | null) => setLocalProperty(prev => ({ ...prev, readingReminderDay: val }))}
        onBlur={(val: number | null) => updateSetting('readingReminderDay', val, 'Setting saved')}
      />
      <EnableSolarDialog 
        isOpen={isSolarOpen}
        onOpenChange={setIsSolarOpen}
        isLoading={isSolarLoading}
        solarForm={solarForm}
        setSolarForm={setSolarForm}
        onSubmit={handleEnableSolarSubmit}
      />

      <SoloModeWarningModal 
        isOpen={showSoloWarningModal}
        onOpenChange={setShowSoloWarningModal}
        activeTenants={activeTenantsList}
      />

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        onOpenChange={setShowArchiveConfirm}
        title="Archive Property"
        description={
          <>
            Are you sure you want to archive this property? It will be hidden from the main dashboard but its data will be preserved. Active tenants must be removed first.
            {unpaidBillsCount > 0 && (
              <p className="mt-2 text-red-600 font-medium">
                Note: There are {unpaidBillsCount} unpaid bill(s). Archiving will not cancel these bills, but you will not be able to actively manage them.
              </p>
            )}
          </>
        }
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={confirmArchiveProperty}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Property"
        description={
          <>
            Are you sure you want to delete this property? This action cannot be undone.
            {activeTenantsList.filter(t => !t.isOwnerTenancy).length > 0 && (
              <p className="mt-2 font-medium">
                Warning: There are {activeTenantsList.filter(t => !t.isOwnerTenancy).length} active tenant(s). Their tenancy will end, but they will still be able to access their past bills.
              </p>
            )}
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteProperty}
      />

      <DangerZone 
        isDeleting={isDeleting} 
        onDeleteClick={() => setShowDeleteConfirm(true)}
        isArchiving={isArchiving}
        onArchiveClick={() => setShowArchiveConfirm(true)}
      />
    </div>
  );
}

interface GeneralSettingsProps {
  localProperty: Property;
  isSettingsLoading: boolean;
  onSave: (updates: Partial<Property>) => Promise<void>;
}

function GeneralSettings({ localProperty, isSettingsLoading, onSave }: GeneralSettingsProps) {
  const [name, setName] = React.useState(localProperty.name);
  const [address, setAddress] = React.useState(localProperty.address || '');

  // Reset form when localProperty changes externally
  React.useEffect(() => {
    setName(localProperty.name);
    setAddress(localProperty.address || '');
  }, [localProperty.name, localProperty.address]);

  const hasChanges = name !== localProperty.name || address !== (localProperty.address || '');

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-4 flex-1">
          <h3 className="font-semibold text-lg text-foreground">GENERAL</h3>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="prop-name">Property Name *</Label>
              <Input 
                id="prop-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSettingsLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-address">Address (optional)</Label>
              <Input 
                id="prop-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isSettingsLoading}
              />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Button 
            disabled={!hasChanges || isSettingsLoading || !name.trim()} 
            onClick={() => onSave({ name, address })}
          >
            {isSettingsLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SolarSettingsProps {
  localProperty: Property;
  isSolarLoading: boolean;
  onToggle: (enable: boolean) => Promise<void>;
}

function SolarSettings({ localProperty, isSolarLoading, onToggle }: SolarSettingsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SunMedium className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold">Solar Installation</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {localProperty.hasSolar
              ? 'Solar mode is active. Bills use the solar + export calculation.'
              : 'Grid-only mode. Enable this if your property has solar panels with grid export.'}
          </p>
          {localProperty.hasSolar && localProperty.solarActivatedAt && (
            <p className="text-xs text-muted-foreground">
              Enabled on {new Date(localProperty.solarActivatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSolarLoading && <span className="text-xs text-muted-foreground">Saving...</span>}
          <Switch
            checked={localProperty.hasSolar ?? false}
            onCheckedChange={onToggle}
            disabled={isSolarLoading}
          />
        </div>
      </div>

      {localProperty.hasSolar && (
        <div className="rounded-md bg-muted/30 border p-4 text-xs space-y-1 font-mono">
          <p className="text-muted-foreground font-sans font-medium mb-2">Initial readings (baseline for first billing period)</p>
          <p>Solar Generation baseline: {formatUnits(localProperty.solarGenInitial ?? 0)}</p>
          <p>Export to Grid baseline: {formatUnits(localProperty.solarExportInitial ?? 0)}</p>
        </div>
      )}
    </div>
  );
}

interface SoloModeSettingsProps {
  localProperty: Property;
  isSoloLoading: boolean;
  onToggle: (enable: boolean) => Promise<void>;
}

function SoloModeSettings({ localProperty, isSoloLoading, onToggle }: SoloModeSettingsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Solo Mode</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            {localProperty.soloMode
              ? 'Solo mode is on. You are tracking your own utility bills without tenants. All consumption, solar generation, and export credits belong to you (100% split).'
              : 'Tenant mode. You can invite tenants to share bills. Enabling Solo Mode means you will track your own bills alone (no tenants can be invited, and all costs go 100% to you).'}
          </p>
          {!localProperty.soloMode && (
            <p className="text-xs text-muted-foreground mt-1">
              Note: Switching to Solo Mode requires removing all active tenants first.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSoloLoading && <span className="text-xs text-muted-foreground">Saving...</span>}
          <Switch
            checked={localProperty.soloMode ?? false}
            onCheckedChange={onToggle}
            disabled={isSoloLoading}
          />
        </div>
      </div>
    </div>
  );
}

interface ReadingApprovalSettingsProps {
  localProperty: Property;
  isSettingsLoading: boolean;
  onToggle: (enable: boolean) => void;
}

function ReadingApprovalSettings({ localProperty, isSettingsLoading, onToggle }: ReadingApprovalSettingsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Reading Approval</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {localProperty.readingsRequireApproval
              ? 'Tenant readings require your approval before bills are calculated.'
              : 'Tenant readings are auto-accepted and bills are generated immediately.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSettingsLoading && <span className="text-xs text-muted-foreground">Saving...</span>}
          <Switch
            checked={localProperty.readingsRequireApproval ?? false}
            onCheckedChange={onToggle}
            disabled={isSettingsLoading}
          />
        </div>
      </div>
    </div>
  );
}

interface PaymentTrackingSettingsProps {
  localProperty: Property;
  isSettingsLoading: boolean;
  onToggle: (enable: boolean) => void;
}

function PaymentTrackingSettings({ localProperty, isSettingsLoading, onToggle }: PaymentTrackingSettingsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold">Payment Tracking</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {localProperty.paymentTrackingEnabled
              ? 'Meterly will track whether bills have been paid.'
              : 'Payment tracking is disabled. Bills are assumed paid when generated.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={localProperty.paymentTrackingEnabled ?? true}
            onCheckedChange={onToggle}
            disabled={isSettingsLoading}
          />
        </div>
      </div>
    </div>
  );
}

interface MaxPendingRequestsSettingsProps {
  localProperty: Property;
  isSettingsLoading: boolean;
  onChange: (val: number | null) => void;
  onBlur: (val: number | null) => void;
}

function MaxPendingRequestsSettings({ localProperty, isSettingsLoading, onChange, onBlur }: MaxPendingRequestsSettingsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 w-full">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Max Edit Requests</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            How many open edit requests can a tenant have at one time? (0 = unlimited)
          </p>
          <div className="flex gap-2 w-full max-w-xs">
            <Input
              type="number"
              min="0"
              value={localProperty.maxPendingEditRequests ?? 3}
              onChange={(e) => onChange(parseInt(e.target.value) || 0)}
              onBlur={() => onBlur(localProperty.maxPendingEditRequests)}
              disabled={isSettingsLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface DangerZoneProps {
  isDeleting: boolean;
  onDeleteClick: () => void;
  isArchiving: boolean;
  onArchiveClick: () => void;
}

function DangerZone({ isDeleting, onDeleteClick, isArchiving, onArchiveClick }: DangerZoneProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/40 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ArchiveRestore className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900 dark:text-red-200">Archive Property</h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300">
            Hide this property from the main dashboard. Active tenants must be removed first. Data is preserved.
          </p>
        </div>
        <Button variant="destructive" onClick={onArchiveClick} disabled={isArchiving || isDeleting}>
          {isArchiving ? 'Archiving...' : 'Archive Property'}
        </Button>
      </div>

      <div className="h-px bg-red-200/50 dark:bg-red-900/50" />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900 dark:text-red-200">Delete Property</h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300">
            Permanently remove this property and all associated data. This action cannot be undone.
          </p>
        </div>
        <Button variant="destructive" onClick={onDeleteClick} disabled={isDeleting || isArchiving}>
          {isDeleting ? 'Deleting...' : 'Delete Property'}
        </Button>
      </div>
    </div>
  );
}

interface EnableSolarDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  solarForm: { solarGenInitial: number; solarExportInitial: number; importInitial: number };
  setSolarForm: React.Dispatch<React.SetStateAction<{ solarGenInitial: number; solarExportInitial: number; importInitial: number }>>;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
}

function EnableSolarDialog({ isOpen, onOpenChange, isLoading, solarForm, setSolarForm, onSubmit }: EnableSolarDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Enable Solar Panels?</DialogTitle>
            <DialogDescription>
              What changes after enabling:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
                <li>Future billing periods use solar + export calculations</li>
                <li>Historical grid-only periods are unaffected</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="solarGenInitial" className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Current Solar Generation Reading (units)
              </Label>
              <Input
                id="solarGenInitial"
                type="number"
                min="0"
                step="0.01"
                required
                value={solarForm.solarGenInitial || ''}
                onChange={e => setSolarForm({ ...solarForm, solarGenInitial: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 3005"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="solarExportInitial" className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Export to Grid Meter (current reading)
              </Label>
              <Input
                id="solarExportInitial"
                type="number"
                min="0"
                step="0.01"
                required
                value={solarForm.solarExportInitial || ''}
                onChange={e => setSolarForm({ ...solarForm, solarExportInitial: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 2690"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importInitial" className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Import from Grid Meter (current reading)
              </Label>
              <Input
                id="importInitial"
                type="number"
                min="0"
                step="0.01"
                required
                value={solarForm.importInitial || ''}
                onChange={e => setSolarForm({ ...solarForm, importInitial: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 605"
              />
              <p className="text-xs text-muted-foreground pt-1">
                Pre-filled from your last billing period if available. Change only if your meter shows a different number.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enabling...' : 'Enable Solar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SoloModeWarningModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeTenants: Array<{ id: string; inviteEmail: string | null; status: string; isOwnerTenancy: boolean; tenantName: string | null }>;
}

function SoloModeWarningModal({ isOpen, onOpenChange, activeTenants }: SoloModeWarningModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cannot Enable Solo Mode</DialogTitle>
          <DialogDescription>
            You have {activeTenants.length} active tenant(s):
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <ul className="list-disc pl-5 space-y-1">
            {activeTenants.map((t) => (
              <li key={t.id} className="text-sm font-medium">
                {t.tenantName ? `${t.tenantName} (${t.inviteEmail || 'No email'})` : t.inviteEmail || 'No email'}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Please remove all tenants before enabling solo mode.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReadingReminderSettingsProps {
  localProperty: Property;
  isSettingsLoading: boolean;
  onChange: (val: number | null) => void;
  onBlur: (val: number | null) => void;
}

function ReadingReminderSettings({ localProperty, isSettingsLoading, onChange, onBlur }: ReadingReminderSettingsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 w-full">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Reading Reminder</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Send a reminder if last month's readings are not submitted by the:
            <br />
            (Notifications go to you and your active tenants.)
          </p>
          <div className="flex items-center gap-2 w-full max-w-xs">
            <Input
              type="number"
              min="1"
              max="28"
              value={localProperty.readingReminderDay ?? 5}
              onChange={(e) => onChange(parseInt(e.target.value) || 1)}
              onBlur={() => onBlur(localProperty.readingReminderDay)}
              disabled={isSettingsLoading}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">th of the month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
