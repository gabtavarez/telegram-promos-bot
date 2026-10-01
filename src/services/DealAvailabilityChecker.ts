import axios from "axios";
import type { Deal } from "../types/Deal.js";
import { http } from "../utils/http.js";

const OUT_OF_STOCK_MARKERS = [
  /produto\s+esgotado/i,
  /produto\s+indispon[ií]vel/i,
  /temporariamente\s+indispon[ií]vel/i,
  /avise-me\s+quando\s+chegar/i,
  /schema\.org\/OutOfStock/i,
  /["']availability["']\s*:\s*["'][^"']*OutOfStock/i,
];

export async function isDealAvailable(deal: Deal): Promise<boolean> {
  if (deal.provider !== "kabum") return true;

  try {
    const response = await http.get<string>(deal.originalUrl);
    const page = typeof response.data === "string" ? response.data : String(response.data);
    const unavailable = OUT_OF_STOCK_MARKERS.some((marker) => marker.test(page));

    if (unavailable) {
      console.log(`Oferta ignorada por falta de estoque: ${deal.title}`);
      return false;
    }

    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 410)) {
      console.log(`Oferta ignorada porque a pagina nao existe mais: ${deal.title}`);
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Nao foi possivel confirmar o estoque da Kabum para "${deal.title}": ${message}`);
    return false;
  }
}
