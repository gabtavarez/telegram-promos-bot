import axios from "axios";
import type { Deal } from "../types/Deal.js";
import type { MercadoLivreAuth } from "../services/MercadoLivreAuth.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { calculateDiscount } from "../utils/price.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

const API = "https://api.mercadolibre.com";
/** Informatica; Eletronicos, Audio e Video; Games. */
const ROOT_CATEGORIES = ["MLB1648", "MLB1000", "MLB1144"];
const CATEGORY_REFRESH_MS = 12 * 60 * 60_000;
const HIGHLIGHTS_PER_CYCLE = 10;
const HIGHLIGHT_TTL_MS = 3 * 60 * 60_000;
const PRICES_PER_CYCLE = 60;
const PRODUCT_INFO_TTL_MS = 24 * 60 * 60_000;
const CONCURRENCY = 3;

interface ProductInfo {
  name: string;
  imageUrl?: string;
  permalink: string;
  fetchedAt: number;
}

interface PoolEntry {
  id: string;
  type: "PRODUCT" | "ITEM";
  addedAt: number;
  checkedAt: number;
}

/**
 * Coleta do Mercado Livre pela API oficial (app autorizado via OAuth). A busca aberta (/sites/MLB/search)
 * e recusada para apps nao certificados, entao usamos os "mais vendidos" de cada categoria de hardware
 * (/highlights) e o preco dos anuncios do catalogo (/products/{id}/items).
 */
export class MercadoLivreApiProvider implements AffiliateProvider {
  readonly name = "Mercado Livre";
  private categories: string[] = [];
  private categoriesAt = 0;
  private categoryCursor = 0;
  private readonly highlightAt = new Map<string, number>();
  private readonly pool = new Map<string, PoolEntry>();
  private readonly products = new Map<string, ProductInfo>();
  private readonly lastDeals = new Map<string, Deal>();
  private lastError?: string;

  constructor(private readonly auth: MercadoLivreAuth) {}

  getLastError(): string | undefined {
    return this.lastError;
  }

  async getDeals(): Promise<Deal[]> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      this.lastError = "API do Mercado Livre sem login: abra /ml/login para reconectar.";
      throw new Error(this.lastError);
    }
    const get = <T>(path: string) =>
      axios.get<T>(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 }).then((r) => r.data);

    await this.refreshCategories(get);
    const highlightStats = await this.refreshHighlights(get);

    // Verifica primeiro os itens nunca checados, depois os mais antigos.
    const batch = [...this.pool.values()].sort((a, b) => a.checkedAt - b.checkedAt).slice(0, PRICES_PER_CYCLE);
    let failures = 0;
    const failureCodes = new Map<string, number>();
    await mapLimit(batch, CONCURRENCY, async (entry) => {
      try {
        const deal = entry.type === "PRODUCT" ? await this.productDeal(entry.id, get) : await this.itemDeal(entry.id, get);
        entry.checkedAt = Date.now();
        if (deal) this.lastDeals.set(entry.id, deal);
        else this.lastDeals.delete(entry.id);
      } catch (error) {
        failures += 1;
        entry.checkedAt = Date.now();
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const code = `${entry.type.toLowerCase()}:${status ?? (axios.isAxiosError(error) ? error.code : "erro")}`;
        failureCodes.set(code, (failureCodes.get(code) ?? 0) + 1);
        if (status === 404) { this.pool.delete(entry.id); this.lastDeals.delete(entry.id); }
      }
    });

    const deals = [...this.lastDeals.values()];
    console.log(
      `Mercado Livre (API): ${this.categories.length} categoria(s); ${highlightStats}; ` +
        `${this.pool.size} produto(s) no radar; ${batch.length} preco(s) atualizados (${failures} falha(s)` +
        `${failureCodes.size ? `: ${[...failureCodes].map(([code, n]) => `${code}=${n}`).join(", ")}` : ""}); ` +
        `${deals.length} oferta(s) de hardware.`,
    );
    this.lastError = undefined;
    if (batch.length > 0 && failures === batch.length) {
      this.lastError = "API do Mercado Livre recusou todas as consultas de preco neste ciclo.";
      throw new Error(this.lastError);
    }
    return deals;
  }

  private async refreshCategories(get: <T>(path: string) => Promise<T>): Promise<void> {
    if (this.categories.length && Date.now() - this.categoriesAt < CATEGORY_REFRESH_MS) return;
    const found = new Set<string>();
    for (const root of ROOT_CATEGORIES) {
      try {
        const data = await get<{ children_categories?: Array<{ id: string; name: string }> }>(`/categories/${root}`);
        const children = (data.children_categories ?? []).filter((child) => isRelevantCategory(child.name));
        for (const child of children) {
          found.add(child.id);
          const grand = await get<{ children_categories?: Array<{ id: string; name: string }> }>(`/categories/${child.id}`).catch(() => undefined);
          for (const sub of grand?.children_categories ?? []) if (isRelevantCategory(sub.name)) found.add(sub.id);
        }
      } catch (error) {
        console.warn(`Mercado Livre (API): falha ao listar categorias de ${root}: ${describe(error)}`);
      }
    }
    if (found.size) {
      this.categories = [...found];
      this.categoriesAt = Date.now();
    } else if (!this.categories.length) {
      this.categories = ["MLB1648"];
    }
  }

  private async refreshHighlights(get: <T>(path: string) => Promise<T>): Promise<string> {
    const due = this.categories.filter((id) => Date.now() - (this.highlightAt.get(id) ?? 0) > HIGHLIGHT_TTL_MS);
    const selected: string[] = [];
    for (let i = 0; i < due.length && selected.length < HIGHLIGHTS_PER_CYCLE; i += 1) {
      selected.push(due[(this.categoryCursor + i) % due.length]!);
    }
    this.categoryCursor += selected.length;
    let added = 0;
    let refused = 0;
    await mapLimit(selected, CONCURRENCY, async (category) => {
      try {
        const data = await get<{ content?: Array<{ id: string; type?: string }> }>(`/highlights/MLB/category/${category}`);
        this.highlightAt.set(category, Date.now());
        for (const entry of data.content ?? []) {
          const type = entry.type === "ITEM" ? "ITEM" : "PRODUCT";
          if (!this.pool.has(entry.id)) {
            this.pool.set(entry.id, { id: entry.id, type, addedAt: Date.now(), checkedAt: 0 });
            added += 1;
          }
        }
      } catch {
        refused += 1;
        this.highlightAt.set(category, Date.now());
      }
    });
    // Radar com no maximo ~600 produtos: descarta os mais antigos.
    if (this.pool.size > 600) {
      const oldest = [...this.pool.values()].sort((a, b) => a.addedAt - b.addedAt).slice(0, this.pool.size - 600);
      for (const entry of oldest) { this.pool.delete(entry.id); this.lastDeals.delete(entry.id); }
    }
    return `${selected.length} lista(s) de mais vendidos (${added} novo(s), ${refused} recusada(s))`;
  }

  private async productDeal(id: string, get: <T>(path: string) => Promise<T>): Promise<Deal | undefined> {
    let info = this.products.get(id);
    if (!info || Date.now() - info.fetchedAt > PRODUCT_INFO_TTL_MS) {
      const product = await get<{ name?: string; permalink?: string; pictures?: Array<{ url?: string; secure_url?: string }> }>(`/products/${id}`);
      if (!product.name) return undefined;
      info = {
        name: product.name,
        imageUrl: product.pictures?.[0]?.secure_url ?? product.pictures?.[0]?.url,
        permalink: validUrl(product.permalink) ?? `https://www.mercadolivre.com.br/p/${id}`,
        fetchedAt: Date.now(),
      };
      this.products.set(id, info);
    }
    if (!isPcHardwareDeal(info.name) || !info.imageUrl) return undefined;

    const items = await get<{ results?: Array<MlItem> }>(`/products/${id}/items?limit=20`);
    const offer = pickBestOffer(items.results ?? []);
    if (!offer) return undefined;
    return toDeal(`mercado-livre:${id}`, info.name, info.permalink, info.imageUrl, offer);
  }

  private async itemDeal(id: string, get: <T>(path: string) => Promise<T>): Promise<Deal | undefined> {
    const item = await get<MlItem & { title?: string; permalink?: string; thumbnail?: string; pictures?: Array<{ secure_url?: string }> }>(`/items/${id}`);
    const permalink = validUrl(item.permalink);
    if (!item.title || !permalink || !isPcHardwareDeal(item.title)) return undefined;
    if (item.condition && item.condition !== "new") return undefined;
    if (item.status && item.status !== "active") return undefined;
    const image = item.pictures?.[0]?.secure_url ?? item.thumbnail?.replace(/^http:/, "https:");
    if (!image) return undefined;
    return toDeal(`mercado-livre:${id}`, item.title, permalink, image, item);
  }
}

