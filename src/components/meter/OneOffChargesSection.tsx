import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

export interface OneOffCharge {
  name: string;
  amount: number;
  chargedToTenant: boolean;
}

interface OneOffChargesSectionProps {
  charges: OneOffCharge[];
  onChange: (charges: OneOffCharge[]) => void;
}

// Shared one-off custom charges input list
export function OneOffChargesSection({
  charges,
  onChange,
}: OneOffChargesSectionProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [chargedToTenant, setChargedToTenant] = useState(true);

  const handleAdd = () => {
    if (!name.trim() || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    onChange([...charges, { name: name.trim(), amount: amt, chargedToTenant }]);
    setName("");
    setAmount("");
    setChargedToTenant(true);
  };

  const handleRemove = (index: number) => {
    onChange(charges.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2 max-w-lg">
      {charges.map((c, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-muted/50 p-2 rounded-md border text-sm"
        >
          <div className="flex flex-col">
            <span>{c.name}</span>
            <span className="text-xs text-muted-foreground">
              {c.chargedToTenant ? "Charged to Tenant" : "Paid by Owner"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono">₹{c.amount}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-500"
              onClick={() => handleRemove(i)}
            >
              ×
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2 items-end mt-2">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Charge name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="w-24 space-y-1">
          <Input
            type="number"
            placeholder="Amt"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <Label
          className="text-xs text-muted-foreground cursor-pointer"
          htmlFor="charge-tenant-switch"
        >
          Charge to Tenant
        </Label>
        <div className="flex items-center gap-3">
          <Switch
            id="charge-tenant-switch"
            checked={chargedToTenant}
            onCheckedChange={setChargedToTenant}
            className="scale-75"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs px-3"
            onClick={handleAdd}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
