import { createHash, randomUUID } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
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

interface UpstashResponse<T> {
  result?: T;
  error?: string;
}

export class UpstashPostedDealsStore implements DealsStore {
  private readonly client: AxiosInstance;
  private cachedPriceDates: string[] = [];
  private cachedPriceSnapshots = new Map<string, DailyPrices>();
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(
    baseUrl: string,
    token: string,
    private readonly retentionSeconds = 7 * 24 * 60 * 60,
    private readonly repostCooldownMs = 12 * 60 * 60 * 1_000,
  ) {
    this.client = axios.create({
      baseURL: baseUrl.replace(/\/$/, ""),
      timeout: 10_000,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  }

  async initialize(): Promise<void> {
    await this.command<string>(["PING"]);
    console.log("Historico conectado ao Upstash Redis.");
  }

  async filterUnposted(deals: Deal[]): Promise<Deal[]> {
    if (deals.length === 0) return [];

    const keys = deals.flatMap((deal) => [redisKey(deal.id), redisKey(deal.originalUrl)]);
    const values = await this.command<Array<string | null>>(["MGET", ...keys]);

    const now = Date.now();
    return deals.filter((_, index) =>
      !wasPostedRecently(values[index * 2], now, this.repostCooldownMs) &&
      !wasPostedRecently(values[index * 2 + 1], now, this.repostCooldownMs),
    );
  }

  async markPosted(id: string, originalUrl: string, now = new Date()): Promise<boolean> {
    const value = now.toISOString();
    const cooldownSeconds = Math.max(1, Math.ceil(this.repostCooldownMs / 1_000));
    const script = [
      "if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end",
      "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
      "redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])",
      "redis.call('SET', KEYS[3], ARGV[1], 'EX', ARGV[3])",
      "redis.call('SET', KEYS[4], ARGV[1], 'EX', ARGV[3])",
      "return 1",
    ].join("\n");
    const claimed = await this.command<number>([
      "EVAL",
      script,
      4,
      claimKey(id),
      claimKey(originalUrl),
      redisKey(id),
      redisKey(originalUrl),
      value,
      cooldownSeconds,
      this.retentionSeconds,
    ]);
    return claimed === 1;
  }

  async unmarkPosted(id: string, originalUrl: string): Promise<void> {
    await this.command<number>([
      "DEL",
      claimKey(id),
      claimKey(originalUrl),
      redisKey(id),
      redisKey(originalUrl),
    ]);
  }

  async recordPriceHistory(deals: Deal[], now = new Date()): Promise<Map<string, PriceHistoryStats>> {
    if (deals.length === 0) return new Map();
    const dates = getPriceHistoryDateKeys(now);
    if (this.cachedPriceDates[0] !== dates[0]) {
      const keys = dates.map((date) => priceHistoryKey(date));
      const values = await this.command<Array<string | null>>(["MGET", ...keys]);
      this.cachedPriceSnapshots = new Map();
      dates.forEach((date, index) => this.cachedPriceSnapshots.set(date, parseJson(values[index], {})));
      this.cachedPriceDates = dates;
    }

    const today = dates[0]!;
    const currentToday = this.cachedPriceSnapshots.get(today) ?? {};
    const mergedToday = mergeDailyPrices(currentToday, deals);
    this.cachedPriceSnapshots.set(today, mergedToday);
    if (JSON.stringify(mergedToday) !== JSON.stringify(currentToday)) {
      await this.command<string>([
        "SET",
        priceHistoryKey(today),
        JSON.stringify(mergedToday),
        "EX",
        100 * 24 * 60 * 60,
      ]);
    }
    return calculatePriceHistoryStats(deals, dates, this.cachedPriceSnapshots);
  }

  async savePublishedOffer(offer: PublishedOffer): Promise<void> {
    await this.withMutationLock(async () => {
      const offers = await this.getPublishedOffers();
      const updated = [offer, ...offers.filter((item) => item.messageId !== offer.messageId)].slice(0, 100);
      await this.command<string>(["SET", publishedKey(), JSON.stringify(updated)]);
    });
  }

  async getPublishedOffers(limit = 100): Promise<PublishedOffer[]> {
    const value = await this.command<string | null>(["GET", publishedKey()]);
    return parseJson<PublishedOffer[]>(value, []).slice(0, limit);
  }

  async updatePublishedOffer(offer: PublishedOffer): Promise<void> {
    await this.savePublishedOffer(offer);
  }

  async createAlert(userId: string, query: string, maxPrice?: number): Promise<UserAlert> {
    return this.withMutationLock(async () => {
      const alerts = await this.listAlerts();
      const alert = { id: randomUUID().slice(0, 8), userId, query, maxPrice, createdAt: new Date().toISOString() };
      alerts.push(alert);
      await this.command<string>(["SET", alertsKey(), JSON.stringify(alerts)]);
      return alert;
    });
  }

  async listAlerts(userId?: string): Promise<UserAlert[]> {
    const value = await this.command<string | null>(["GET", alertsKey()]);
    const alerts = parseJson<UserAlert[]>(value, []);
    return userId ? alerts.filter((alert) => alert.userId === userId) : alerts;
  }

  async removeAlert(userId: string, alertId: string): Promise<boolean> {
    return this.withMutationLock(async () => {
      const alerts = await this.listAlerts();
      const updated = alerts.filter((alert) => alert.userId !== userId || alert.id !== alertId);
      if (updated.length === alerts.length) return false;
      await this.command<string>(["SET", alertsKey(), JSON.stringify(updated)]);
      return true;
    });
  }

  async claimAlertNotification(alertId: string, dealId: string): Promise<boolean> {
    const result = await this.command<string | null>([
      "SET",
      alertNotificationKey(alertId, dealId),
      "1",
      "NX",
      "EX",
      this.retentionSeconds,
    ]);
    return result === "OK";
  }

  async releaseAlertNotification(alertId: string, dealId: string): Promise<void> {
    await this.command<number>(["DEL", alertNotificationKey(alertId, dealId)]);
  }

  async recordFeedback(feedbackKey: string, userId: string, type: FeedbackType): Promise<FeedbackCounts> {
    return this.withMutationLock(async () => {
      const key = feedbackRedisKey(feedbackKey);
      const value = await this.command<string | null>(["GET", key]);
      const votes = parseJson<Record<string, FeedbackType>>(value, {});
      votes[userId] = type;
      await this.command<string>(["SET", key, JSON.stringify(votes), "EX", 30 * 24 * 60 * 60]);
      return countFeedback(votes);
    });
  }

  async claimDailySummary(date: string): Promise<boolean> {
    const result = await this.command<string | null>(["SET", summaryKey(date), "1", "NX", "EX", 3 * 24 * 60 * 60]);
    return result === "OK";
  }

  async releaseDailySummary(date: string): Promise<void> {
    await this.command<number>(["DEL", summaryKey(date)]);
  }

  async saveProviderHealth(health: ProviderHealth[]): Promise<void> {
    await this.command<string>(["SET", providerHealthKey(), JSON.stringify(health)]);
  }

  async getProviderHealth(): Promise<ProviderHealth[]> {
    const value = await this.command<string | null>(["GET", providerHealthKey()]);
    return parseJson<ProviderHealth[]>(value, []);
  }

  async syncActiveCouponKeys(keys: string[]): Promise<string[]> {
    return this.withMutationLock(async () => {
      const value = await this.command<string | null>(["GET", activeCouponKeysKey()]);
      const previous = value === null ? undefined : parseJson<string[]>(value, []);
      const unique = [...new Set(keys)];
      await this.command<string>(["SET", activeCouponKeysKey(), JSON.stringify(unique)]);
      return previous ? unique.filter((key) => !previous.includes(key)) : [];
    });
  }

  private async command<T>(command: Array<string | number>): Promise<T> {
    const { data } = await this.client.post<UpstashResponse<T>>("/", command);
    if (data.error) throw new Error(`Upstash Redis: ${data.error}`);
    if (data.result === undefined) throw new Error("Resposta invalida do Upstash Redis.");
    return data.result;
  }

  private withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function redisKey(identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex");
  return `telegram-promos:posted:${digest}`;
}

function claimKey(identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex");
  return `telegram-promos:posting:${digest}`;
}

function priceHistoryKey(date: string): string {
  return `telegram-promos:prices:${date}`;
}

function publishedKey(): string {
  return "telegram-promos:published";
}

function alertsKey(): string {
  return "telegram-promos:alerts";
}

function alertNotificationKey(alertId: string, dealId: string): string {
  return `telegram-promos:alert-sent:${alertId}:${createHash("sha256").update(dealId).digest("hex")}`;
}

function feedbackRedisKey(feedbackKey: string): string {
  return `telegram-promos:feedback:${feedbackKey}`;
}

function summaryKey(date: string): string {
  return `telegram-promos:summary:${date}`;
}

function providerHealthKey(): string {
  return "telegram-promos:provider-health";
}

function activeCouponKeysKey(): string {
  return "telegram-promos:active-coupons";
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function countFeedback(votes: Record<string, FeedbackType>): FeedbackCounts {
  const counts: FeedbackCounts = { worth: 0, soldout: 0, bad: 0 };
  for (const type of Object.values(votes)) counts[type] += 1;
  return counts;
}

function wasPostedRecently(value: string | null | undefined, now: number, cooldownMs: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || now - timestamp < cooldownMs;
}
