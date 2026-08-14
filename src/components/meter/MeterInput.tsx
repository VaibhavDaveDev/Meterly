import React, { useId } from "react";
import { cn } from "../../lib/utils";
import { AlertTriangle } from "lucide-react";

interface MeterInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: string;
  startValue: number;
  onChangeValue: (value: string) => void;
  color?: "amber" | "emerald" | "blue";
  disabled?: boolean;
  error?: string;
}

export function MeterInput({
  label,
  value,
  startValue,
  onChangeValue,
  color = "amber",
  className,
  disabled,
  error,
  id,
  ...props
}: MeterInputProps) {
  const numericVal = parseFloat(value);
  const delta = numericVal - startValue;
  const isInvalid = !isNaN(numericVal) && delta < 0;
  const isUnusuallyLarge = !isNaN(numericVal) && delta > 2000;
  const hasError = !!error || isInvalid;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-muted-foreground"
      >
        {label} <span className="text-destructive">*</span>
      </label>
      <div
        className={cn(
          "relative rounded-md border-2 bg-[#0A0A0F] overflow-hidden flex items-center p-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          disabled
            ? "border-border/50 opacity-70"
            : hasError
              ? "border-destructive"
              : isUnusuallyLarge
                ? "border-amber-500"
                : "border-border focus-within:border-primary"
        )}
      >
        {/* Fake meter styling: boxes around digits */}
        <input
          {...props}
          aria-invalid={hasError}
          aria-describedby={
            hasError || isUnusuallyLarge ? descriptionId : undefined
          }
          id={inputId}
          type="number"
          step="0.01"
          min={0}
          max={999999}
          maxLength={10}
          required
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          className={cn(
            "w-full bg-transparent border-none text-right font-mono text-2xl tracking-[0.25em] focus-visible:outline-none py-2 pl-4 pr-14",
            color === "amber" && "text-amber-500",
            color === "emerald" && "text-emerald-500",
            color === "blue" && "text-blue-500",
            disabled && "cursor-not-allowed"
          )}
          disabled={disabled}
        />
        <div className="absolute right-4 top-0 bottom-0 pointer-events-none flex items-center text-muted-foreground/30 font-mono text-xl">
          kWh
        </div>
        <div className="absolute left-3 bottom-2 text-xs text-zinc-400 font-sans">
          Prev: {startValue.toFixed(2)}
        </div>
      </div>
      {error ? (
        <p id={descriptionId} className="text-xs text-destructive">
          {error}
        </p>
      ) : isInvalid ? (
        <p id={descriptionId} className="text-xs text-destructive">
          Reading cannot be lower than the previous reading.
        </p>
      ) : null}
      {!hasError && isUnusuallyLarge && (
        <p
          id={descriptionId}
          className="text-xs text-amber-500 flex items-center gap-1"
        >
          <AlertTriangle className="w-3 h-3" />
          This reading is unusually high (+{delta.toFixed(2)} units). Please
          double-check.
        </p>
      )}
    </div>
  );
}
