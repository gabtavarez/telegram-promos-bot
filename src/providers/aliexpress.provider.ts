import { createHmac } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { calculateDiscount } from "../utils/price.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

const API_URL = "https://api-sg.aliexpress.com/sync";
const PRODUCT_FIELDS = [
  "product_id",
  "product_title",
  "product_detail_url",
  "product_main_image_url",
  "target_sale_price",
  "target_original_price",
  "discount",
  "promotion_link",
].join(",");
const HARDWARE_KEYWORDS = [
  "graphics card",
  "RX 7600 graphics card",
  "processor",
  "SSD NVMe",
  "DDR5 RAM",
  "motherboard",
  "PC power supply",
  "PC case",
  "CPU air cooler ARGB",
  "AG400 CPU cooler",
  "mechanical keyboard",
  "magnetic keyboard hall effect",
  "gaming mouse PAW3395",
  "monitor arm",
  "USB dock station",
];

interface AliExpressConfig {
  appKey: string;
  appSecret: string;
  trackingId: string;
}

interface AliExpressProduct {
  product_id?: number | string;
  product_title?: string;
  product_detail_url?: string;
  product_main_image_url?: string;
  target_sale_price?: string;
  target_original_price?: string;
  discount?: string;
  promotion_link?: string;
}

interface ApiErrorResponse {
  error_response?: {
    code?: number;
    msg?: string;
    sub_code?: string;
    sub_msg?: string;
  };
}

interface ProductQueryResponse extends ApiErrorResponse {
  aliexpress_affiliate_product_query_response?: {
    resp_result?: {
      resp_code?: number;
      resp_msg?: string;
      result?: { products?: { product?: AliExpressProduct[] } };
    };
  };
}

interface PromotionLink {
  source_value?: string;
  promotion_link?: string;
}

interface LinkGenerateResponse extends ApiErrorResponse {
  aliexpress_affiliate_link_generate_response?: {
    resp_result?: {
      resp_code?: number;
      resp_msg?: string;
      result?: {
        promotion_links?: { promotion_link?: PromotionLink[] | PromotionLink };
      };
    };
  };
}

export class AliExpressProvider implements AffiliateProvider {
  readonly name = "AliExpress";
  private readonly client: AxiosInstance;

  constructor(private readonly config: AliExpressConfig) {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 15_000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }

