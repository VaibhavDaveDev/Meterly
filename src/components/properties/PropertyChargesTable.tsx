import { useState, type SubmitEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { TableActionDialog } from "../common/TableActionDialog";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { useToast } from "../../hooks/use-toast";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { formatCurrency } from "../../lib/format";

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

export function PropertyChargesTable({
  propertyId,
  isOwner,
}: PropertyChargesProps) {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [chargeToDelete, setChargeToDelete] = useState<CustomCharge | null>(
    null
  );

  // Form state
  const [chargeForm, setChargeForm] = useState({
    name: "",
    amount: 0,
    chargedToTenant: true,
    isActive: true,
  });

  const { toast } = useToast();

  const {
    data: charges = [],
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.propertyCharges(propertyId),
    queryFn: async () => {
      const r = await apiClient.get<CustomCharge[]>(
        `/properties/${propertyId}/charges`
      );
      if (r.error) {
        throw new Error(r.error.message || "Failed to load custom charges");
      }
      return r.data ?? [];
    },
  });

  const invalidateCharges = () =>
    qc.invalidateQueries({ queryKey: queryKeys.propertyCharges(propertyId) });

  const saveChargeMutation = useMutation({
    mutationFn: async ({
      id,
      form,
    }: {
      id?: string | null;
      form: typeof chargeForm;
    }) => {
      if (id) {
        const { data, error } = await apiClient.patch<CustomCharge>(
          `/properties/charges/${id}`,
          form
        );
        if (error) throw new Error(error.message);
        return { data, isEdit: true };
      } else {
        const { data, error } = await apiClient.post<CustomCharge>(
          `/properties/${propertyId}/charges`,
          form
        );
        if (error) throw new Error(error.message);
        return { data, isEdit: false };
      }
    },
    onSuccess: ({ data, isEdit }) => {
      setIsModalOpen(false);
      invalidateCharges();
      if (isEdit) {
        toast({
          title: "Charge Updated",
          description: `${data?.name} has been updated.`,
        });
      } else {
        toast({
          title: "Charge Added!",
          description: `${data?.name} has been added to the property.`,
        });
      }
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error saving charge",
        description: err.message,
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (charge: CustomCharge) => {
      const { error } = await apiClient.patch(
        `/properties/charges/${charge.id}`,
        { isActive: !charge.isActive }
      );
      if (error) throw new Error(error.message);
      return charge;
    },
    onMutate: async (charge) => {
      await qc.cancelQueries({
        queryKey: queryKeys.propertyCharges(propertyId),
      });
      const prev = qc.getQueryData<CustomCharge[]>(
        queryKeys.propertyCharges(propertyId)
      );
      qc.setQueryData<CustomCharge[]>(
        queryKeys.propertyCharges(propertyId),
        (old) =>
          old?.map((c) =>
            c.id === charge.id ? { ...c, isActive: !c.isActive } : c
          )
      );
      return { prev };
    },
    onError: (err: Error, _charge, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.propertyCharges(propertyId), ctx.prev);
      }
      toast({
        variant: "destructive",
        title: "Error updating charge",
        description: err.message,
      });
    },
    onSuccess: (charge) => {
      toast({
        title: "Status Updated",
        description: `${charge.name} is now ${
          !charge.isActive ? "active" : "inactive"
        }.`,
      });
    },
    onSettled: () => {
      invalidateCharges();
    },
  });

  const deleteChargeMutation = useMutation({
    mutationFn: async (charge: CustomCharge) => {
      const { error } = await apiClient.delete(
        `/properties/charges/${charge.id}`
      );
      if (error) throw new Error(error.message);
      return charge;
    },
    onSuccess: (charge) => {
      setChargeToDelete(null);
      invalidateCharges();
      toast({
        title: "Charge Deleted",
        description: `${charge.name} has been removed.`,
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error deleting charge",
        description: err.message,
      });
    },
  });

  const openAddModal = () => {
    setEditingChargeId(null);
    setChargeForm({
      name: "",
      amount: 0,
      chargedToTenant: true,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (charge: CustomCharge) => {
    setEditingChargeId(charge.id);
    setChargeForm({
      name: charge.name,
      amount: charge.amount,
      chargedToTenant: charge.chargedToTenant,
      isActive: charge.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSaveCharge = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chargeForm.name.trim() || chargeForm.amount <= 0) return;
    saveChargeMutation.mutate({ id: editingChargeId, form: chargeForm });
  };

  const toggleChargeStatus = (charge: CustomCharge) => {
    toggleStatusMutation.mutate(charge);
  };

  const requestDeleteCharge = (charge: CustomCharge) => {
    setChargeToDelete(charge);
  };

  const confirmDeleteCharge = () => {
    if (!chargeToDelete) return;
    deleteChargeMutation.mutate(chargeToDelete);
  };

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">
          Recurring Charges
        </h3>
        {isOwner && (
          <TableActionDialog
            open={isModalOpen}
            onOpenChange={(open) => {
              if (open && !editingChargeId) openAddModal();
              else setIsModalOpen(open);
            }}
            triggerLabel="Add New Charge"
            title={editingChargeId ? "Edit Custom Charge" : "Add Custom Charge"}
            description={
              editingChargeId
                ? "Modify an existing recurring charge."
                : "Add a recurring monthly charge like maintenance, parking, or fixed utility fees."
            }
            onSubmit={handleSaveCharge}
            submitLabel={editingChargeId ? "Save Changes" : "Add Charge"}
            submittingLabel={editingChargeId ? "Saving..." : "Adding..."}
            isSubmitting={saveChargeMutation.isPending}
            isSubmitDisabled={!chargeForm.name || chargeForm.amount <= 0}
          >
            <div className="space-y-2">
              <Label htmlFor="name">
                Charge Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Maintenance Fee"
                required
                maxLength={50}
                value={chargeForm.name}
                onChange={(e) =>
                  setChargeForm({ ...chargeForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount (₹) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={999999}
                required
                value={chargeForm.amount}
                onChange={(e) =>
                  setChargeForm({
                    ...chargeForm,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Charge to Tenant</Label>
                <p className="text-xs text-muted-foreground">
                  If disabled, the owner pays this fee.
                </p>
              </div>
              <Switch
                checked={chargeForm.chargedToTenant}
                onCheckedChange={(checked) =>
                  setChargeForm({ ...chargeForm, chargedToTenant: checked })
                }
              />
            </div>
          </TableActionDialog>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 text-center text-destructive">
          <p className="font-medium text-sm">Failed to load charges</p>
          <p className="text-xs text-muted-foreground mt-1">
            {queryError instanceof Error
              ? queryError.message
              : "An unexpected error occurred"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-xs text-primary underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : charges.length === 0 ? (
        <div className="px-6 py-10 text-center text-muted-foreground text-sm border-dashed border border-border rounded-lg m-6">
          No custom charges configured for this property.
          {isOwner && (
            <p className="mt-1 text-xs">
              Add the first recurring charge above.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Charge Name
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  Amount
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  Charged To
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  Status
                </th>
                {isOwner && (
                  <th className="px-4 py-3 w-px" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {charges.map((charge, ri) => (
                <tr
                  key={charge.id}
                  className={`group transition-colors hover:bg-surface-raised/60 ${!charge.isActive ? "opacity-50" : ""} ${ri % 2 === 1 ? "bg-surface-raised/20" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">{charge.name}</td>
                  <td className="px-4 py-3 text-right font-numbers">
                    {formatCurrency(charge.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={charge.chargedToTenant ? "tenant" : "owner"}
                    >
                      {charge.chargedToTenant ? "Tenant" : "Owner"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={charge.isActive ? "active" : "muted"}>
                      {charge.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(charge)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleChargeStatus(charge)}
                        >
                          {charge.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => requestDeleteCharge(charge)}
                        >
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
