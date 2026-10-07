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
  pictures?: Array<{ id?: string; secure_url?: string; url?: string }>;
  pickers?: Array<{
    products?: Array<{ thumbnail?: string; tags?: string[] }>;
  }>;
  buy_box_winner?: {
    item_id?: string;
    id?: string;
    price?: number;
    original_price?: number;
    available_quantity?: number;
    condition?: string;
  };
}

interface DealConversion {
  deal?: Deal;
  rejection?: string;
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
    const supportedEntries = unique.filter((entry) => {
      if (entry.type !== "USER_PRODUCT") return true;
      incrementCount(resolutionFailures, "USER_PRODUCT privado ignorado");
      return false;
    });
    const items = await mapWithConcurrency(supportedEntries, 5, async (entry) => {
      try {
        return await this.resolveEntry(entry, request);
      } catch (error) {
        const reason = `${entry.type} ${apiErrorMessage(error)}`;
        resolutionFailures.set(reason, (resolutionFailures.get(reason) ?? 0) + 1);
        return undefined;
      }
    });

    const rejectionReasons = new Map<string, number>();
    const deals: Deal[] = [];
    for (const item of items) {
      if (!item) {
        incrementCount(rejectionReasons, "produto de catalogo sem oferta vencedora");
        continue;
      }
      const converted = toDeal(item);
      if (converted.deal) deals.push(converted.deal);
      else incrementCount(rejectionReasons, converted.rejection ?? "motivo desconhecido");
    }
    if (deals.length === 0) {
      throw new Error(
        `Mercado Livre retornou ${unique.length} produto(s) populares, mas nenhum detalhe publicavel pôde ser obtido. ` +
        formatFailureSummary(resolutionFailures, rejectionReasons),
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
      const imageUrl = getCatalogImage(data);
      if (winner) {
        return {
          id: winner.item_id ?? winner.id ?? data.id,
          title: data.name,
          price: winner.price,
          original_price: winner.original_price,
          permalink: data.permalink,
          secure_thumbnail: imageUrl,
          available_quantity: winner.available_quantity,
          condition: winner.condition,
          status: data.status,
        };
      }

      return this.resolvePublicItemFromProductRanking(entry.id, request);
    }

    return undefined;
  }

  private async resolvePublicItemFromProductRanking(
    productId: string,
    request: { headers: { Authorization: string } },
  ): Promise<MercadoLivreItem> {
    const { data } = await this.client.get<HighlightResponse>(`/highlights/MLB/product/${productId}`, request);
    const publicItems = (data.content ?? []).filter((candidate) => candidate.type === "ITEM");
    if (publicItems.length === 0) {
      throw new Error("sem oferta vencedora e sem ITEM publico no ranking do produto");
    }

    let lastError: unknown;
    for (const candidate of publicItems.slice(0, 3)) {
      try {
        const { data: item } = await this.client.get<MercadoLivreItem>(`/items/${candidate.id}`, request);
        return item;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("nenhum ITEM publico do produto pôde ser consultado");
  }
}

function toDeal(item: MercadoLivreItem): DealConversion {
  const currentPrice = finitePositive(item.price);
  const previousPrice = finitePositive(item.original_price);
  const imageUrl = item.secure_thumbnail ?? item.thumbnail ?? item.pictures?.[0]?.secure_url ?? item.pictures?.[0]?.url;
  const missing = [
    !item.id && "id",
    !item.title && "titulo",
    !item.permalink && "link",
    !imageUrl && "imagem",
    !currentPrice && "preco",
  ].filter(Boolean);
  if (missing.length) return { rejection: `dados incompletos (${missing.join(", ")})` };
  const id = item.id!;
  const title = item.title!;
  const permalink = item.permalink!;
  const publishableImageUrl = imageUrl!;
  const publishablePrice = currentPrice!;
  if (item.condition && item.condition !== "new") return { rejection: "produto nao novo" };
  if (item.status && item.status !== "active") return { rejection: "produto inativo" };
  if (item.available_quantity !== undefined && item.available_quantity <= 0) return { rejection: "sem estoque" };
  if (!isPcHardwareDeal(title)) return { rejection: "fora do filtro de qualidade" };
  return { deal: {
    id: `mercado-livre:${id.replace("-", "")}`,
    provider: "mercado-livre",
    title,
    originalUrl: permalink,
    imageUrl: publishableImageUrl.replace(/^http:/, "https:"),
    currentPrice: publishablePrice,
    previousPrice: previousPrice && previousPrice > publishablePrice ? previousPrice : undefined,
    discountPercentage: calculateDiscount(publishablePrice, previousPrice),
  } };
}

function getCatalogImage(product: CatalogProduct): string | undefined {
  const picture = product.pictures?.[0];
  const direct = picture?.secure_url ?? picture?.url;
  if (direct) return direct;

  const pickerProducts = product.pickers?.flatMap((picker) => picker.products ?? []) ?? [];
  const selected = pickerProducts.find((candidate) => candidate.tags?.includes("selected"));
  const thumbnail = selected?.thumbnail ?? pickerProducts.find((candidate) => candidate.thumbnail)?.thumbnail;
  if (thumbnail) return thumbnail;

  return picture?.id ? `https://http2.mlstatic.com/D_NQ_NP_${picture.id}-F.jpg` : undefined;
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

function formatFailureSummary(...groups: Array<Map<string, number>>): string {
  const failures = new Map<string, number>();
  for (const group of groups) {
    for (const [reason, count] of group) incrementCount(failures, reason, count);
  }
  if (failures.size === 0) return "Nenhum motivo de descarte foi informado.";
  return [...failures.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, count]) => `${count}x ${reason}`)
    .join(" | ");
}

function incrementCount(counts: Map<string, number>, key: string, amount = 1): void {
  counts.set(key, (counts.get(key) ?? 0) + amount);
}

function finitePositive(value?: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
