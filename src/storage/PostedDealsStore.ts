import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Deal } from "../types/Deal.js";
import type {
  FeedbackCounts,
  FeedbackType,
  PriceHistoryStats,
  PublishedOffer,
  ProviderHealth,
  UserAlert,
} from "../types/BotState.js";
import type { DealsStore } from "./DealsStore.js";
import {
  calculatePriceHistoryStats,
  getPriceHistoryDateKeys,
  mergeDailyPrices,
  type DailyPrices,
} from "./priceHistory.js";

type PostedDeals = Record<string, string>;

interface LocalBotState {
  prices: Record<string, DailyPrices>;
  published: PublishedOffer[];
  alerts: UserAlert[];
  alertNotifications: Record<string, string>;
  feedback: Record<string, { votes: Record<string, FeedbackType> }>;
  summaries: string[];
  providerHealth?: ProviderHealth[];
  activeCouponKeys?: string[];
}

const emptyState = (): LocalBotState => ({
  prices: {},
  published: [],
  alerts: [],
  alertNotifications: {},
  feedback: {},
  summaries: [],
});

export class PostedDealsStore implements DealsStore {
  private readonly filePath: string;
  private readonly statePath: string;
  private records: PostedDeals = {};
  private state: LocalBotState = emptyState();
  private writeTail: Promise<void> = Promise.resolve();

  constructor(filePath: string, private readonly retentionMs = 12 * 60 * 60 * 1_000) {
    this.filePath = resolve(filePath);
    this.statePath = `${this.filePath}.state.json`;
  }

