import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Deal } from "../types/Deal.js";
import type { DealsStore } from "./DealsStore.js";

type PostedDeals = Record<string, string>;

export class PostedDealsStore implements DealsStore {
  private readonly filePath: string;
  private records: PostedDeals = {};

  constructor(filePath: string, private readonly retentionMs = 7 * 24 * 60 * 60 * 1_000) {
    this.filePath = resolve(filePath);
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

  async markPosted(id: string, originalUrl: string, now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    this.records[id] = timestamp;
    this.records[originalUrl] = timestamp;
    await this.persist();
  }

  private async prune(now = Date.now()): Promise<void> {
    this.records = Object.fromEntries(
      Object.entries(this.records).filter(([, value]) => now - Date.parse(value) < this.retentionMs),
    );
    await this.persist();
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.records, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}
