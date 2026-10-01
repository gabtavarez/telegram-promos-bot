import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { calculateDiscount } from "../utils/price.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

interface KabumConfig {
  publisherId: string;
  advertiserId: string;
  accessToken?: string;
  feedUrl?: string;
  locale: string;
}

interface AwinFeedProduct {
  id?: string | number;
  title?: string;
  link?: string;
  image_link?: string;
  price?: string | number;
  sale_price?: string | number;
  availability?: string;
  condition?: string;
}

type AwinFeedRecord = Record<string, unknown> & {
  error?: number | string;
  message?: string;
};

export class KabumProvider implements AffiliateProvider {
  readonly name = "Kabum";
  private readonly client: AxiosInstance;
  private feedSource = "automatico";

  constructor(private readonly config: KabumConfig) {
    this.client = axios.create({
      baseURL: "https://api.awin.com",
      timeout: 30_000,
      maxContentLength: 50 * 1024 * 1024,
      headers: config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : undefined,
      responseType: "text",
    });
  }

  async getDeals(): Promise<Deal[]> {
    try {
      const records = await this.fetchFeedRecords();
      const deals = records.flatMap((record): Deal[] => {
        if (record.error) throw new Error(record.message ?? `Awin feed error ${record.error}`);

        const product = flattenProduct(record);
        const id = product.id;
        const title = normalizeText(product.title);
        const originalUrl = normalizeUrl(product.link);
        const imageUrl = normalizeUrl(product.image_link);
        const regularPrice = parseFeedPrice(product.price);
        const salePrice = parseFeedPrice(product.sale_price);
        const currentPrice = salePrice && regularPrice && salePrice < regularPrice ? salePrice : regularPrice;
        const previousPrice = salePrice && regularPrice && salePrice < regularPrice ? regularPrice : undefined;

        if (!id || !title || !originalUrl || !imageUrl || !currentPrice) return [];
        if (isUnavailable(product.availability) || isUsed(product.condition)) return [];
        if (!isPcHardwareDeal(title)) return [];

        return [{
          id: `kabum:${id}`,
          provider: "kabum",
          title,
          originalUrl,
          imageUrl,
          currentPrice,
          previousPrice,
          discountPercentage: calculateDiscount(currentPrice, previousPrice),
        }];
      });

      return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `${error.response?.status ?? error.code ?? "HTTP_ERROR"}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      console.error(`Falha na API de produtos da Kabum/Awin (${this.feedSource}): ${message}`);
      return [];
    }
  }

  private async fetchFeedRecords(): Promise<AwinFeedRecord[]> {
    if (this.config.feedUrl) {
      this.feedSource = "feed manual";
      try {
        const { data } = await this.client.get<string>(this.config.feedUrl);
        return parseCsvFeed(data);
      } catch (error) {
        if (!this.config.accessToken) throw error;
        const message = axios.isAxiosError(error)
          ? `${error.response?.status ?? error.code ?? "HTTP_ERROR"}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
        console.warn(`Feed manual da Kabum/Awin falhou; tentando feed automatico. Motivo: ${message}`);
      }
    }

    this.feedSource = "feed automatico";
    const path = `/publishers/${this.config.publisherId}/awinfeeds/download/${this.config.advertiserId}-retail-${this.config.locale}.jsonl`;
    const { data } = await this.client.get<string>(path);
    return parseJsonLines(data);
  }
}

function parseJsonLines(data: string): AwinFeedRecord[] {
  return data
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AwinFeedRecord);
}

function flattenProduct(record: AwinFeedRecord): AwinFeedProduct {
  const sections = Object.values(record).filter(isRecord);
  const flat = Object.assign({}, ...sections, record) as Record<string, unknown>;
  return {
    id: pickValue(flat, "aw_product_id", "merchant_product_id", "id"),
    title: pickValue(flat, "product_name", "title"),
    link: pickValue(flat, "aw_deep_link", "link", "merchant_deep_link"),
    image_link: pickValue(flat, "merchant_image_url", "aw_image_url", "image_link"),
    price: pickValue(flat, "search_price", "display_price", "store_price", "price"),
    sale_price: pickValue(flat, "store_price", "sale_price"),
    availability: pickValue(flat, "in_stock", "stock_status", "availability"),
    condition: pickValue(flat, "condition"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFeedPrice(value?: string | number): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (!value) return undefined;
  const match = value.match(/[\d.,]+/u)?.[0];
  if (!match) return undefined;
  const normalized = match.includes(",") && match.includes(".")
    ? match.replace(/\./g, "").replace(",", ".")
    : match.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseCsvFeed(data: string): AwinFeedRecord[] {
  const rows = parseCsvRows(data.replace(/^\uFEFF/, ""));
  const [header, ...records] = rows;
  if (!header) return [];

  return records
    .filter((row) => row.some((value) => value.trim()))
    .map((row) =>
      Object.fromEntries(header.map((column, index) => [column.trim(), row[index]?.trim() ?? ""])) as AwinFeedRecord,
    );
}

function parseCsvRows(data: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < data.length; index += 1) {
    const char = data[index];
    const next = data[index + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function pickValue(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function normalizeText(value?: string): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
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

function isUnavailable(value?: string): boolean {
  return Boolean(value && /out[_\s-]*of[_\s-]*stock|indispon[ií]vel/i.test(value));
}

function isUsed(value?: string): boolean {
  return Boolean(value && /used|refurbished|recondicionado|usado/i.test(value));
}
