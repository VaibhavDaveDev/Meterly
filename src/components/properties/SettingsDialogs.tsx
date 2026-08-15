import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Zap, Activity } from "lucide-react";

export interface SolarInitialReadings {
  solarGenInitial: number;
  solarExportInitial: number;
  importInitial: number;
}

export interface EnableSolarDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  solarForm: SolarInitialReadings;
  setSolarForm: React.Dispatch<React.SetStateAction<SolarInitialReadings>>;
  onSubmit: (values: SolarInitialReadings) => Promise<void>;
}

export function EnableSolarDialog({
  isOpen,
  onOpenChange,
  isLoading,
  solarForm,
  setSolarForm,
  onSubmit,
}: EnableSolarDialogProps) {
  const [solarGenDraft, setSolarGenDraft] = React.useState(
    String(solarForm.solarGenInitial ?? "")
  );
  const [solarExportDraft, setSolarExportDraft] = React.useState(
    String(solarForm.solarExportInitial ?? "")
  );
  const [importDraft, setImportDraft] = React.useState(
    String(solarForm.importInitial ?? "")
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSolarGenDraft(String(solarForm.solarGenInitial ?? ""));
      setSolarExportDraft(String(solarForm.solarExportInitial ?? ""));
      setImportDraft(String(solarForm.importInitial ?? ""));
      setFormError(null);
    }
    // Seed drafts only when dialog opens. solarForm changes come FROM these
    // drafts via onBlur, so re-syncing on solarForm would overwrite in-progress input.
  }, [isOpen]);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const gen = parseFloat(solarGenDraft);
    const exp = parseFloat(solarExportDraft);
    const imp = parseFloat(importDraft);
    if (![gen, exp, imp].every((v) => Number.isFinite(v) && v >= 0)) {
      setFormError(
        "Enter a valid number of 0 or more for all three meter readings."
      );
      return;
    }
    setFormError(null);
    const values: SolarInitialReadings = {
      solarGenInitial: gen,
      solarExportInitial: exp,
      importInitial: imp,
    };
    setSolarForm(values);
    void onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enable Solar Panels?</DialogTitle>
            <DialogDescription>
              What changes after enabling:
              <br />
              • Future billing periods use solar + export calculations
              <br />• Historical grid-only periods are unaffected
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="solarGenInitial"
                className="flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-500" />
                Current Solar Generation Reading (units)
              </Label>
              <Input
                id="solarGenInitial"
                type="number"
                min="0"
                step="0.01"
                required
                value={solarGenDraft}
                onChange={(e) => setSolarGenDraft(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(solarGenDraft);
                  if (!isNaN(v))
                    setSolarForm({ ...solarForm, solarGenInitial: v });
                  else
                    setSolarGenDraft(String(solarForm.solarGenInitial ?? ""));
                }}
                placeholder="e.g. 3005"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="solarExportInitial"
                className="flex items-center gap-2"
              >
                <Activity className="w-4 h-4 text-blue-500" />
                Export to Grid Meter (current reading)
              </Label>
              <Input
                id="solarExportInitial"
                type="number"
                min="0"
                step="0.01"
                required
                value={solarExportDraft}
                onChange={(e) => setSolarExportDraft(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(solarExportDraft);
                  if (!isNaN(v))
                    setSolarForm({ ...solarForm, solarExportInitial: v });
                  else
                    setSolarExportDraft(
                      String(solarForm.solarExportInitial ?? "")
                    );
                }}
                placeholder="e.g. 2690"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="importInitial"
                className="flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-primary" />
                Import from Grid Meter (current reading)
              </Label>
              <Input
                id="importInitial"
                type="number"
                min="0"
                step="0.01"
                required
                value={importDraft}
                onChange={(e) => setImportDraft(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(importDraft);
                  if (!isNaN(v))
                    setSolarForm({ ...solarForm, importInitial: v });
                  else setImportDraft(String(solarForm.importInitial ?? ""));
                }}
                placeholder="e.g. 605"
              />
              <p className="text-xs text-muted-foreground pt-1">
                Pre-filled from your last billing period if available. Change
                only if your meter shows a different number.
              </p>
            </div>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive mb-2">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enabling..." : "Enable Solar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ActiveTenantSummary {
  id: string;
  inviteEmail: string | null;
  status: string;
  isOwnerTenancy: boolean;
  tenantName: string | null;
}

export interface SoloModeWarningModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeTenants: ActiveTenantSummary[];
}

export function SoloModeWarningModal({
  isOpen,
  onOpenChange,
  activeTenants,
}: SoloModeWarningModalProps) {
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
                {t.tenantName
                  ? `${t.tenantName} (${t.inviteEmail || "No email"})`
                  : t.inviteEmail || "No email"}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Please remove all tenants before enabling solo mode.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
