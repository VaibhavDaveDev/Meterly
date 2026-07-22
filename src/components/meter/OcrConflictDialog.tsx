import { useState } from 'react';

export type OcrProposal = {
  field: 'importEnd' | 'exportEnd' | 'solarGenerationEnd';
  label: string;
  ocrValue: number;
  currentValue: number | undefined;
};

interface OcrConflictDialogProps {
  proposals: OcrProposal[];
  onResolve: (resolutions: Record<string, 'keep_mine' | 'use_ocr'>) => void;
}

export function OcrConflictDialog({ proposals, onResolve }: OcrConflictDialogProps) {
  const [resolutions, setResolutions] = useState<Record<string, 'keep_mine' | 'use_ocr'>>(
    Object.fromEntries(proposals.map(p => [p.field, 'keep_mine']))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-base font-semibold font-heading mb-1">OCR found different figures</h2>
        <p className="text-sm text-muted-foreground mb-3">
          The uploaded document shows values that differ from what you typed.
          Choose which to keep for each reading.
        </p>
        <p className="text-xs text-amber-600/80 mb-5">
          Note: OCR can misread digits, especially on LCD meter displays.
          Common mistakes: 3/8, 0/8, 1/7. Always check against the physical meter.
        </p>
        <div className="space-y-4">
          {proposals.map(p => (
            <div key={p.field} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium mb-3">{p.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolutions(r => ({ ...r, [p.field]: 'keep_mine' }))}
                  className={`rounded-lg border p-3 text-sm transition-colors ${
                    resolutions[p.field] === 'keep_mine'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:border-accent/50'
                  }`}
                >
                  <span className="block font-numbers font-bold text-base">{p.currentValue}</span>
                  <span className="block text-xs mt-0.5">Keep my input</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResolutions(r => ({ ...r, [p.field]: 'use_ocr' }))}
                  className={`rounded-lg border p-3 text-sm transition-colors ${
                    resolutions[p.field] === 'use_ocr'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-border text-muted-foreground hover:border-emerald-500/50'
                  }`}
                >
                  <span className="block font-numbers font-bold text-base">{p.ocrValue}</span>
                  <span className="block text-xs mt-0.5">Use OCR value</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onResolve(resolutions)}
          className="btn btn-primary w-full mt-5"
        >
          Apply Selections
        </button>
      </div>
    </div>
  );
}
