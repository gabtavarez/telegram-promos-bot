import type { Deal } from "../types/Deal.js";

export function parseBrlPrice(value?: string | null): number | undefined {
  if (!value) return undefined;
  const raw = value.replace(/[^\d.,]/g, "");
  if (!raw) return undefined;

  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  const decimalSeparator = comma > dot ? "," : dot > comma ? "." : undefined;
  let normalized: string;
  if (decimalSeparator) {
    const decimalDigits = raw.length - Math.max(comma, dot) - 1;
    const isDecimal = decimalDigits === 1 || decimalDigits === 2;
    normalized = isDecimal
      ? raw.replace(/[.,]/g, (separator, offset) => offset === Math.max(comma, dot) ? "." : "")
      : raw.replace(/[.,]/g, "");
  } else {
    normalized = raw;
  }

  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 && price <= 10_000_000
    ? Math.round(price * 100) / 100
    : undefined;
}

export function calculateDiscount(current: number, previous?: number): number | undefined {
  if (!isValidPrice(current) || !isValidPrice(previous) || previous <= current) return undefined;
  if (previous / current > 5) return undefined;
  const discount = Math.round(((previous - current) / previous) * 100);
  return discount >= 1 && discount <= 80 ? discount : undefined;
}

export function getVerifiedDiscount(deal: Pick<Deal, "currentPrice" | "previousPrice">): number | undefined {
  return calculateDiscount(deal.currentPrice, deal.previousPrice);
}

/** Elimina percentuais soltos e condicoes de pagamento incoerentes. */
export function normalizeDealPricing(deal: Deal): Deal {
  const previousPrice = calculateDiscount(deal.currentPrice, deal.previousPrice)
    ? deal.previousPrice
    : undefined;
  const pixPrice = isValidPrice(deal.pixPrice) && deal.pixPrice === deal.currentPrice
    ? deal.pixPrice
    : undefined;
  const cardPrice = pixPrice && isValidPrice(deal.cardPrice) && deal.cardPrice >= pixPrice && deal.cardPrice <= pixPrice * 1.3
    ? deal.cardPrice
    : undefined;

  return {
    ...deal,
    pixPrice,
    cardPrice,
    previousPrice,
    discountPercentage: calculateDiscount(deal.currentPrice, previousPrice),
  };
}

function isValidPrice(value?: number): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= 10_000_000;
}
