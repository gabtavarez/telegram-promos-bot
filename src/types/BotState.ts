import type { Deal } from "./Deal.js";

export interface PriceHistoryStats {
  lowestPrice90Days: number;
  averagePrice30Days: number;
  averagePrice90Days: number;
  observationDays: number;
  isLowestPrice90Days: boolean;
  percentBelow30DayAverage: number;
}

export interface UserAlert {
  id: string;
  userId: string;
  query: string;
  maxPrice?: number;
  createdAt: string;
}

export type FeedbackType = "worth" | "soldout" | "bad";

export interface FeedbackCounts {
  worth: number;
  soldout: number;
  bad: number;
}

export type PublishedOfferStatus = "active" | "soldout" | "price-changed";
export type PublishedMessageType = "photo" | "text";

export interface PublishedOffer {
  deal: Deal;
  affiliateUrl: string;
  messageId: number;
  messageType: PublishedMessageType;
  feedbackKey: string;
  publishedAt: string;
  status: PublishedOfferStatus;
}

export interface ProviderHealth {
  name: string;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  durationMs: number;
  received: number;
  qualityApproved: number;
  promotable: number;
  newDeals: number;
  error?: string;
}

/** Resumo de um ciclo de coleta/publicacao, exibido no painel (funil de qualidade). */
export interface CycleReport {
  at: string;
  durationMs: number;
  result: string;
  received: number;
  stages: { quality: number; promotable: number; fresh: number; noRepeat: number; allowed: number; diverse: number };
  rejected: Record<string, number>;
  byStore: Record<string, { received: number; passed: number }>;
  published?: { title: string; provider: string; category: string; brand?: string; score: number };
}
