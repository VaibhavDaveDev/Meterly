import type { Property } from '../../types/db';

export type ActiveBillingPeriod = {
  id: string;
  propertyId: string;
  periodMonth: string;
  calculationMode: 'solar' | 'grid_only';
  status: 'draft' | 'pending_approval' | 'submitted' | 'confirmed';
  bills?: Array<{
    billId: string;
    tenantName: string;
    amount: number;
    status: 'pending' | 'paid';
    isSelf: boolean;
  }>;
};

export interface PropertyDetailState {
  property: Property;
  localProperty: Property;
  isOwner: boolean;
  activePeriod: ActiveBillingPeriod | null;
  isPeriodModalOpen: boolean;
  setIsPeriodModalOpen: (open: boolean) => void;
  periodMonth: string;
  setPeriodMonth: (month: string) => void;
  isStartingPeriod: boolean;
  handleStartPeriod: (e: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;

  tenantCount: number;
  isLoadingBills: boolean;
  chartData: { name: string; total: number; isModeChange?: boolean }[];
  modeChangeLabel: string | null;
}
