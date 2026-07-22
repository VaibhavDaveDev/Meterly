export interface ReadingValidation {
  valid: boolean;
  error?: string;   // hard error, block submit
  warning?: string; // soft warning, allow submit
  sanitized?: number; // cleaned value to use
}

export function validateReading(
  input: string | number,
  previousReading: number,
  label: string = 'Reading',
  allowRollover: boolean = false
): ReadingValidation {
  // Step 1: string cleanup
  const raw = String(input).trim();

  // Reject if contains letters or special characters (excluding comma, period)
  if (/[a-zA-Z!@#$%^&*()=[\]{}|\\;:'"<>?/]/.test(raw)) {
    return { valid: false, error: `${label} contains non-numeric characters. Please enter a number only.` };
  }

  // Remove commas (1,000 → 1000) and leading zeros
  const cleaned = raw.replace(/,/g, '');
  const value = parseFloat(cleaned);

  if (!isFinite(value) || isNaN(value)) {
    return { valid: false, error: `${label} must be a valid number.` };
  }

  if (value < 0) {
    return { valid: false, error: `${label} cannot be negative.` };
  }

  if (!allowRollover && value < previousReading) {
    return {
      valid: false,
      error: `${label} (${value.toLocaleString()}) is lower than the previous reading (${previousReading.toLocaleString()}). Meter readings can only increase.`,
    };
  }

  // Calculate delta. If rollover is allowed and value < previousReading, assume a standard 99999 rollover 
  // (the actual UI would pass the configured meterMaxReading to calculate true delta, but for basic warning 
  // we just assume a generic rollover for the warning).
  let delta = value - previousReading;
  if (allowRollover && value < previousReading) {
    // 99999 is standard 5 digit meter. If it rolls over, delta = (99999 - prev) + value + 1 (since 99999 -> 00000)
    delta = (99999 - previousReading) + value + 1;
  }

  let warning: string | undefined;

  if (delta > 99999) {
    warning = `${label} shows an increase of ${delta.toLocaleString()} units — unusually high. Please double-check.`;
  }

  if (value !== Math.round(value)) {
    warning = warning ?? `${label} appears to have a decimal (${value}). Most meters read whole units. Did you mean ${Math.round(value)}?`;
  }

  return { valid: true, sanitized: value, warning };
}
