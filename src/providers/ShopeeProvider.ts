import { createHash } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

const API_URL = "https://open-api.affiliate.shopee.com.br/graphql";
const PRODUCT_QUERY = `{
  productOfferV2 {
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
      const payload = JSON.stringify({ query: PRODUCT_QUERY });
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

      const products = data.data?.productOfferV2?.nodes ?? [];
      const deals = products.flatMap((product): Deal[] => {
        const id = product.itemId;
        const title = product.productName?.trim();
        const currentPrice = parsePrice(product.priceMin ?? product.price);
        const imageUrl = normalizeUrl(product.imageUrl);
        const originalUrl = normalizeShopeeUrl(product.offerLink ?? product.productLink);
        const discountPercentage = parseDiscount(product.priceDiscountRate);
        const previousPrice = currentPrice && discountPercentage
          ? roundPrice(currentPrice / (1 - discountPercentage / 100))
          : undefined;

        if (!id || !title || !currentPrice || !imageUrl || !originalUrl) return [];
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
