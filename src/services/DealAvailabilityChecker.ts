import axios from "axios";
import type { Deal } from "../types/Deal.js";
import { http } from "../utils/http.js";

const PAGE_CACHE_TTL_MS = 60_000;
const pageCache = new Map<string, { page: string; expiresAt: number }>();

const OUT_OF_STOCK_MARKERS = [
  /produto\s+esgotado/i,
  /produto\s+indispon[ií]vel/i,
  /temporariamente\s+indispon[ií]vel/i,
  /avise-me\s+quando\s+chegar/i,
  /(?:produto\s+)?sem\s+estoque/i,
  /out\s+of\s+stock/i,
  /sold\s+out/i,
  /an[uú]ncio\s+finalizado/i,
  /produto\s+n[aã]o\s+dispon[ií]vel/i,
  /schema\.org\/OutOfStock/i,
  /["']availability["']\s*:\s*["'][^"']*OutOfStock/i,
];
const PURCHASE_MARKERS = [
  /comprar\s+agora/i,
  /adicionar\s+ao\s+carrinho/i,
  /buy\s+now/i,
  /add\s+to\s+cart/i,
  /schema\.org\/InStock/i,
  /["']availability["']\s*:\s*["'][^"']*InStock/i,
];

export async function isDealAvailable(deal: Deal): Promise<boolean> {
  const result = await checkDealAvailability(deal);
  return result !== "unavailable" && !(result === "unknown" && deal.provider === "kabum");
}

export type DealAvailability = "available" | "unavailable" | "unknown";

export async function checkDealAvailability(deal: Deal): Promise<DealAvailability> {

  try {
    const page = await fetchDealPage(deal.originalUrl);
    const unavailable = OUT_OF_STOCK_MARKERS.some((marker) => marker.test(page));
    const purchasable = PURCHASE_MARKERS.some((marker) => marker.test(page));

    if (unavailable) {
      console.log(`Oferta ignorada por falta de estoque: ${deal.title}`);
      return "unavailable";
    }

    return purchasable ? "available" : "unknown";
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 410)) {
      console.log(`Oferta ignorada porque a pagina nao existe mais: ${deal.title}`);
      return "unavailable";
    }

    const message = error instanceof Error ? error.message : String(error);
    if (deal.provider === "kabum") {
      console.warn(`Nao foi possivel confirmar o estoque de "${deal.title}": ${message}`);
    }
    return "unknown";
  }
}

export async function fetchDealPage(url: string): Promise<string> {
  const useCache = process.env.NODE_ENV !== "test";
  const cached = useCache ? pageCache.get(url) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.page;

  const response = await http.get<string>(url);
  const page = typeof response.data === "string" ? response.data : String(response.data);
  if (useCache) pageCache.set(url, { page, expiresAt: Date.now() + PAGE_CACHE_TTL_MS });
  return page;
}
