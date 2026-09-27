import { createHash } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import type { DealsStore } from "./DealsStore.js";

interface UpstashResponse<T> {
  result?: T;
  error?: string;
}

export class UpstashPostedDealsStore implements DealsStore {
  private readonly client: AxiosInstance;

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
