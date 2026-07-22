export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount) || 0;
  return `₹${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatUnits(units: number | string | null | undefined): string {
  const num = Number(units) || 0;
  return `${num.toFixed(2)} units`;
}

export function formatMeterReading(reading: number | string | null | undefined): string {
  const num = Number(reading) || 0;
  return Math.floor(num).toLocaleString('en-IN');
}

export function formatMonth(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
