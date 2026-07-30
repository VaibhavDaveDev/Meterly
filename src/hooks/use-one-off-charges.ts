import { useState } from "react";

export interface OneOffCharge {
  name: string;
  amount: number;
  chargedToTenant: boolean;
}

export function useOneOffCharges(initialCharges: OneOffCharge[] = []) {
  const [oneOffCharges, setOneOffCharges] =
    useState<OneOffCharge[]>(initialCharges);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState("");
  const [newChargeToTenant, setNewChargeToTenant] = useState(true);

  const handleAddCharge = () => {
    if (!newChargeName || !newChargeAmount) return;
    setOneOffCharges([
      ...oneOffCharges,
      {
        name: newChargeName,
        amount: parseFloat(newChargeAmount),
        chargedToTenant: newChargeToTenant,
      },
    ]);
    setNewChargeName("");
    setNewChargeAmount("");
    setNewChargeToTenant(true);
  };

  const handleRemoveCharge = (index: number) => {
    setOneOffCharges(oneOffCharges.filter((_, i) => i !== index));
  };

  return {
    oneOffCharges,
    setOneOffCharges,
    newChargeName,
    setNewChargeName,
    newChargeAmount,
    setNewChargeAmount,
    newChargeToTenant,
    setNewChargeToTenant,
    handleAddCharge,
    handleRemoveCharge,
  };
}