  async initialize(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const content = await readFile(this.filePath, "utf8");
      this.records = JSON.parse(content) as PostedDeals;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Historico invalido; iniciando um novo arquivo.", error);
      }
      this.records = {};
    }
    try {
      this.state = { ...emptyState(), ...(JSON.parse(await readFile(this.statePath, "utf8")) as Partial<LocalBotState>) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Estado local invalido; iniciando um novo estado.", error);
      }
      this.state = emptyState();
    }
    this.pruneState();
    await this.prune();
  }

  hasRecentlyPosted(idOrUrl: string, now = Date.now()): boolean {
    const postedAt = this.records[idOrUrl];
    return postedAt !== undefined && now - Date.parse(postedAt) < this.retentionMs;
  }

  async filterUnposted(deals: Deal[]): Promise<Deal[]> {
    return deals.filter(
      (deal) => !this.hasRecentlyPosted(deal.id) && !this.hasRecentlyPosted(deal.originalUrl),
    );
  }

  async markPosted(id: string, originalUrl: string, now = new Date()): Promise<boolean> {
    if (this.hasRecentlyPosted(id, now.getTime()) || this.hasRecentlyPosted(originalUrl, now.getTime())) return false;
    const timestamp = now.toISOString();
    this.records[id] = timestamp;
    this.records[originalUrl] = timestamp;
    await this.persist();
    return true;
  }

  async unmarkPosted(id: string, originalUrl: string): Promise<void> {
    delete this.records[id];
    delete this.records[originalUrl];
    await this.persist();
  }

  async recordPriceHistory(deals: Deal[], now = new Date()): Promise<Map<string, PriceHistoryStats>> {
    const dates = getPriceHistoryDateKeys(now);
    const today = dates[0]!;
    this.state.prices[today] = mergeDailyPrices(this.state.prices[today] ?? {}, deals);
    this.state.prices = Object.fromEntries(Object.entries(this.state.prices).filter(([date]) => dates.includes(date)));
    await this.persistState();
    return calculatePriceHistoryStats(deals, dates, new Map(Object.entries(this.state.prices)));
  }

  async savePublishedOffer(offer: PublishedOffer): Promise<void> {
    this.state.published = [offer, ...this.state.published.filter((item) => item.messageId !== offer.messageId)].slice(0, 100);
    this.pruneState();
    await this.persistState();
  }

  async getPublishedOffers(limit = 100): Promise<PublishedOffer[]> {
    return this.state.published.slice(0, limit);
  }

  async updatePublishedOffer(offer: PublishedOffer): Promise<void> {
    await this.savePublishedOffer(offer);
  }

  async createAlert(userId: string, query: string, maxPrice?: number): Promise<UserAlert> {
    const alert = { id: randomUUID().slice(0, 8), userId, query, maxPrice, createdAt: new Date().toISOString() };
    this.state.alerts.push(alert);
    await this.persistState();
    return alert;
  }

  async listAlerts(userId?: string): Promise<UserAlert[]> {
    return userId ? this.state.alerts.filter((alert) => alert.userId === userId) : [...this.state.alerts];
  }

  async removeAlert(userId: string, alertId: string): Promise<boolean> {
    const previousLength = this.state.alerts.length;
    this.state.alerts = this.state.alerts.filter((alert) => alert.userId !== userId || alert.id !== alertId);
    if (this.state.alerts.length !== previousLength) await this.persistState();
    return this.state.alerts.length !== previousLength;
  }

  async claimAlertNotification(alertId: string, dealId: string): Promise<boolean> {
    const key = `${alertId}:${dealId}`;
    if (this.state.alertNotifications[key]) return false;
    this.state.alertNotifications[key] = new Date().toISOString();
    await this.persistState();
    return true;
  }

  async releaseAlertNotification(alertId: string, dealId: string): Promise<void> {
    delete this.state.alertNotifications[`${alertId}:${dealId}`];
    await this.persistState();
  }

  async recordFeedback(feedbackKey: string, userId: string, type: FeedbackType): Promise<FeedbackCounts> {
    const entry = this.state.feedback[feedbackKey] ?? { votes: {} };
    entry.votes[userId] = type;
    this.state.feedback[feedbackKey] = entry;
    await this.persistState();
    return countFeedback(entry.votes);
  }

  async claimDailySummary(date: string): Promise<boolean> {
    if (this.state.summaries.includes(date)) return false;
    this.state.summaries.push(date);
    await this.persistState();
    return true;
  }

  async releaseDailySummary(date: string): Promise<void> {
    this.state.summaries = this.state.summaries.filter((item) => item !== date);
    await this.persistState();
  }

  async saveProviderHealth(health: ProviderHealth[]): Promise<void> {
    this.state.providerHealth = health;
    await this.persistState();
  }

  async getProviderHealth(): Promise<ProviderHealth[]> {
    return this.state.providerHealth ?? [];
  }

  async syncActiveCouponKeys(keys: string[]): Promise<string[]> {
    const previous = this.state.activeCouponKeys;
    this.state.activeCouponKeys = [...new Set(keys)];
    await this.persistState();
    return previous ? this.state.activeCouponKeys.filter((key) => !previous.includes(key)) : [];
  }

  private async prune(now = Date.now()): Promise<void> {
    this.records = Object.fromEntries(
      Object.entries(this.records).filter(([, value]) => now - Date.parse(value) < this.retentionMs),
    );
    await this.persist();
  }

  /** Evita que alertas, votos e resumos cresçam para sempre. */
  private pruneState(now = Date.now()): void {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1_000;
    this.state.alertNotifications = Object.fromEntries(
      Object.entries(this.state.alertNotifications).filter(([, at]) => Date.parse(at) >= weekAgo),
    );
    this.state.summaries = this.state.summaries.slice(-30);
    const publishedKeys = new Set(this.state.published.map((offer) => offer.feedbackKey));
    this.state.feedback = Object.fromEntries(
      Object.entries(this.state.feedback).filter(([key]) => publishedKeys.has(key)),
    );
  }

  // Escritas serializadas: duas gravacoes simultaneas no mesmo .tmp quebrariam o rename.
  private persist(): Promise<void> {
    return this.enqueueWrite(async () => {
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(this.records, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
  }

  private persistState(): Promise<void> {
    return this.enqueueWrite(async () => {
      const temporaryPath = `${this.statePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(this.state), "utf8");
      await rename(temporaryPath, this.statePath);
    });
  }

  private enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const result = this.writeTail.then(operation, operation);
    this.writeTail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function countFeedback(votes: Record<string, FeedbackType>): FeedbackCounts {
  const counts: FeedbackCounts = { worth: 0, soldout: 0, bad: 0 };
  for (const type of Object.values(votes)) counts[type] += 1;
  return counts;
}
