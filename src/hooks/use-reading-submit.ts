import { useState, useEffect } from 'react';
import { useToast } from './use-toast';

interface ReadingPeriod {
  id: string;
  periodMonth: string;
  oneOffCharges?: string | null;
}

interface ReadingProperty {
  id: string;
  name: string;
  hasSolar: boolean;
  readingsRequireApproval?: boolean;
}

interface ReadingStartValues {
  solarGenerationStart: number;
  exportStart: number;
  importStart: number;
}

interface ReadingExisting {
  solarGenerationEnd: number;
  exportEnd: number;
  importEnd: number;
}

interface SubmitReadingData {
  period: ReadingPeriod & { status?: string };
  property: ReadingProperty;
  startValues: ReadingStartValues;
  currentRates?: { consumptionRate: number; exportRate: number; };
  activeTenancySplit?: number;
  canSubmit: boolean;
  canEdit: boolean;
  existingReading?: ReadingExisting;
  canRequestEdit?: boolean;
  tenancyId?: string;
  isOwner?: boolean;
  allPeriods?: { id: string; periodMonth: string; status: string }[];
}

export function useReadingSubmit(periodId: string) {
  const { toast } = useToast();
  
  const [data, setData] = useState<SubmitReadingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [solarGenerationEnd, setSolarGenerationEnd] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [importEnd, setImportEnd] = useState('');
  
  const [reason, setReason] = useState('');
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);

  const [oneOffCharges, setOneOffCharges] = useState<Array<{name: string, amount: number, chargedToTenant: boolean}>>([]);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [newChargeToTenant, setNewChargeToTenant] = useState(true);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(`/api/periods/${periodId}`);
        const json = await res.json() as { success: boolean; data: SubmitReadingData; error?: { message: string } };
        if (json.success) {
          setData(json.data);
          if (json.data.existingReading) {
            setSolarGenerationEnd(json.data.existingReading.solarGenerationEnd.toString());
            setExportEnd(json.data.existingReading.exportEnd.toString());
            setImportEnd(json.data.existingReading.importEnd.toString());
          }
          if (json.data.period.oneOffCharges) {
            try {
              setOneOffCharges(JSON.parse(json.data.period.oneOffCharges));
            } catch {
              // Ignore JSON parse errors for fallback
            }
          }
        } else {
          toast({ variant: 'destructive', title: 'Error', description: json.error?.message || 'Failed to load' });
        }
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'Network error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchContext();
  }, [periodId, toast]);

  return {
    data,
    isLoading,
    isSubmitting,
    setIsSubmitting,
    solarGenerationEnd,
    setSolarGenerationEnd,
    exportEnd,
    setExportEnd,
    importEnd,
    setImportEnd,
    reason,
    setReason,
    acknowledgedWarning,
    setAcknowledgedWarning,
    oneOffCharges,
    setOneOffCharges,
    newChargeName,
    setNewChargeName,
    newChargeAmount,
    setNewChargeAmount,
    newChargeToTenant,
    setNewChargeToTenant,
    toast,
  };
}
