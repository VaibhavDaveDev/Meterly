import React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

interface MeterInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: string;
  startValue: number;
  onChangeValue: (value: string) => void;
  color?: 'amber' | 'emerald' | 'blue';
  disabled?: boolean;
  error?: string;
}

export function MeterInput({ label, value, startValue, onChangeValue, color = 'amber', className, disabled, error, ...props }: MeterInputProps) {
  const numericVal = parseFloat(value);
  const delta = numericVal - startValue;
  const isInvalid = !isNaN(numericVal) && delta < 0;
  const isUnusuallyLarge = !isNaN(numericVal) && delta > 2000;
  const hasError = !!error || isInvalid;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-muted-foreground">
        {label} <span className="text-destructive">*</span>
      </label>
      <div className={cn(
        "relative rounded-md border-2 bg-[#0A0A0F] overflow-hidden flex items-center p-1",
        disabled ? "border-border/50 opacity-70" :
        hasError ? "border-destructive" : isUnusuallyLarge ? "border-amber-500" : "border-border focus-within:border-primary"
      )}>
        {/* Fake meter styling: boxes around digits */}
        <input
          type="number"
          step="0.01"
          min={0}
          max={999999}
          maxLength={10}
          required
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          className={cn(
            "w-full bg-transparent border-none text-right font-mono text-2xl tracking-[0.25em] outline-none py-2 px-4",
            color === 'amber' && "text-amber-500",
            color === 'emerald' && "text-emerald-500",
            color === 'blue' && "text-blue-500",
            disabled && "cursor-not-allowed"
          )}
          disabled={disabled}
          {...props}
        />
        <div className="absolute left-3 bottom-2 text-xs text-zinc-400 font-sans">
          Prev: {startValue.toFixed(2)}
        </div>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : isInvalid ? (
        <p className="text-xs text-destructive">Reading cannot be lower than the previous reading.</p>
      ) : null}
      {!hasError && isUnusuallyLarge && (
        <p className="text-xs text-amber-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          This reading is unusually high (+{delta.toFixed(2)} units). Please double-check.
        </p>
      )}
    </div>
  );
}
