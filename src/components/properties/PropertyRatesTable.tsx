import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { TooltipIcon } from '../ui/tooltip';
import { TableActionDialog } from '../common/TableActionDialog';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../lib/api-client';


interface PropertyRatesProps {
  propertyId: string;
  isOwner: boolean;
}

interface Rate {
  id: string;
  consumptionRate: number;
  exportRate: number;
  effectiveFrom: string; // YYYY-MM-DD
  createdAt: string;
  createdBy: string;
}

export function PropertyRatesTable({ propertyId, isOwner }: PropertyRatesProps) {
  const { toast } = useToast();
  const [rates, setRates] = useState<Rate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingRate, setIsAddingRate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRateForm, setNewRateForm] = useState({
    consumptionRate: 0,
    exportRate: 0,
    effectiveFrom: '', // YYYY-MM-DD
  });

  useEffect(() => {
    fetchRates();
  }, [propertyId]);

  const fetchRates = async () => {
    setIsLoading(true);
    const { data, error } = await apiClient.get<Rate[]>(`/properties/${propertyId}/rates`);
    if (error) {
      toast({ variant: "destructive", title: "Error fetching rates", description: error.message });
    } else if (data) {
      setRates(data);
    }
    setIsLoading(false);
  };

  const handleAddRate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAddingRate(true);

    const { data, error } = await apiClient.post<Rate>(`/properties/${propertyId}/rates`, newRateForm);

    setIsAddingRate(false);

    if (error) {
      toast({ variant: "destructive", title: "Error adding rate", description: error.message });
      return;
    }

    toast({ title: "Rate Added!", description: `New rate effective from ${data?.effectiveFrom}.` });
    setIsModalOpen(false);
    setNewRateForm({ consumptionRate: 0, exportRate: 0, effectiveFrom: '' });
    fetchRates(); // Refresh the list
  };

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Rates History</h3>
        {isOwner && (
          <TableActionDialog
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            triggerLabel="Add New Rate"
            title="Add New Rate Version"
            description="Define new consumption, export rates, and fixed charges. These will become effective from the specified date."
            onSubmit={handleAddRate}
            submitLabel="Add Rate"
            submittingLabel="Adding..."
            isSubmitting={isAddingRate}
            isSubmitDisabled={!newRateForm.effectiveFrom || newRateForm.consumptionRate <= 0}
          >
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective From <span className="text-red-500">*</span></Label>
              <Input 
                id="effectiveFrom" 
                type="date" 
                required 
                value={newRateForm.effectiveFrom}
                onChange={e => setNewRateForm({ ...newRateForm, effectiveFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumptionRate">Consumption Rate (₹/unit) <span className="text-red-500">*</span></Label>
              <Input 
                id="consumptionRate" 
                type="number" 
                step="0.001" 
                min="0" 
                max={1000}
                required 
                value={newRateForm.consumptionRate}
                onChange={e => setNewRateForm({ ...newRateForm, consumptionRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exportRate">Export Rate (₹/unit)</Label>
              <Input 
                id="exportRate" 
                type="number" 
                step="0.001" 
                min="0" 
                max={1000}
                value={newRateForm.exportRate}
                onChange={e => setNewRateForm({ ...newRateForm, exportRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </TableActionDialog>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
        </div>
      ) : rates.length === 0 ? (
        <div className="px-6 py-10 text-center text-muted-foreground text-sm border-dashed border border-border rounded-lg m-6">
          No rates configured for this property yet.
          {isOwner && <p className="mt-1 text-xs">Add the first rate version above.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    Effective From
                    <TooltipIcon content="Date from which this rate version applies to new billing periods" />
                  </span>
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Consumption
                    <TooltipIcon content="Rate per unit (kWh) consumed" />
                  </span>
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Export
                    <TooltipIcon content="Rate per unit exported to the grid (solar only)" />
                  </span>
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((rate, ri) => (
                <tr key={rate.id} className={`group transition-colors hover:bg-surface-raised/60 ${ri % 2 === 1 ? 'bg-surface-raised/20' : ''}`}>
                  <td className="px-4 py-3 font-medium">{rate.effectiveFrom}</td>
                  <td className="px-4 py-3 text-right font-numbers">₹{rate.consumptionRate.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right font-numbers">₹{rate.exportRate.toFixed(3)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(rate.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
