import type { AffiliateProvider } from "../providers/AffiliateProvider.js";
import type { DealsStore } from "../storage/DealsStore.js";
import type { Deal } from "../types/Deal.js";
import { addAffiliateTag } from "../utils/affiliate.js";
import { TelegramPublisher } from "./TelegramPublisher.js";
import type { CouponProvider } from "../coupons/CouponProvider.js";
import { findCouponForDeal } from "../coupons/CouponMatcher.js";
import type { Coupon } from "../coupons/CouponProvider.js";

export class DealsJob {
  private running = false;
  private paused = false;
  private lastRunAt?: Date;
  private lastPublishedAt?: Date;
  private lastPublishedTitle?: string;

  constructor(
    private readonly providers: AffiliateProvider[],
    private readonly store: DealsStore,
    private readonly publisher: TelegramPublisher,
    private readonly tags: { amazon: string; mercadoLivre: string },
    private readonly couponProvider?: CouponProvider,
  ) {}

  async run(ignorePause = false): Promise<JobRunResult> {
    if (this.paused && !ignorePause) {
      console.log("Bot pausado; ciclo ignorado.");
      return "paused";
    }
    if (this.running) {
      console.log("Ciclo anterior ainda em execucao; novo ciclo ignorado.");
      return "already-running";
    }

    this.running = true;
    try {
      const available: Deal[] = [];
      for (const provider of this.providers) {
        try {
          const deals = await provider.getDeals();
          available.push(...(await this.store.filterUnposted(deals)));
          console.log(`${provider.name}: ${deals.length} ofertas encontradas.`);
        } catch (error) {
          console.error(`Falha ao consultar ${provider.name}.`, error);
        }
      }

      const best = selectBestDeal(available);
      if (!best) {
        console.log("Nenhuma oferta nova encontrada neste ciclo.");
        return "no-deal";
      }

      const dealWithCoupon = await this.attachCoupon(best);
      const affiliateUrl = addAffiliateTag(best.provider, best.originalUrl, this.tags);
      await this.publisher.publish(dealWithCoupon, affiliateUrl);
      await this.store.markPosted(best.id, best.originalUrl);
      this.lastPublishedAt = new Date();
      this.lastPublishedTitle = best.title;
      console.log(`Oferta publicada: ${best.title}`);
      return "published";
    } finally {
      this.lastRunAt = new Date();
      this.running = false;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  getStatus(): DealsJobStatus {
    return {
      paused: this.paused,
      running: this.running,
      providers: this.providers.map((provider) => provider.name),
      lastRunAt: this.lastRunAt,
      lastPublishedAt: this.lastPublishedAt,
      lastPublishedTitle: this.lastPublishedTitle,
    };
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    return this.couponProvider?.getActiveCoupons() ?? [];
  }

  async search(query: string, limit = 3): Promise<DealSearchResult[]> {
    const deals = (await this.collectDeals())
      .filter((deal) => matchesDealSearch(deal, query))
      .sort(compareDeals)
      .slice(0, limit);
    const results: DealSearchResult[] = [];

    for (const deal of deals) {
      results.push({
        deal: await this.attachCoupon(deal),
        affiliateUrl: addAffiliateTag(deal.provider, deal.originalUrl, this.tags),
      });
    }
    return results;
  }

  async testSend(): Promise<void> {
    const deals = await this.collectDeals();
    const best = selectBestDeal(deals);
    if (!best) {
      console.log("Nenhuma oferta encontrada para teste.");
      return;
    }

    const dealWithCoupon = await this.attachCoupon(best);
    const affiliateUrl = addAffiliateTag(best.provider, best.originalUrl, this.tags);
    await this.publisher.publish(dealWithCoupon, affiliateUrl);
    console.log(`Oferta de teste publicada: ${best.title}`);
  }

  private async collectDeals(): Promise<Deal[]> {
    const deals: Deal[] = [];
    for (const provider of this.providers) {
      try {
        const providerDeals = await provider.getDeals();
        deals.push(...providerDeals);
        console.log(`${provider.name}: ${providerDeals.length} ofertas encontradas.`);
      } catch (error) {
        console.error(`Falha ao consultar ${provider.name}.`, error);
      }
    }
    return deals;
  }

  private async attachCoupon(deal: Deal): Promise<Deal> {
    if (deal.couponCode || !this.couponProvider) return deal;
    const coupons = await this.couponProvider.getActiveCoupons();
    const coupon = findCouponForDeal(deal, coupons);
    return coupon ? { ...deal, couponCode: coupon.code } : deal;
  }
}

export type JobRunResult = "published" | "no-deal" | "already-running" | "paused";

export interface DealsJobStatus {
  paused: boolean;
  running: boolean;
  providers: string[];
  lastRunAt?: Date;
  lastPublishedAt?: Date;
  lastPublishedTitle?: string;
}

export interface DealSearchResult {
  deal: Deal;
  affiliateUrl: string;
}

export function selectBestDeal(deals: Deal[]): Deal | undefined {
  return [...deals].sort(compareDeals)[0];
}

export function matchesDealSearch(deal: Deal, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  const title = normalizeSearch(deal.title);
  return terms.every((term) => title.includes(term));
}

function compareDeals(a: Deal, b: Deal): number {
  const discountDifference = (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0);
  if (discountDifference !== 0) return discountDifference;
  return a.currentPrice - b.currentPrice;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
