import type { AffiliateProvider } from "../providers/AffiliateProvider.js";
import type { DealsStore } from "../storage/DealsStore.js";
import type { Deal, ProviderName } from "../types/Deal.js";
import { addAffiliateTag } from "../utils/affiliate.js";
import type { AffiliateTags } from "../utils/affiliate.js";
import { getHardwareQualityScore } from "../utils/hardwareFilter.js";
import { TelegramPublisher } from "./TelegramPublisher.js";
import type { CouponProvider } from "../coupons/CouponProvider.js";
import { findCouponForDeal } from "../coupons/CouponMatcher.js";
import type { Coupon } from "../coupons/CouponProvider.js";
import { isDealAvailable } from "./DealAvailabilityChecker.js";

export class DealsJob {
  private running = false;
  private paused = false;
  private lastRunAt?: Date;
  private lastPublishedAt?: Date;
  private lastPublishedTitle?: string;
  private readonly recentProviders: ProviderName[] = [];

  constructor(
    private readonly providers: AffiliateProvider[],
    private readonly store: DealsStore,
    private readonly publisher: TelegramPublisher,
    private readonly tags: AffiliateTags,
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
          const qualifiedDeals = deals.filter(isPromotableDeal);
          available.push(...(await this.store.filterUnposted(qualifiedDeals)));
          console.log(
            `${provider.name}: ${deals.length} ofertas encontradas; ` +
              `${qualifiedDeals.length} promo(s) media(s)/boa(s) aprovada(s).`,
          );
        } catch (error) {
          console.error(`Falha ao consultar ${provider.name}.`, error);
        }
      }

      const best = await selectFirstAvailableDeal(available, this.recentProviders);
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
      this.rememberProvider(best.provider);
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
    const candidates = (await this.collectDeals())
      .filter((deal) => matchesDealSearch(deal, query))
      .filter(isPromotableDeal)
      .sort(compareDeals);
    const deals: Deal[] = [];
    for (const deal of candidates) {
      if (await isDealAvailable(deal)) deals.push(deal);
      if (deals.length >= limit) break;
    }
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
    const best = await selectFirstAvailableDeal(deals.filter(isPromotableDeal), this.recentProviders);
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

  private rememberProvider(provider: ProviderName): void {
    this.recentProviders.unshift(provider);
    if (this.recentProviders.length > 3) this.recentProviders.length = 3;
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

export function selectBestDeal(deals: Deal[], recentProviders: ProviderName[] = []): Deal | undefined {
  return [...deals].sort((a, b) => compareDeals(a, b, recentProviders))[0];
}

async function selectFirstAvailableDeal(
  deals: Deal[],
  recentProviders: ProviderName[] = [],
): Promise<Deal | undefined> {
  for (const deal of [...deals].sort((a, b) => compareDeals(a, b, recentProviders))) {
    if (await isDealAvailable(deal)) return deal;
  }
  return undefined;
}

export function isPromotableDeal(deal: Deal): boolean {
  const qualityScore = getHardwareQualityScore(deal.title);
  if (qualityScore < 6) return false;

  if (deal.couponCode) return true;
  if (deal.discountPercentage !== undefined) return deal.discountPercentage >= 15;

  // Alguns feeds, especialmente o da Awin, nao informam o preco anterior.
  // Nesses casos, somente produtos com varios sinais fortes de qualidade entram.
  return qualityScore >= 8;
}

export function matchesDealSearch(deal: Deal, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  const title = normalizeSearch(deal.title);
  return terms.every((term) => title.includes(term));
}

function compareDeals(a: Deal, b: Deal, recentProviders: ProviderName[] = []): number {
  const scoreDifference = getDealSelectionScore(b, recentProviders) - getDealSelectionScore(a, recentProviders);
  if (scoreDifference !== 0) return scoreDifference;
  return a.currentPrice - b.currentPrice;
}

export function getDealSelectionScore(deal: Deal, recentProviders: ProviderName[] = []): number {
  const quality = Math.max(0, getHardwareQualityScore(deal.title));
  const discount = Math.min(deal.discountPercentage ?? 0, 60);
  const couponBonus = deal.couponCode ? 8 : 0;
  const mostRecentPenalty = recentProviders[0] === deal.provider ? 20 : 0;
  const recentPenalty = !mostRecentPenalty && recentProviders.slice(1).includes(deal.provider) ? 8 : 0;
  return quality * 5 + discount + couponBonus - mostRecentPenalty - recentPenalty;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
