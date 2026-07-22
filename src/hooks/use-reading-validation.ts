import { validateReading } from '../lib/validate-reading';

function processFieldValidation(
  endValue: string,
  startValue: number,
  label: string,
  allowRollover: boolean,
  errors: string[]
): { hasHardError: boolean; hasWarning: boolean } {
  const result = validateReading(endValue, startValue, label, allowRollover);
  let hasHardError = false;

  if (!result.valid && endValue.trim() !== '') {
    hasHardError = !!result.error;
    if (result.error) errors.push(result.error);
  } else if (!result.valid) {
    hasHardError = true;
  }

  return { hasHardError, hasWarning: !!result.warning };
}

interface ValidationParams {
  isSolar: boolean;
  importEnd: string;
  exportEnd: string;
  solarGenerationEnd: string;
  startValues: {
    importStart: number;
    exportStart: number;
    solarGenerationStart: number;
  };
  allowRollover: boolean;
  acknowledgedWarning: boolean;
  existingReading: boolean;
  canEdit: boolean;
  reason: string;
}

export function useReadingValidation({
  isSolar,
  importEnd,
  exportEnd,
  solarGenerationEnd,
  startValues,
  allowRollover,
  acknowledgedWarning,
  existingReading,
  canEdit,
  reason
}: ValidationParams) {
  let hasHardError = false;
  let hasWarning = false;
  const validationErrors: string[] = [];

  const updateState = (res: { hasHardError: boolean; hasWarning: boolean }) => {
    if (res.hasHardError) hasHardError = true;
    if (res.hasWarning) hasWarning = true;
  };

  updateState(processFieldValidation(importEnd, startValues.importStart, 'Import from Grid', allowRollover, validationErrors));

  if (isSolar) {
    updateState(processFieldValidation(solarGenerationEnd, startValues.solarGenerationStart, 'Solar Generation', allowRollover, validationErrors));
    updateState(processFieldValidation(exportEnd, startValues.exportStart, 'Export to Grid', allowRollover, validationErrors));
  }

  const numericSolar = parseFloat(solarGenerationEnd);
  const numericExport = parseFloat(exportEnd);
  const numericImport = parseFloat(importEnd);

  const canSave = !hasHardError && 
    (isSolar ? (!isNaN(numericSolar) && !isNaN(numericExport)) : true) && 
    !isNaN(numericImport) &&
    (hasWarning ? acknowledgedWarning : true) &&
    (existingReading && canEdit ? reason.length >= 10 : true);

  return {
    hasHardError,
    hasWarning,
    validationErrors,
    canSave,
    numericSolar,
    numericExport,
    numericImport
  };
}
