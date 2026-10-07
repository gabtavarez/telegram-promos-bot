import type { Deal } from "../types/Deal.js";
import type {
  FeedbackCounts,
  FeedbackType,
  PriceHistoryStats,
  PublishedOffer,
  ProviderHealth,
  UserAlert,
} from "../types/BotState.js";

export interface DealsStore {
  initialize(): Promise<void>;
  filterUnposted(deals: Deal[]): Promise<Deal[]>;
  markPosted(id: string, originalUrl: string, now?: Date): Promise<boolean>;
  unmarkPosted(id: string, originalUrl: string): Promise<void>;
  recordPriceHistory(deals: Deal[], now?: Date): Promise<Map<string, PriceHistoryStats>>;
  savePublishedOffer(offer: PublishedOffer): Promise<void>;
  getPublishedOffers(limit?: number): Promise<PublishedOffer[]>;
  updatePublishedOffer(offer: PublishedOffer): Promise<void>;
  createAlert(userId: string, query: string, maxPrice?: number): Promise<UserAlert>;
  listAlerts(userId?: string): Promise<UserAlert[]>;
  removeAlert(userId: string, alertId: string): Promise<boolean>;
  claimAlertNotification(alertId: string, dealId: string): Promise<boolean>;
  releaseAlertNotification(alertId: string, dealId: string): Promise<void>;
  recordFeedback(feedbackKey: string, userId: string, type: FeedbackType): Promise<FeedbackCounts>;
  claimDailySummary(date: string): Promise<boolean>;
  releaseDailySummary(date: string): Promise<void>;
  saveProviderHealth(health: ProviderHealth[]): Promise<void>;
  getProviderHealth(): Promise<ProviderHealth[]>;
  syncActiveCouponKeys(keys: string[]): Promise<string[]>;
}
