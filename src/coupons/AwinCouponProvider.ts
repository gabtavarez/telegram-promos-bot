import axios, { type AxiosInstance } from "axios";
import type { Coupon, CouponProvider } from "./CouponProvider.js";

const PAGE_SIZE = 200;
const MAX_PAGES = 5;
const CACHE_DURATION_MS = 30 * 60 * 1_000;

interface AwinCouponConfig {
  publisherId: string;
  accessToken: string;
  advertiserIds?: number[];
}

interface AwinOffer {
  type?: string;
  title?: string;
  terms?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  advertiser?: {
    id?: number;
    name?: string;
    joined?: boolean;
  };
  voucher?: {
    code?: string | null;
    exclusive?: boolean;
  };
}

export class AwinCouponProvider implements CouponProvider {
  readonly name = "Awin";
  private readonly client: AxiosInstance;
  private cache: Coupon[] = [];
  private cacheExpiresAt = 0;
  private lastError?: string;

  constructor(private readonly config: AwinCouponConfig) {
    this.client = axios.create({
      baseURL: "https://api.awin.com",
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    if (Date.now() < this.cacheExpiresAt) return this.cache;

    try {
      const offers: AwinOffer[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const pageOffers = await this.fetchPage(page);
        offers.push(...pageOffers);
        if (pageOffers.length < PAGE_SIZE) break;
      }

      this.cache = offers.flatMap(normalizeAwinOffer);
      this.cacheExpiresAt = Date.now() + CACHE_DURATION_MS;
      this.lastError = undefined;
      console.log(`Awin: ${this.cache.length} cupom(ns) ativo(s) encontrado(s).`);
      return this.cache;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `${error.response?.status ?? error.code ?? "HTTP_ERROR"}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      this.lastError = message;
      console.error(`Falha ao consultar cupons da Awin: ${message}`);
      return this.cache;
    }
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  private async fetchPage(page: number): Promise<AwinOffer[]> {
    const filters: Record<string, unknown> = {
      membership: "joined",
      regionCodes: ["BR"],
      status: "active",
      type: "voucher",
    };
    if (this.config.advertiserIds?.length) filters.advertiserIds = this.config.advertiserIds;

    const response = await this.client.post<unknown>(`/publisher/${this.config.publisherId}/promotions`, {
      filters,
      pagination: { page, pageSize: PAGE_SIZE },
    });
    return extractOffers(response.data);
  }
}

export function extractOffers(response: unknown): AwinOffer[] {
  if (Array.isArray(response)) return response as AwinOffer[];
  if (!response || typeof response !== "object") return [];

  const record = response as Record<string, unknown>;
  for (const key of ["data", "offers", "promotions", "results"]) {
    if (Array.isArray(record[key])) return record[key] as AwinOffer[];
  }
  return [];
}

function normalizeAwinOffer(offer: AwinOffer): Coupon[] {
  const code = offer.voucher?.code?.trim();
  const advertiserId = offer.advertiser?.id;
  const advertiserName = offer.advertiser?.name?.trim();
  const destinationUrl = normalizeUrl(offer.url);
  const startsAt = parseDate(offer.startDate);
  const endsAt = parseDate(offer.endDate);
  const now = Date.now();

  if (
    offer.type !== "voucher" ||
    offer.advertiser?.joined === false ||
    !code ||
    !advertiserId ||
    !advertiserName ||
    !destinationUrl ||
    !startsAt ||
    !endsAt ||
    startsAt.getTime() > now ||
    endsAt.getTime() < now
  ) {
    return [];
  }

  return [{
    code,
    advertiserId,
    advertiserName,
    destinationUrl,
    title: offer.title?.trim() || `Cupom ${advertiserName}`,
    terms: offer.terms?.trim() || undefined,
    startsAt,
    endsAt,
    exclusive: offer.voucher?.exclusive ?? false,
  }];
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

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
