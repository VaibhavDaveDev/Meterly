import { ConfirmDialog } from "../common/ConfirmDialog";
import type { Property } from "../../types/db";
import { usePropertySettings } from "../../hooks/use-property-settings";
import {
  GeneralSettings,
  SolarSettings,
  SoloModeSettings,
  ReadingApprovalSettings,
  PaymentTrackingSettings,
  MaxPendingRequestsSettings,
  ReadingReminderSettings,
  DangerZone,
} from "./SettingsSections";
import { EnableSolarDialog, SoloModeWarningModal } from "./SettingsDialogs";

interface PropertySettingsProps {
  property: Property;
  isOwner: boolean;
  onPropertyUpdate: (updated: Property) => void;
}

export function PropertySettings({
  property,
  isOwner,
  onPropertyUpdate,
}: PropertySettingsProps) {
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

  const activeNonOwnerTenants = activeTenantsList.filter(
    (t) => !t.isOwnerTenancy
  );
  const activeNonOwnerTenantCount = activeNonOwnerTenants.length;

  return (
    <div className="space-y-6">
      <GeneralSettings
        propertyName={localProperty.name}
        propertyAddress={localProperty.address}
        isSettingsLoading={isSettingsLoading}
        onSave={(updates) => updateSettings(updates, "General settings saved")}
      />
      <SolarSettings
        hasSolar={localProperty.hasSolar}
        solarActivatedAt={
          localProperty.solarActivatedAt
            ? new Date(localProperty.solarActivatedAt).toISOString()
            : null
        }
        solarGenInitial={localProperty.solarGenInitial}
        solarExportInitial={localProperty.solarExportInitial}
        isSolarLoading={isSolarLoading}
        onToggle={handleSolarToggle}
      />

      <SoloModeSettings
        soloMode={localProperty.soloMode}
        isSoloLoading={isSoloLoading}
        onToggle={handleSoloToggle}
      />

      <ReadingApprovalSettings
        readingsRequireApproval={localProperty.readingsRequireApproval}
        isSettingsLoading={isSettingsLoading}
        onToggle={(val: boolean) =>
          updateSetting(
            "readingsRequireApproval",
            val,
            val ? "Approval required" : "Auto-approval enabled"
          )
        }
      />

      <PaymentTrackingSettings
        paymentTrackingEnabled={localProperty.paymentTrackingEnabled}
        isSettingsLoading={isSettingsLoading}
        onToggle={(val: boolean) =>
          updateSetting(
            "paymentTrackingEnabled",
            val,
            val ? "Payment tracking enabled" : "Payment tracking disabled"
          )
        }
      />

      <MaxPendingRequestsSettings
        maxPendingEditRequests={localProperty.maxPendingEditRequests}
        isSettingsLoading={isSettingsLoading}
        onChange={(val: number | null) =>
          setLocalProperty((prev) => ({ ...prev, maxPendingEditRequests: val }))
        }
        onBlur={(val: number | null) =>
          updateSetting("maxPendingEditRequests", val, "Setting saved")
        }
      />

      <ReadingReminderSettings
        readingReminderDay={localProperty.readingReminderDay}
        isSettingsLoading={isSettingsLoading}
        onChange={(val: number | null) =>
          setLocalProperty((prev) => ({ ...prev, readingReminderDay: val }))
        }
        onBlur={(val: number | null) =>
          updateSetting("readingReminderDay", val, "Setting saved")
        }
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
        activeTenants={activeNonOwnerTenants}
      />

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        onOpenChange={setShowArchiveConfirm}
        title="Archive Property"
        description={
          <>
            Are you sure you want to archive this property? It will be hidden
            from the main dashboard but its data will be preserved. Active
            tenants must be removed first.
            {unpaidBillsCount > 0 && (
              <p className="mt-2 text-red-600 font-medium">
                Note: There are {unpaidBillsCount} unpaid bill(s). Archiving
                will not cancel these bills, but you will not be able to
                actively manage them.
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
            Are you sure you want to delete this property? This action cannot be
            undone.
            {activeNonOwnerTenantCount > 0 && (
              <p className="mt-2 font-medium">
                Warning: There are {activeNonOwnerTenantCount} active tenant(s).
                Their tenancy will end, but they will still be able to access
                their past bills.
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
