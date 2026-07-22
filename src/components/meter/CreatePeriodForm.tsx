import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { MeterInput } from './MeterInput';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface CreatePeriodFormProps {
  propertyId: string;
  isPastEntry: boolean;
}

interface PropertyInfo {
  id: string;
  name: string;
  hasSolar: boolean;
}

interface ReadingInfo {
  importEnd?: number;
  solarGenerationEnd?: number;
  exportEnd?: number;
}

interface PeriodInfo {
  id: string;
  reading?: ReadingInfo;
}

export function CreatePeriodForm({ propertyId, isPastEntry }: CreatePeriodFormProps) {
  const { toast } = useToast();
  const [periodMonth, setPeriodMonth] = useState('');
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [importStart, setImportStart] = useState('');
  const [importEnd, setImportEnd] = useState('');
  const [solarGenStart, setSolarGenStart] = useState('');
  const [solarGenEnd, setSolarGenEnd] = useState('');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  const [oneOffCharges, setOneOffCharges] = useState<Array<{name: string, amount: number, chargedToTenant: boolean}>>([]);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [newChargeToTenant, setNewChargeToTenant] = useState(true);

  const handleAddCharge = () => {
    if (!newChargeName || !newChargeAmount) return;
    setOneOffCharges([...oneOffCharges, { name: newChargeName, amount: parseFloat(newChargeAmount), chargedToTenant: newChargeToTenant }]);
    setNewChargeName('');
    setNewChargeAmount('');
    setNewChargeToTenant(true);
  };

  const handleRemoveCharge = (index: number) => {
    setOneOffCharges(oneOffCharges.filter((_, i) => i !== index));
  };

  useEffect(() => {
    // Fetch property and last period to prefill start values
    Promise.all([
      fetch(`/api/properties/${propertyId}`).then(r => r.json() as Promise<{ success: boolean; data: PropertyInfo }>),
      fetch(`/api/properties/${propertyId}/periods?limit=1`).then(r => r.json() as Promise<{ success: boolean; data: PeriodInfo[] }>)
    ]).then(([propData, periodsData]) => {
      if (propData.success) {
        setProperty(propData.data);
      }
      if (periodsData.success && periodsData.data.length > 0) {
        const lastP = periodsData.data[0];
        // Pre-fill start values from last period's end values if available
        if (lastP.reading) {
          setImportStart(lastP.reading.importEnd?.toString() || '0');
          setSolarGenStart(lastP.reading.solarGenerationEnd?.toString() || '0');
          setExportStart(lastP.reading.exportEnd?.toString() || '0');
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [propertyId]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!periodMonth) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a period month.' });
      return;
    }

    const impS = parseFloat(importStart);
    const impE = parseFloat(importEnd);
    if (isNaN(impS) || isNaN(impE)) {
      toast({ variant: 'destructive', title: 'Error', description: 'Import readings are required.' });
      return;
    }

    if (impE < impS) {
      toast({ variant: 'destructive', title: 'Error', description: 'Import end reading cannot be less than start reading.' });
      return;
    }

    if (property?.hasSolar) {
      const solS = parseFloat(solarGenStart || '0');
      const solE = parseFloat(solarGenEnd || '0');
      const expS = parseFloat(exportStart || '0');
      const expE = parseFloat(exportEnd || '0');

      if (solE < solS) {
        toast({ variant: 'destructive', title: 'Error', description: 'Solar Generation end reading cannot be less than start reading.' });
        return;
      }
      if (expE < expS) {
        toast({ variant: 'destructive', title: 'Error', description: 'Grid Export end reading cannot be less than start reading.' });
        return;
      }

      const solarGenerated = solE - solS;
      const gridExported = expE - expS;
      if (gridExported > solarGenerated) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Grid Exported (${gridExported} units) cannot exceed Solar Generated (${solarGenerated} units).`
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Create period and readings in one API call
      const res = await fetch(`/api/properties/${propertyId}/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth: periodMonth + '-01', // API expects YYYY-MM-DD
          readings: {
            importStart: impS,
            importEnd: impE,
            solarGenerationStart: property?.hasSolar ? parseFloat(solarGenStart || '0') : 0,
            solarGenerationEnd: property?.hasSolar ? parseFloat(solarGenEnd || '0') : 0,
            exportStart: property?.hasSolar ? parseFloat(exportStart || '0') : 0,
            exportEnd: property?.hasSolar ? parseFloat(exportEnd || '0') : 0,
          }
        })
      });
      
      const json = await res.json() as { success: boolean; error?: { message: string } };
      if (json.success) {
        toast({ title: 'Success', description: 'Historical period and readings created successfully.' });
        window.location.href = `/properties/${propertyId}`;
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error?.message || 'Failed to create period' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Network error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isPastEntry && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground m-0">Adding Historical Data</p>
            <p className="text-xs text-muted-foreground m-0 mt-1">
              Enter the exact meter readings for this past month. Ensure readings follow chronological order.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="periodMonth" className="text-sm font-medium text-foreground">Period Month <span className="text-red-500">*</span></label>
          <input
            id="periodMonth"
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            max={new Date().toISOString().slice(0, 7)}
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
        <h3 className="text-lg font-semibold text-foreground m-0">Meter Readings</h3>
        
        <div className="grid gap-6 sm:grid-cols-2">
          <MeterInput
            label="Import from Grid - Start"
            value={importStart}
            onChangeValue={setImportStart}
            startValue={0}
            color="blue"
            required
          />
          <MeterInput
            label="Import from Grid - End"
            value={importEnd}
            onChangeValue={setImportEnd}
            startValue={parseFloat(importStart) || 0}
            color="blue"
            required
          />
        </div>

        {property?.hasSolar && (
          <div className="space-y-6 border-t border-border pt-6">
            <h4 className="text-md font-semibold text-foreground m-0">Solar Readings</h4>
            <div className="grid gap-6 sm:grid-cols-2">
              <MeterInput
                label="Solar Generation - Start"
                value={solarGenStart}
                onChangeValue={setSolarGenStart}
                startValue={0}
                color="emerald"
                required
              />
              <MeterInput
                label="Solar Generation - End"
                value={solarGenEnd}
                onChangeValue={setSolarGenEnd}
                startValue={parseFloat(solarGenStart) || 0}
                color="emerald"
                required
              />
              <MeterInput
                label="Export to Grid - Start"
                value={exportStart}
                onChangeValue={setExportStart}
                startValue={0}
                color="emerald"
                required
              />
              <MeterInput
                label="Export to Grid - End"
                value={exportEnd}
                onChangeValue={setExportEnd}
                startValue={parseFloat(exportStart) || 0}
                color="emerald"
                required
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground m-0">One-off Custom Charges</h3>
        <p className="text-sm text-muted-foreground m-0">Add any one-off adjustments for this period (e.g. late fees, discounts).</p>
        
        <div className="space-y-2 max-w-lg">
          {oneOffCharges.map((c, i) => (
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
              <Input placeholder="Charge name" value={newChargeName} onChange={e => setNewChargeName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="w-24 space-y-1">
              <Input type="number" placeholder="Amt" value={newChargeAmount} onChange={e => setNewChargeAmount(e.target.value)} className="h-9 text-sm" />
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
              <Button type="button" variant="secondary" size="sm" className="h-8 text-xs px-3" onClick={handleAddCharge}>Add</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Period & Save Readings
        </Button>
      </div>
    </form>
  );
}
