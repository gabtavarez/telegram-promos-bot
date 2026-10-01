import { createHash, randomUUID } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import type {
  FeedbackCounts,
  FeedbackType,
  PriceHistoryStats,
  PublishedOffer,
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

  constructor(
    baseUrl: string,
    token: string,
    private readonly retentionSeconds = 7 * 24 * 60 * 60,
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

    return deals.filter((_, index) => values[index * 2] === null && values[index * 2 + 1] === null);
  }

  async markPosted(id: string, originalUrl: string, now = new Date()): Promise<void> {
    const value = now.toISOString();
    const commands = [id, originalUrl].map((identifier) => [
      "SET",
      redisKey(identifier),
      value,
      "EX",
      this.retentionSeconds,
    ]);
    const { data } = await this.client.post<Array<UpstashResponse<string>>>("/pipeline", commands);
    const error = data.find((item) => item.error)?.error;
    if (error) throw new Error(`Upstash Redis: ${error}`);
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
    const offers = await this.getPublishedOffers();
    const updated = [offer, ...offers.filter((item) => item.feedbackKey !== offer.feedbackKey)].slice(0, 100);
    await this.command<string>(["SET", publishedKey(), JSON.stringify(updated)]);
  }

  async getPublishedOffers(limit = 100): Promise<PublishedOffer[]> {
    const value = await this.command<string | null>(["GET", publishedKey()]);
    return parseJson<PublishedOffer[]>(value, []).slice(0, limit);
  }

  async updatePublishedOffer(offer: PublishedOffer): Promise<void> {
    await this.savePublishedOffer(offer);
  }

  async createAlert(userId: string, query: string, maxPrice?: number): Promise<UserAlert> {
    const alerts = await this.listAlerts();
    const alert = { id: randomUUID().slice(0, 8), userId, query, maxPrice, createdAt: new Date().toISOString() };
    alerts.push(alert);
    await this.command<string>(["SET", alertsKey(), JSON.stringify(alerts)]);
    return alert;
  }

  async listAlerts(userId?: string): Promise<UserAlert[]> {
    const value = await this.command<string | null>(["GET", alertsKey()]);
    const alerts = parseJson<UserAlert[]>(value, []);
    return userId ? alerts.filter((alert) => alert.userId === userId) : alerts;
  }

  async removeAlert(userId: string, alertId: string): Promise<boolean> {
    const alerts = await this.listAlerts();
    const updated = alerts.filter((alert) => alert.userId !== userId || alert.id !== alertId);
    if (updated.length === alerts.length) return false;
    await this.command<string>(["SET", alertsKey(), JSON.stringify(updated)]);
    return true;
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

  async recordFeedback(feedbackKey: string, userId: string, type: FeedbackType): Promise<FeedbackCounts> {
    const key = feedbackRedisKey(feedbackKey);
    const value = await this.command<string | null>(["GET", key]);
    const votes = parseJson<Record<string, FeedbackType>>(value, {});
    votes[userId] = type;
    await this.command<string>(["SET", key, JSON.stringify(votes), "EX", 30 * 24 * 60 * 60]);
    return countFeedback(votes);
  }

  async claimDailySummary(date: string): Promise<boolean> {
    const result = await this.command<string | null>(["SET", summaryKey(date), "1", "NX", "EX", 3 * 24 * 60 * 60]);
    return result === "OK";
  }

  private async command<T>(command: Array<string | number>): Promise<T> {
    const { data } = await this.client.post<UpstashResponse<T>>("/", command);
    if (data.error) throw new Error(`Upstash Redis: ${data.error}`);
    if (data.result === undefined) throw new Error("Resposta invalida do Upstash Redis.");
    return data.result;
  }
}

function redisKey(identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex");
  return `telegram-promos:posted:${digest}`;
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
