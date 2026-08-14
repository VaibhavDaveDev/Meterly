import React from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { formatUnits } from "../../lib/format";
import type { Property } from "../../types/db";
import {
  SunMedium,
  Users,
  CheckCircle2,
  AlertCircle,
  Trash2,
  DollarSign,
  Bell,
  ArchiveRestore,
} from "lucide-react";

export interface GeneralSettingsProps {
  propertyName: string;
  propertyAddress: string | null;
  isSettingsLoading: boolean;
  onSave: (updates: Partial<Property>) => Promise<void>;
}

export function GeneralSettings({
  propertyName,
  propertyAddress,
  isSettingsLoading,
  onSave,
}: GeneralSettingsProps) {
  const [name, setName] = React.useState(propertyName);
  const [address, setAddress] = React.useState(propertyAddress || "");

  React.useEffect(() => {
    setName(propertyName);
    setAddress(propertyAddress || "");
  }, [propertyName, propertyAddress]);

  const trimmedName = name.trim();
  const trimmedAddress = address.trim();
  const hasChanges =
    trimmedName !== propertyName || trimmedAddress !== (propertyAddress || "");

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-4 flex-1">
          <h3 className="font-semibold text-lg text-foreground">GENERAL</h3>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="propertyName">Property Name</Label>
              <Input
                id="propertyName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSettingsLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyAddress">Address (Optional)</Label>
              <textarea
                id="propertyAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isSettingsLoading}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            disabled={!hasChanges || isSettingsLoading || !trimmedName}
            onClick={() =>
              onSave({ name: trimmedName, address: trimmedAddress || null })
            }
          >
            {isSettingsLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface SolarSettingsProps {
  hasSolar: boolean | null;
  solarActivatedAt: string | null;
  solarGenInitial: number | null;
  solarExportInitial: number | null;
  isSolarLoading: boolean;
  onToggle: (enable: boolean) => Promise<void>;
}

export function SolarSettings({
  hasSolar,
  solarActivatedAt,
  solarGenInitial,
  solarExportInitial,
  isSolarLoading,
  onToggle,
}: SolarSettingsProps) {
  const labelId = React.useId();
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SunMedium className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold" id={labelId}>
              Solar Installation
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {hasSolar
              ? "Solar mode is active. Bills use the solar + export calculation."
              : "Grid-only mode. Enable this if your property has solar panels with grid export."}
          </p>
          {hasSolar && solarActivatedAt && (
            <p className="text-xs text-muted-foreground">
              Enabled on {new Date(solarActivatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSolarLoading && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          <Switch
            aria-labelledby={labelId}
            checked={hasSolar ?? false}
            onCheckedChange={onToggle}
            disabled={isSolarLoading}
          />
        </div>
      </div>

      {hasSolar && (
        <div className="rounded-md bg-muted/30 border p-4 text-xs space-y-1 font-mono">
          <p className="text-muted-foreground font-sans font-medium mb-2">
            Initial readings (baseline for first billing period)
          </p>
          <p>Solar Generation baseline: {formatUnits(solarGenInitial ?? 0)}</p>
          <p>Export to Grid baseline: {formatUnits(solarExportInitial ?? 0)}</p>
        </div>
      )}
    </div>
  );
}

interface ToggleSettingCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  note?: string;
  checked: boolean;
  isLoading: boolean;
  onToggle: (enable: boolean) => void | Promise<void>;
}

function ToggleSettingCard({
  icon,
  title,
  description,
  note,
  checked,
  isLoading,
  onToggle,
}: ToggleSettingCardProps) {
  const labelId = React.useId();
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-semibold" id={labelId}>
              {title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            {description}
          </p>
          {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoading && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          <Switch
            aria-labelledby={labelId}
            checked={checked}
            onCheckedChange={onToggle}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

export interface SoloModeSettingsProps {
  soloMode: boolean | null;
  isSoloLoading: boolean;
  onToggle: (enable: boolean) => Promise<void>;
}

export function SoloModeSettings({
  soloMode,
  isSoloLoading,
  onToggle,
}: SoloModeSettingsProps) {
  return (
    <ToggleSettingCard
      icon={<Users className="w-5 h-5 text-primary" />}
      title="Solo Mode"
      description={
        soloMode
          ? "Solo mode is on. You are tracking your own utility bills without tenants. All consumption, solar generation, and export credits belong to you (100% split)."
          : "Tenant mode. You can invite tenants to share bills. Enabling Solo Mode means you will track your own bills alone (no tenants can be invited, and all costs go 100% to you)."
      }
      note={
        !soloMode
          ? "Note: Switching to Solo Mode requires removing all active tenants first."
          : undefined
      }
      checked={soloMode ?? false}
      isLoading={isSoloLoading}
      onToggle={onToggle}
    />
  );
}

export interface ReadingApprovalSettingsProps {
  readingsRequireApproval: boolean | null;
  isSettingsLoading: boolean;
  onToggle: (enable: boolean) => void;
}

export function ReadingApprovalSettings({
  readingsRequireApproval,
  isSettingsLoading,
  onToggle,
}: ReadingApprovalSettingsProps) {
  return (
    <ToggleSettingCard
      icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
      title="Reading Approval"
      description={
        readingsRequireApproval
          ? "Tenant readings require your approval before bills are calculated."
          : "Tenant readings are auto-accepted and bills are generated immediately."
      }
      checked={readingsRequireApproval ?? false}
      isLoading={isSettingsLoading}
      onToggle={onToggle}
    />
  );
}

export interface PaymentTrackingSettingsProps {
  paymentTrackingEnabled: boolean | null;
  isSettingsLoading: boolean;
  onToggle: (enable: boolean) => void;
}

export function PaymentTrackingSettings({
  paymentTrackingEnabled,
  isSettingsLoading,
  onToggle,
}: PaymentTrackingSettingsProps) {
  return (
    <ToggleSettingCard
      icon={<DollarSign className="w-5 h-5 text-green-600" />}
      title="Payment Tracking"
      description={
        paymentTrackingEnabled
          ? "Meterly will track whether bills have been paid."
          : "Payment tracking is disabled. Bills are assumed paid when generated."
      }
      checked={paymentTrackingEnabled ?? false}
      isLoading={isSettingsLoading}
      onToggle={onToggle}
    />
  );
}

export interface MaxPendingRequestsSettingsProps {
  maxPendingEditRequests: number | null;
  isSettingsLoading: boolean;
  onChange: (val: number | null) => void;
  onBlur: (val: number | null) => void;
}

export function MaxPendingRequestsSettings({
  maxPendingEditRequests,
  isSettingsLoading,
  onChange,
  onBlur,
}: MaxPendingRequestsSettingsProps) {
  const [draft, setDraft] = React.useState(String(maxPendingEditRequests ?? 3));
  React.useEffect(() => {
    setDraft(String(maxPendingEditRequests ?? 3));
  }, [maxPendingEditRequests]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 w-full">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold">Edit Requests Limit</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            How many open edit requests can a tenant have at one time? (0 =
            unlimited)
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Label htmlFor="maxEditRequests" className="sr-only">
              Max Edit Requests
            </Label>
            <Input
              id="maxEditRequests"
              type="number"
              min="0"
              max="50"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0 && val <= 50) onChange(val);
              }}
              onBlur={() => {
                const val = parseInt(draft, 10);
                if (isNaN(val)) {
                  setDraft(String(maxPendingEditRequests ?? 3));
                  return;
                }
                const clamped = Math.min(50, Math.max(0, val));
                setDraft(String(clamped));
                onBlur(clamped);
              }}
              disabled={isSettingsLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ReadingReminderSettingsProps {
  readingReminderDay: number | null;
  isSettingsLoading: boolean;
  onChange: (val: number | null) => void;
  onBlur: (val: number | null) => void;
}

export function ReadingReminderSettings({
  readingReminderDay,
  isSettingsLoading,
  onChange,
  onBlur,
}: ReadingReminderSettingsProps) {
  const [draft, setDraft] = React.useState(String(readingReminderDay ?? 5));

  React.useEffect(() => {
    setDraft(String(readingReminderDay ?? 5));
  }, [readingReminderDay]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 w-full">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Reading Reminder</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Send a reminder if last month's readings are not submitted by this
            day of the month.
            <br />
            (Notifications go to you and your active tenants.)
          </p>
          <div className="flex items-center gap-2 w-full max-w-xs">
            <Label htmlFor="reminderDay" className="sr-only">
              Reminder Day
            </Label>
            <Input
              id="reminderDay"
              type="number"
              min="1"
              max="28"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 28) onChange(val);
              }}
              onBlur={() => {
                const val = parseInt(draft, 10);
                const clamped = isNaN(val)
                  ? (readingReminderDay ?? 5)
                  : Math.min(28, Math.max(1, val));
                setDraft(String(clamped));
                onBlur(clamped);
              }}
              disabled={isSettingsLoading}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              day of the month
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface DangerZoneProps {
  isDeleting: boolean;
  onDeleteClick: () => void;
  isArchiving: boolean;
  onArchiveClick: () => void;
}

export function DangerZone({
  isDeleting,
  onDeleteClick,
  isArchiving,
  onArchiveClick,
}: DangerZoneProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/40 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ArchiveRestore className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900 dark:text-red-200">
              Archive Property
            </h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300">
            Hide this property from the main dashboard. Active tenants must be
            removed first. Data is preserved.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onArchiveClick}
          disabled={isArchiving || isDeleting}
        >
          {isArchiving ? "Archiving..." : "Archive Property"}
        </Button>
      </div>

      <div className="h-px bg-red-200/50 dark:bg-red-900/50" />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900 dark:text-red-200">
              Delete Property
            </h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300">
            Permanently remove this property and all associated data. This
            action cannot be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={onDeleteClick}
          disabled={isDeleting || isArchiving}
        >
          {isDeleting ? "Deleting..." : "Delete Property"}
        </Button>
      </div>
    </div>
  );
}
