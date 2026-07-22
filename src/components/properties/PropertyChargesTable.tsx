import { useState, useEffect, type SubmitEvent } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { TableActionDialog } from '../common/TableActionDialog';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../lib/api-client';
import { formatCurrency } from '../../lib/format';

interface PropertyChargesProps {
  propertyId: string;
  isOwner: boolean;
}

interface CustomCharge {
  id: string;
  name: string;
  amount: number;
  chargedToTenant: boolean;
  isActive: boolean;
}

export function PropertyChargesTable({ propertyId, isOwner }: PropertyChargesProps) {
  const [charges, setCharges] = useState<CustomCharge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [isSavingCharge, setIsSavingCharge] = useState(false);
  const [chargeToDelete, setChargeToDelete] = useState<CustomCharge | null>(null);

  // Form state
  const [chargeForm, setChargeForm] = useState({
    name: '',
    amount: 0,
    chargedToTenant: true,
    isActive: true,
  });

  const { toast } = useToast();

  const openAddModal = () => {
    setEditingChargeId(null);
    setChargeForm({ name: '', amount: 0, chargedToTenant: true, isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (charge: CustomCharge) => {
    setEditingChargeId(charge.id);
    setChargeForm({ name: charge.name, amount: charge.amount, chargedToTenant: charge.chargedToTenant, isActive: charge.isActive });
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchCharges();
  }, [propertyId]);

  const fetchCharges = async () => {
    setIsLoading(true);
    const { data } = await apiClient.get<CustomCharge[]>(`/properties/${propertyId}/charges`);
    if (data) {
      setCharges(data);
    }
    setIsLoading(false);
  };

  const handleSaveCharge = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chargeForm.name.trim() || chargeForm.amount <= 0) return;

    setIsSavingCharge(true);
    if (editingChargeId) {
      const { data, error } = await apiClient.patch<CustomCharge>(`/properties/charges/${editingChargeId}`, chargeForm);
      setIsSavingCharge(false);
      if (error) {
        toast({ variant: "destructive", title: "Error editing charge", description: error.message });
        return;
      }
      toast({ title: "Charge Updated", description: `${data?.name} has been updated.` });
    } else {
      const { data, error } = await apiClient.post<CustomCharge>(`/properties/${propertyId}/charges`, chargeForm);
      setIsSavingCharge(false);
      if (error) {
        toast({ variant: "destructive", title: "Error adding charge", description: error.message });
        return;
      }
      toast({ title: "Charge Added!", description: `${data?.name} has been added to the property.` });
    }

    setIsModalOpen(false);
    fetchCharges();
  };

  const toggleChargeStatus = async (charge: CustomCharge) => {
    const { error } = await apiClient.patch(`/properties/charges/${charge.id}`, { isActive: !charge.isActive });
    if (error) {
      toast({ variant: "destructive", title: "Error updating charge", description: error.message });
    } else {
      setCharges(charges.map(c => c.id === charge.id ? { ...c, isActive: !c.isActive } : c));
      toast({ title: "Status Updated", description: `${charge.name} is now ${!charge.isActive ? 'active' : 'inactive'}.` });
    }
  };

  const requestDeleteCharge = (charge: CustomCharge) => {
    setChargeToDelete(charge);
  };

  const confirmDeleteCharge = async () => {
    if (!chargeToDelete) return;
    
    const { error } = await apiClient.delete(`/properties/charges/${chargeToDelete.id}`);
    if (error) {
      toast({ variant: "destructive", title: "Error deleting charge", description: error.message });
    } else {
      setCharges(charges.filter(c => c.id !== chargeToDelete.id));
      toast({ title: "Charge Deleted", description: `${chargeToDelete.name} has been removed.` });
    }
    setChargeToDelete(null);
  };

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Recurring Charges</h3>
        {isOwner && (
          <TableActionDialog
            open={isModalOpen}
            onOpenChange={(open) => {
              if (open && !editingChargeId) openAddModal();
              else setIsModalOpen(open);
            }}
            triggerLabel="Add New Charge"
            title={editingChargeId ? "Edit Custom Charge" : "Add Custom Charge"}
            description={editingChargeId ? "Modify an existing recurring charge." : "Add a recurring monthly charge like maintenance, parking, or fixed utility fees."}
            onSubmit={handleSaveCharge}
            submitLabel={editingChargeId ? "Save Changes" : "Add Charge"}
            submittingLabel={editingChargeId ? "Saving..." : "Adding..."}
            isSubmitting={isSavingCharge}
            isSubmitDisabled={!chargeForm.name || chargeForm.amount <= 0}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Charge Name <span className="text-red-500">*</span></Label>
              <Input 
                id="name" 
                placeholder="e.g. Maintenance Fee" 
                required 
                maxLength={50}
                value={chargeForm.name}
                onChange={e => setChargeForm({ ...chargeForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹) <span className="text-red-500">*</span></Label>
              <Input 
                id="amount" 
                type="number" 
                step="0.01" 
                min="0" 
                max={999999}
                required 
                value={chargeForm.amount}
                onChange={e => setChargeForm({ ...chargeForm, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Charge to Tenant</Label>
                <p className="text-xs text-muted-foreground">If disabled, the owner pays this fee.</p>
              </div>
              <Switch 
                checked={chargeForm.chargedToTenant}
                onCheckedChange={checked => setChargeForm({ ...chargeForm, chargedToTenant: checked })}
              />
            </div>
          </TableActionDialog>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
        </div>
      ) : charges.length === 0 ? (
        <div className="px-6 py-10 text-center text-muted-foreground text-sm border-dashed border border-border rounded-lg m-6">
          No custom charges configured for this property.
          {isOwner && <p className="mt-1 text-xs">Add the first recurring charge above.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Charge Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Charged To</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Status</th>
                {isOwner && <th className="px-4 py-3 w-px" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {charges.map((charge, ri) => (
                <tr key={charge.id} className={`group transition-colors hover:bg-surface-raised/60 ${!charge.isActive ? 'opacity-50' : ''} ${ri % 2 === 1 ? 'bg-surface-raised/20' : ''}`}>
                  <td className="px-4 py-3 font-medium">{charge.name}</td>
                  <td className="px-4 py-3 text-right font-numbers">{formatCurrency(charge.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={charge.chargedToTenant ? 'tenant' : 'owner'}>
                      {charge.chargedToTenant ? 'Tenant' : 'Owner'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={charge.isActive ? 'active' : 'muted'}>
                      {charge.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(charge)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleChargeStatus(charge)}>
                          {charge.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => requestDeleteCharge(charge)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!chargeToDelete}
        onOpenChange={(open) => !open && setChargeToDelete(null)}
        title="Delete Charge"
        description={`Are you sure you want to delete "${chargeToDelete?.name}"? This will not affect existing bills.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteCharge}
      />
    </div>
  );
}
