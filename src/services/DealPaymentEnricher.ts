import type { Deal } from "../types/Deal.js";
import { extractPaymentDetails } from "../utils/payment.js";
import { calculateDiscount, normalizeDealPricing } from "../utils/price.js";
import { fetchDealPage } from "./DealAvailabilityChecker.js";

/** Atualiza apenas o finalista, evitando uma requisicao extra para cada item do catalogo. */
export async function enrichDealPayment(deal: Deal): Promise<Deal> {
  if (deal.provider !== "shopee") return deal;

  try {
    const page = decodePageText(await fetchDealPage(deal.originalUrl));
    const payment = extractPaymentDetails(page);
    if (!isPlausiblePixPrice(payment.pixPrice, deal.currentPrice)) return deal;

    return normalizeDealPricing({
      ...deal,
      currentPrice: payment.pixPrice!,
      pixPrice: payment.pixPrice,
      cardPrice: deal.currentPrice,
      installmentText: payment.installmentText,
      discountPercentage: calculateDiscount(payment.pixPrice!, deal.previousPrice),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Nao foi possivel confirmar o preco Pix de "${deal.title}": ${message}`);
    return deal;
  }
}

function isPlausiblePixPrice(pixPrice: number | undefined, referencePrice: number): boolean {
  return pixPrice !== undefined && pixPrice <= referencePrice && pixPrice >= referencePrice * 0.7;
}

function decodePageText(page: string): string {
  return page
    .replace(/\\u0024/gi, "$")
    .replace(/\\u00a0/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&");
}
