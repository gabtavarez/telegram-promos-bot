import { createHash } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

const API_URL = "https://open-api.affiliate.shopee.com.br/graphql";
const HARDWARE_KEYWORDS = [
  "placa de video",
  "placa de video rx 7600",
  "placa de video rtx 4060",
  "processador ryzen",
  "ssd nvme",
  "memoria ram ddr5",
  "placa mae",
  "fonte 80 plus",
  "gabinete gamer",
  "water cooler cpu",
  "water cooler 240mm lcd",
  "water cooler 360mm com tela",
  "teclado mecanico",
  "mouse gamer",
  "headset gamer",
  "monitor gamer",
  "monitor 180hz",
  "cadeira ergonomica escritorio mesh",
  "braco articulado monitor",
  "suporte monitor pistao gas vesa f80",
  "suporte duplo monitor articulado vesa",
  "notebook ryzen 16gb ssd",
  "smart tv 4k 50",
  "Samsung Galaxy S24 256GB",
  "Samsung Galaxy S25 256GB",
  "Samsung Galaxy A55 5G",
  "Samsung Galaxy A56 5G",
  "Apple iPhone 15 128GB",
  "Apple iPhone 16 128GB",
];
const QUERY_CONCURRENCY = 4;

const productQuery = (keyword: string) => `{
  productOfferV2(keyword: ${JSON.stringify(keyword)}, listType: 0, sortType: 2, page: 1, limit: 20) {
    nodes {
      productName
      itemId
      price
      imageUrl
      productLink
      offerLink
      priceMin
      priceMax
      ratingStar
      priceDiscountRate
      shopId
    }
    pageInfo { page limit hasNextPage scrollId }
  }
}`;

interface ShopeeConfig {
  appId: string;
  appSecret: string;
}

interface ShopeeProduct {
  productName?: string;
  itemId?: string | number;
  price?: string | number;
  imageUrl?: string;
  productLink?: string;
  offerLink?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  ratingStar?: string | number;
  priceDiscountRate?: string | number;
  shopId?: string | number;
}

interface ShopeeResponse {
  data?: { productOfferV2?: { nodes?: ShopeeProduct[] } };
  errors?: Array<{ message?: string; extensions?: { message?: string } }>;
}

export class ShopeeProvider implements AffiliateProvider {
  readonly name = "Shopee";
  private readonly client: AxiosInstance;

  constructor(private readonly config: ShopeeConfig) {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 20_000,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });
  }

  async getDeals(): Promise<Deal[]> {
    try {
      const results = await mapSettledWithConcurrency(
        HARDWARE_KEYWORDS,
        QUERY_CONCURRENCY,
        (keyword) => this.queryProducts(keyword),
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) console.warn(`Shopee: ${failed.length} busca(s) parcial(is) falharam.`);

      const products = [
        ...new Map(
          results
            .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
            .map((product) => [`${product.shopId ?? "shop"}:${product.itemId}`, product]),
        ).values(),
      ];
      const deals = products.flatMap((product): Deal[] => {
        const id = product.itemId;
        const title = product.productName?.trim();
        const directPrice = parsePrice(product.price);
        const minimumPrice = parsePrice(product.priceMin);
        const maximumPrice = parsePrice(product.priceMax);
        const hasMisleadingVariantRange = minimumPrice !== undefined && maximumPrice !== undefined &&
          maximumPrice > minimumPrice * 1.08;
        const currentPrice = directPrice ?? minimumPrice;
        const imageUrl = normalizeUrl(product.imageUrl);
        const originalUrl = normalizeShopeeUrl(product.offerLink) ?? normalizeShopeeUrl(product.productLink);
        const discountPercentage = parseDiscount(product.priceDiscountRate);
        const previousPrice = currentPrice && discountPercentage
          ? roundPrice(currentPrice / (1 - discountPercentage / 100))
          : undefined;

        if (!id || !title || !currentPrice || !imageUrl || !originalUrl || hasMisleadingVariantRange) return [];
        const rating = parseRating(product.ratingStar);
        if (rating !== undefined && rating < 4.3) return [];
        if (!isPcHardwareDeal(title)) return [];

        return [{
          id: `shopee:${product.shopId ?? "shop"}:${id}`,
          provider: "shopee",
          title,
          originalUrl,
          imageUrl,
          currentPrice,
          previousPrice,
          discountPercentage,
        }];
      });

      console.log(`Shopee API: ${products.length} produto(s) recebidos; ${deals.length} aprovado(s) pelo filtro.`);
      return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `${error.response?.status ?? error.code ?? "HTTP_ERROR"}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      console.error(`Falha na API da Shopee: ${message}`);
      return [];
    }
  }

  private async queryProducts(keyword: string): Promise<ShopeeProduct[]> {
    const payload = JSON.stringify({ query: productQuery(keyword) });
    const timestamp = Math.ceil(Date.now() / 1_000);
    const signature = createHash("sha256")
      .update(`${this.config.appId}${timestamp}${payload}${this.config.appSecret}`, "utf8")
      .digest("hex");
    const authorization =
      `SHA256 Credential=${this.config.appId}, Timestamp=${timestamp}, Signature=${signature}`;
    const { data } = await this.client.post<ShopeeResponse>("", payload, {
      headers: { Authorization: authorization },
    });

    if (data.errors?.length) {
      throw new Error(data.errors.map((error) => error.extensions?.message ?? error.message).join("; "));
    }
    return data.data?.productOfferV2?.nodes ?? [];
  }
}

function parsePrice(value?: string | number): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (!value) return undefined;
  const cleaned = value.replace(/[^\d.,-]/g, "");
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDiscount(value?: string | number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace("%", ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  const percentage = parsed <= 1 ? parsed * 100 : parsed;
  return Math.min(99, Math.round(percentage));
}

function parseRating(value?: string | number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 5 ? parsed : undefined;
}

async function mapSettledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index]!) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function normalizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeShopeeUrl(value?: string): string | undefined {
  const normalized = normalizeUrl(value);
  if (!normalized) return undefined;
  const hostname = new URL(normalized).hostname.toLowerCase();
  return hostname === "shopee.com.br" || hostname.endsWith(".shopee.com.br") || hostname === "shope.ee"
    ? normalized
    : undefined;
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