interface MlItem {
  item_id?: string;
  price?: number;
  original_price?: number | null;
  condition?: string;
  status?: string;
  available_quantity?: number;
  official_store_id?: number | null;
}

/** Menor preco entre anuncios novos e ativos; loja oficial ganha empate de ate 2%. */
export function pickBestOffer(items: MlItem[]): MlItem | undefined {
  const valid = items.filter((item) =>
    typeof item.price === "number" && item.price > 0 &&
    (!item.condition || item.condition === "new") &&
    (item.available_quantity === undefined || item.available_quantity > 0));
  if (!valid.length) return undefined;
  const cheapest = Math.min(...valid.map((item) => item.price!));
  const official = valid.filter((item) => item.official_store_id && item.price! <= cheapest * 1.02).sort((a, b) => a.price! - b.price!)[0];
  return official ?? valid.sort((a, b) => a.price! - b.price!)[0];
}

function toDeal(id: string, title: string, url: string, imageUrl: string, offer: MlItem): Deal {
  const price = offer.price!;
  const previous = offer.original_price && offer.original_price > price * 1.03 && offer.original_price <= price * 4
    ? offer.original_price
    : undefined;
  return {
    id,
    provider: "mercado-livre",
    title,
    originalUrl: url,
    imageUrl,
    currentPrice: price,
    previousPrice: previous,
    discountPercentage: calculateDiscount(price, previous),
  };
}

const RELEVANT = /inform|comput|componente|perif|armazen|mem[oó]ria|placa|processad|monitor|teclad|mouse|fone|headset|[aá]udio|gamer|game|redes|roteador|notebook|acess[oó]rio|ssd|hd|refrigera|fonte|gabinete|webcam|microfone|cadeira|tv|v[ií]deo|console|controle/i;

function isRelevantCategory(name: string): boolean {
  return RELEVANT.test(name);
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]!;
      await worker(item);
    }
  }));
}

function validUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function describe(error: unknown): string {
  if (axios.isAxiosError(error)) return `${error.response?.status ?? error.code}`;
  return error instanceof Error ? error.message : String(error);
}
