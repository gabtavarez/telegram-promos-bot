export function parseBrlPrice(value?: string | null): number | undefined {
  if (!value) return undefined;

  const normalized = value
    .replace(/[^\d,.]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

export function calculateDiscount(current: number, previous?: number): number | undefined {
  if (!previous || previous <= current) return undefined;
  return Math.round(((previous - current) / previous) * 100);
}
