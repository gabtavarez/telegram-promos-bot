import type { StoreKey } from "./botConfig";

export type OfferStatus = "active" | "soldout" | "price-changed";

export interface OfferLite {
  id: string;
  title: string;
  provider: StoreKey;
  price: number;
  previousPrice?: number;
  discount?: number;
  couponCode?: string;
  imageUrl?: string;
  publishedAt: string;
  status: OfferStatus;
  url: string;
}

export interface HealthLite {
  name: string;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  durationMs: number;
  received: number;
  qualityApproved: number;
  promotable: number;
  newDeals: number;
  error?: string;
}

export interface MetricsPayload {
  mode: "live" | "demo";
  offers: OfferLite[];
  health: HealthLite[];
  alerts: number;
  coupons: number;
  generatedAt: string;
}

export const STORE_LABEL: Record<StoreKey, string> = {
  "mercado-livre": "Mercado Livre",
  amazon: "Amazon",
  kabum: "KaBuM!",
  shopee: "Shopee",
  aliexpress: "AliExpress",
};
