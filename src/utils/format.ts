/** 1250 -> "12,50 €" */
export function formatPrice(cents: number, currency = '€'): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimals = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${units},${decimals} ${currency}`;
}

/** "12,5" / "12.50" / "12" -> centimes, ou null si invalide. */
export function parsePrice(input: string): number | null {
  const clean = input.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  if (!clean || !/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** Centimes -> texte éditable "12,50". */
export function priceToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${(minutes % 60).toString().padStart(2, '0')}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}
