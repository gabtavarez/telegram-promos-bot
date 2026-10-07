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

interface CatalogProduct {
  id?: string;
  status?: string;
  name?: string;
  permalink?: string;
  pictures?: Array<{ secure_url?: string; url?: string }>;
  buy_box_winner?: {
    item_id?: string;
    id?: string;
    price?: number;
    original_price?: number;
    available_quantity?: number;
    condition?: string;
  };
}
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

    const resolutionFailures = new Map<string, number>();
    const items = await mapWithConcurrency(unique, 5, async (entry) => {
      try {
        return await this.resolveEntry(entry, request);
      } catch (error) {
        const reason = `${entry.type} ${apiErrorMessage(error)}`;
        resolutionFailures.set(reason, (resolutionFailures.get(reason) ?? 0) + 1);
        return undefined;
      }
    });

    const deals = items.flatMap((item): Deal[] => item ? toDeal(item) : []);
    if (deals.length === 0) {
      throw new Error(
        `Mercado Livre retornou ${unique.length} produto(s) populares, mas nenhum detalhe publicavel pôde ser obtido. ` +
        formatFailureSummary(resolutionFailures),
      );
    }
    return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
  }

  private async resolveEntry(
    entry: HighlightEntry,
    request: { headers: { Authorization: string } },
  ): Promise<MercadoLivreItem | undefined> {
    if (entry.type === "ITEM") {
      const { data } = await this.client.get<MercadoLivreItem>(`/items/${entry.id}`, request);
      return data;
    }
    if (entry.type === "PRODUCT") {
      const { data } = await this.client.get<CatalogProduct>(`/products/${entry.id}`, request);
      const winner = data.buy_box_winner;
      const image = data.pictures?.[0];
      if (!winner) return undefined;
      return {
        id: winner.item_id ?? winner.id ?? data.id,
        title: data.name,
        price: winner.price,
        original_price: winner.original_price,
        permalink: data.permalink,
        secure_thumbnail: image?.secure_url ?? image?.url,
        available_quantity: winner.available_quantity,
        condition: winner.condition,
        status: data.status,
      };
    }

    const { data } = await this.client.get<UserProduct>(`/user-products/${entry.id}`, request);
    const direct = data.item_id ?? data.items?.find((item) => item.id)?.id;
    let itemId = direct;
    if (!itemId && data.user_id) {
      const search = await this.client.get<ItemSearchResponse>(`/users/${data.user_id}/items/search`, {
        ...request,
        params: { user_product_id: entry.id, limit: 1 },
      });
      itemId = search.data.results?.[0];
    }
    if (!itemId) return undefined;
    const item = await this.client.get<MercadoLivreItem>(`/items/${itemId}`, request);
    return item.data;
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

function formatFailureSummary(failures: Map<string, number>): string {
  if (failures.size === 0) return "Os produtos nao tinham oferta vencedora ou foram bloqueados pelo filtro.";
  return [...failures.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, count]) => `${count}x ${reason}`)
    .join(" | ");
}

function finitePositive(value?: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
