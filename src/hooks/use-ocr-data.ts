import { useState } from 'react';
import { ExtractedData } from '../components/meter/BillPhotoUpload';
import { OcrProposal } from '../components/meter/OcrConflictDialog';

interface UseOcrDataProps {
  isSolar: boolean;
  importEnd: string;
  exportEnd: string;
  solarGenerationEnd: string;
  setImportEnd: (val: string) => void;
  setExportEnd: (val: string) => void;
  setSolarGenerationEnd: (val: string) => void;
}

export function useOcrData({
  isSolar,
  importEnd,
  exportEnd,
  solarGenerationEnd,
  setImportEnd,
  setExportEnd,
  setSolarGenerationEnd
}: UseOcrDataProps) {
  const [pendingProposals, setPendingProposals] = useState<OcrProposal[]>([]);
  const [hasOcrData, setHasOcrData] = useState(false);

  const handleOcrExtracted = (extractedData: ExtractedData) => {
    setHasOcrData(true);
    const proposals: OcrProposal[] = [];

    const checkAndPropose = (
      field: OcrProposal['field'],
      label: string,
      ocrValue: number | null | undefined,
      currentValueStr: string,
      setter: (v: string) => void
    ) => {
      if (ocrValue === null || ocrValue === undefined) return;
      
      const currentValNum = currentValueStr.trim() === '' ? undefined : parseFloat(currentValueStr);
      
      if (currentValNum !== undefined && currentValNum !== ocrValue) {
        proposals.push({
          field,
          label,
          ocrValue,
          currentValue: currentValNum
        });
      } else {
        setter(String(ocrValue));
      }
    };

    if (extractedData.type === 'pdf' && extractedData.pdfResult) {
      checkAndPropose('importEnd', 'Import Reading', extractedData.pdfResult.presentReadingImport, importEnd, setImportEnd);
      if (isSolar) {
        checkAndPropose('exportEnd', 'Export to Grid', extractedData.pdfResult.presentReadingExport, exportEnd, setExportEnd);
        checkAndPropose('solarGenerationEnd', 'Solar Generation', extractedData.pdfResult.presentReadingSolarGen, solarGenerationEnd, setSolarGenerationEnd);
      }
    } else if (extractedData.type === 'image' && extractedData.imageResult) {
      // Image extraction only gets one number, assume it's for import by default or based on active field
      checkAndPropose('importEnd', 'Import Reading', extractedData.imageResult.value, importEnd, setImportEnd);
    }

    if (proposals.length > 0) {
      setPendingProposals(proposals);
    }
  };

  const handleResolveConflicts = (resolutions: Record<string, 'keep_mine' | 'use_ocr'>) => {
    for (const proposal of pendingProposals) {
      if (resolutions[proposal.field] === 'use_ocr') {
        if (proposal.field === 'importEnd') setImportEnd(String(proposal.ocrValue));
        if (proposal.field === 'exportEnd') setExportEnd(String(proposal.ocrValue));
        if (proposal.field === 'solarGenerationEnd') setSolarGenerationEnd(String(proposal.ocrValue));
      }
    }
    setPendingProposals([]);
  };

  return {
    hasOcrData,
    pendingProposals,
    handleOcrExtracted,
    handleResolveConflicts
  };
}
