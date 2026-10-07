import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { calculateDiscount } from "../utils/price.js";
import type { MercadoLivreOAuth } from "../services/MercadoLivreOAuth.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

interface HighlightEntry {
  id: string;
  type: "ITEM" | "PRODUCT" | "USER_PRODUCT";
}

interface HighlightResponse { content?: HighlightEntry[]; }

interface MercadoLivreItem {
  id?: string;
  title?: string;
  price?: number;
  original_price?: number;
  permalink?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  pictures?: Array<{ secure_url?: string; url?: string }>;
  available_quantity?: number;
  condition?: string;
  status?: string;
}

interface CatalogProduct { buy_box_winner?: { item_id?: string; id?: string }; }
interface UserProduct { user_id?: number; item_id?: string; items?: Array<{ id?: string }>; }
interface ItemSearchResponse { results?: string[]; }

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
    const request = { headers: { Authorization: `Bearer ${accessToken}` } };
    const ranked: HighlightEntry[] = [];
    const categoryFailures: string[] = [];

    for (const category of this.categoryIds) {
      try {
        const { data } = await this.client.get<HighlightResponse>(`/highlights/MLB/category/${category}`, request);
        ranked.push(...(data.content ?? []));
      } catch (error) {
        categoryFailures.push(`${category}: ${apiErrorMessage(error)}`);
      }
    }

    const unique = [...new Map(ranked.map((entry) => [`${entry.type}:${entry.id}`, entry])).values()];
    if (unique.length === 0) {
      throw new Error(`API de mais vendidos do Mercado Livre nao retornou produtos. ${categoryFailures.join(" | ")}`.trim());
    }

    const items = await mapWithConcurrency(unique, 5, async (entry) => {
      try {
        const itemId = await this.resolveItemId(entry, request);
        if (!itemId) return undefined;
        const { data } = await this.client.get<MercadoLivreItem>(`/items/${itemId}`, request);
        return data;
      } catch {
        return undefined;
      }
    });

    const deals = items.flatMap((item): Deal[] => item ? toDeal(item) : []);
    if (deals.length === 0) {
      throw new Error(
        `Mercado Livre retornou ${unique.length} produto(s) populares, mas nenhum detalhe publicavel pôde ser obtido.`,
      );
    }
    return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
  }

  private async resolveItemId(
    entry: HighlightEntry,
    request: { headers: { Authorization: string } },
  ): Promise<string | undefined> {
    if (entry.type === "ITEM") return entry.id;
    if (entry.type === "PRODUCT") {
      const { data } = await this.client.get<CatalogProduct>(`/products/${entry.id}`, request);
      return data.buy_box_winner?.item_id ?? data.buy_box_winner?.id;
    }

    const { data } = await this.client.get<UserProduct>(`/user-products/${entry.id}`, request);
    const direct = data.item_id ?? data.items?.find((item) => item.id)?.id;
    if (direct) return direct;
    if (!data.user_id) return undefined;
    const search = await this.client.get<ItemSearchResponse>(`/users/${data.user_id}/items/search`, {
      ...request,
      params: { user_product_id: entry.id, limit: 1 },
    });
    return search.data.results?.[0];
  }
}

function toDeal(item: MercadoLivreItem): Deal[] {
  const currentPrice = finitePositive(item.price);
  const previousPrice = finitePositive(item.original_price);
  const imageUrl = item.secure_thumbnail ?? item.thumbnail ?? item.pictures?.[0]?.secure_url ?? item.pictures?.[0]?.url;
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
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return [status ? `HTTP ${status}` : undefined, data?.message ?? data?.error ?? error.message].filter(Boolean).join(" - ");
  }
  return error instanceof Error ? error.message : String(error);
}

function finitePositive(value?: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
