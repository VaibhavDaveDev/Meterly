export function formatCurrency(
  amount: number | string | null | undefined
): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(num);
}

export function formatUnits(units: number | string | null | undefined): string {
  const num = Number(units) || 0;
  return `${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} units`;
}

export function formatMeterReading(
  reading: number | string | null | undefined
): string {
  const num = Number(reading) || 0;
  return Math.floor(num).toLocaleString("en-IN");
}

function parseDateInput(val: string | Date | null | undefined): {
  date: Date;
  isCalendarDate: boolean;
} {
  if (!val) return { date: new Date(NaN), isCalendarDate: false };
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = match[3] ? parseInt(match[3], 10) : 1;
      return {
        date: new Date(Date.UTC(year, month - 1, day)),
        isCalendarDate: true,
      };
    }
  }
  return { date: new Date(val), isCalendarDate: false };
}

export function formatMonth(dateString: string): string {
  if (!dateString) return "";
  const { date, isCalendarDate } = parseDateInput(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    ...(isCalendarDate ? { timeZone: "UTC" } : {}),
  });
}

export function formatSafeDate(val: string | Date | null | undefined): string {
  if (!val) return "Unknown Date";
  const { date, isCalendarDate } = parseDateInput(val);
  if (isNaN(date.getTime())) return "Unknown Date";
  return date.toLocaleDateString(
    "en-IN",
    isCalendarDate ? { timeZone: "UTC" } : undefined
  );
}

export function formatSafeDateTime(
  val: string | Date | null | undefined
): string {
  if (!val) return "Unknown Time";
  const { date, isCalendarDate } = parseDateInput(val);
  if (isNaN(date.getTime())) return "Unknown Time";
  return date.toLocaleString(
    "en-IN",
    isCalendarDate ? { timeZone: "UTC" } : undefined
  );
}