  async getDeals(): Promise<Deal[]> {
    try {
      const queryResults = await settleWithConcurrency(
        HARDWARE_KEYWORDS,
        4,
        (keyword) => this.queryProductsWithRetry(keyword),
      );
      const failedQueries = queryResults.filter((result) => result.status === "rejected");
      if (failedQueries.length > 0) {
        console.warn(`AliExpress: ${failedQueries.length} busca(s) parcial(is) falharam.`);
      }
      const products = [
        ...new Map(
          queryResults
            .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
            .map((product) => [String(product.product_id), product]),
        ).values(),
      ].filter((product) => product.product_title && isPcHardwareDeal(product.product_title));

      if (products.length === 0) return [];

      const sourceUrls = products
        .map((product) => product.product_detail_url)
        .filter((url): url is string => Boolean(url));
      const generatedLinks = await this.generateAffiliateLinks(sourceUrls);

      return products.flatMap((product): Deal[] => {
        const id = product.product_id;
        const title = product.product_title;
        const sourceUrl = product.product_detail_url;
        const imageUrl = product.product_main_image_url;
        const currentPrice = parsePrice(product.target_sale_price);
        const originalPrice = parsePrice(product.target_original_price);
        const affiliateLink = sourceUrl
          ? generatedLinks.get(sourceUrl) ?? normalizeAffiliateLink(product.promotion_link)
          : undefined;

        if (!id || !title || !sourceUrl || !imageUrl || !currentPrice || !affiliateLink) return [];

        return [{
          id: `aliexpress:${id}`,
          provider: "aliexpress",
          title,
          originalUrl: affiliateLink,
          imageUrl,
          currentPrice,
          previousPrice: originalPrice,
          discountPercentage: parseDiscount(product.discount) ?? calculateDiscount(currentPrice, originalPrice),
        }];
      });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `${error.code ?? "HTTP_ERROR"}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      console.error(`Falha na API do AliExpress: ${message}`);
      return [];
    }
  }

  private async queryProducts(keyword: string): Promise<AliExpressProduct[]> {
    const response = await this.callApi<ProductQueryResponse>("aliexpress.affiliate.product.query", {
      fields: PRODUCT_FIELDS,
      keywords: keyword,
      page_no: "1",
      page_size: "20",
      sort: "LAST_VOLUME_DESC",
      target_currency: "BRL",
      target_language: "PT",
      ship_to_country: "BR",
      tracking_id: this.config.trackingId,
    });
    throwIfApiError(response);

    const result = response.aliexpress_affiliate_product_query_response?.resp_result;
    if (result?.resp_code !== 200) {
      throw new Error(result?.resp_msg ?? "Resposta invalida ao buscar produtos");
    }
    return result.result?.products?.product ?? [];
  }

  private async queryProductsWithRetry(keyword: string): Promise<AliExpressProduct[]> {
    try {
      return await this.queryProducts(keyword);
    } catch (error) {
      await delay(400);
      try {
        return await this.queryProducts(keyword);
      } catch {
        throw error;
      }
    }
  }

  private async generateAffiliateLinks(sourceUrls: string[]): Promise<Map<string, string>> {
    const results = await Promise.allSettled(
      chunk(sourceUrls, 20).map((batch) => this.generateAffiliateLinkBatch(batch)),
    );
    const generated = new Map<string, string>();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const [source, affiliate] of result.value) generated.set(source, affiliate);
    }
    return generated;
  }

  private async generateAffiliateLinkBatch(sourceUrls: string[]): Promise<Map<string, string>> {
    const response = await this.callApi<LinkGenerateResponse>("aliexpress.affiliate.link.generate", {
      promotion_link_type: "0",
      source_values: sourceUrls.join(","),
      tracking_id: this.config.trackingId,
    });
    throwIfApiError(response);

    const result = response.aliexpress_affiliate_link_generate_response?.resp_result;
    if (result?.resp_code !== 200) {
      throw new Error(result?.resp_msg ?? "Resposta invalida ao gerar links afiliados");
    }

    const rawLinks = result.result?.promotion_links?.promotion_link;
    const links = rawLinks ? (Array.isArray(rawLinks) ? rawLinks : [rawLinks]) : [];
    return new Map(
      links.flatMap(({ source_value: source, promotion_link: affiliate }) => {
        const normalized = normalizeAffiliateLink(affiliate);
        return source && normalized ? [[source, normalized] as const] : [];
      }),
    );
  }

  private async callApi<T>(method: string, businessParams: Record<string, string>): Promise<T> {
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      format: "json",
      method,
      sign_method: "sha256",
      timestamp: Date.now().toString(),
      v: "2.0",
      ...businessParams,
    };
    params.sign = signRequest(params, this.config.appSecret);

    const response = await this.client.post<T>("", new URLSearchParams(params));
    return response.data;
  }
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function settleWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await operation(values[index]!) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function signRequest(params: Record<string, string>, secret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex").toUpperCase();
}

function throwIfApiError(response: ApiErrorResponse): void {
  const error = response.error_response;
  if (!error) return;
  throw new Error(error.sub_msg ?? error.msg ?? error.sub_code ?? `AliExpress API ${error.code}`);
}

function normalizeAffiliateLink(link?: string): string | undefined {
  if (!link) return undefined;
  try {
    const url = new URL(link);
    if (url.hostname !== "s.click.aliexpress.com") return undefined;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return undefined;
  }
}

function parsePrice(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDiscount(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}
