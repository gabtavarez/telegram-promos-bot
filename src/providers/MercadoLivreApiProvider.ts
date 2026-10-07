import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { calculateDiscount } from "../utils/price.js";
import type { MercadoLivreOAuth } from "../services/MercadoLivreOAuth.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

interface MercadoLivreSearchItem {
  id?: string;
  title?: string;
  price?: number;
  original_price?: number;
  permalink?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  available_quantity?: number;
  condition?: string;
  status?: string;
}

interface MercadoLivreSearchResponse {
  results?: MercadoLivreSearchItem[];
}

export class MercadoLivreApiProvider implements AffiliateProvider {
  readonly name = "Mercado Livre";
  private readonly client: AxiosInstance;

  constructor(
    private readonly oauth: MercadoLivreOAuth,
    private readonly categoryIds: string[],
  ) {
    this.client = axios.create({ baseURL: "https://api.mercadolibre.com", timeout: 15_000 });
  }

  async getDeals(): Promise<Deal[]> {
    const accessToken = await this.oauth.getAccessToken();
    const results: MercadoLivreSearchItem[] = [];
    for (const category of this.categoryIds) {
      const { data } = await this.client.get<MercadoLivreSearchResponse>("/sites/MLB/search", {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { category, limit: 50 },
      });
      results.push(...(data.results ?? []));
    }

    if (results.length === 0) {
      throw new Error("API do Mercado Livre respondeu sem produtos para as categorias configuradas.");
    }

    const deals = results.flatMap((item): Deal[] => {
      const currentPrice = finitePositive(item.price);
      const previousPrice = finitePositive(item.original_price);
      const imageUrl = item.secure_thumbnail ?? item.thumbnail;
      if (!item.id || !item.title || !item.permalink || !imageUrl || !currentPrice) return [];
      if (item.condition && item.condition !== "new") return [];
      if (item.status && item.status !== "active") return [];
      if (item.available_quantity !== undefined && item.available_quantity <= 0) return [];
      if (!isPcHardwareDeal(item.title)) return [];
      return [{
        id: `mercado-livre:${item.id.replace("-", "")}`,
        provider: "mercado-livre",
        title: item.title,
        originalUrl: item.permalink,
        imageUrl: imageUrl.replace(/^http:/, "https:"),
        currentPrice,
        previousPrice: previousPrice && previousPrice > currentPrice ? previousPrice : undefined,
        discountPercentage: calculateDiscount(currentPrice, previousPrice),
      }];
    });
    return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
  }
}

function finitePositive(value?: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
