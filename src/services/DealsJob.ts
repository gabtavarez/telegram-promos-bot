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
import type { FeedbackCounts, FeedbackType, PriceHistoryStats, PublishedOffer, UserAlert } from "../types/BotState.js";
import { checkDealAvailability, isDealAvailable } from "./DealAvailabilityChecker.js";
import { enrichDealPayment } from "./DealPaymentEnricher.js";
import { getVerifiedDiscount, normalizeDealPricing } from "../utils/price.js";

export class DealsJob {
  private running = false;
  private paused = false;
  private lastRunAt?: Date;
  private lastPublishedAt?: Date;
  private lastPublishedTitle?: string;
  private readonly recentProviders: ProviderName[] = [];
  private readonly recentCategories: string[] = [];
  private cycleCount = 0;
  private legacyMessagesUpdated = false;

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
      if (!this.legacyMessagesUpdated) {
        try {
          await this.updateLegacyMessages();
          this.legacyMessagesUpdated = true;
        } catch (error) {
          console.warn("Nao foi possivel atualizar publicacoes antigas neste ciclo.", error);
        }
      }
      const discovered = await this.attachCoupons(await this.collectDeals());
      const qualityCandidates = discovered.filter(isQualityCandidate);
      const history = await this.recordPriceHistorySafely(qualityCandidates);
      const enriched = qualityCandidates.map((deal) => withPriceHistory(deal, history.get(deal.id)));
      const qualifiedDeals = enriched.filter(isPromotableDeal);
      const available = await this.store.filterUnposted(qualifiedDeals);
      console.log(
        `Filtro final: ${qualityCandidates.length} produto(s) de qualidade; ` +
          `${qualifiedDeals.length} promo(s) media(s)/boa(s); ` +
          `${available.length} nova(s) apos o historico de 12h.`,
      );
      logProviderAvailability(qualifiedDeals, available);

      await this.notifyAlerts(qualifiedDeals);
      this.cycleCount += 1;
      if (this.cycleCount % 6 === 0) await this.monitorPublishedOffers(enriched);

      const best = await selectFirstAvailableDeal(available, this.recentProviders, this.recentCategories);
      if (!best) {
        console.log("Nenhuma oferta nova encontrada neste ciclo.");
        return "no-deal";
      }

      const finalDeal = await enrichDealPayment(best);
      const dealWithCoupon = withPriceHistory(await this.attachCoupon(finalDeal), best.priceHistory);
      const affiliateUrl = addAffiliateTag(best.provider, best.originalUrl, this.tags);
      if (!(await this.store.markPosted(best.id, best.originalUrl))) {
        console.log("Oferta escolhida ja foi reservada por outra instancia.");
        return "no-deal";
      }
      let message;
      try {
        message = await this.publisher.publish(dealWithCoupon, affiliateUrl);
      } catch (error) {
        await this.store.unmarkPosted(best.id, best.originalUrl).catch(() => undefined);
        throw error;
      }
      try {
        await this.store.savePublishedOffer({
          deal: dealWithCoupon,
          affiliateUrl,
          messageId: message.messageId,
          messageType: message.messageType,
          feedbackKey: message.feedbackKey,
          publishedAt: new Date().toISOString(),
          status: "active",
        });
      } catch (error) {
        // A publicacao ja existe no Telegram e permanece marcada para impedir
        // duplicacao. O proximo ciclo nao deve reenviar a mesma oferta.
        console.error("Oferta publicada, mas nao foi possivel salvar seu monitoramento.", error);
      }
      this.lastPublishedAt = new Date();
      this.lastPublishedTitle = best.title;
      this.rememberProvider(best.provider);
      this.rememberCategory(best.title);
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

  getCouponIntegrationStatus(): CouponIntegrationStatus {
    return {
      enabled: Boolean(this.couponProvider),
      provider: this.couponProvider?.name,
      error: this.couponProvider?.getLastError?.(),
    };
  }

  async search(query: string, limit = 3): Promise<DealSearchResult[]> {
    const collected = await this.attachCoupons(await this.collectDeals());
    const qualityCandidates = collected.filter(isQualityCandidate);
    const history = await this.recordPriceHistorySafely(qualityCandidates);
    const candidates = qualityCandidates
      .map((deal) => withPriceHistory(deal, history.get(deal.id)))
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
        deal: await this.attachCoupon(await enrichDealPayment(deal)),
        affiliateUrl: addAffiliateTag(deal.provider, deal.originalUrl, this.tags),
      });
    }
    return results;
  }

  async testSend(): Promise<void> {
    const deals = (await this.attachCoupons(await this.collectDeals())).filter(isQualityCandidate);
    const history = await this.recordPriceHistorySafely(deals);
    const enriched = deals.map((deal) => withPriceHistory(deal, history.get(deal.id)));
    const best = await selectFirstAvailableDeal(
      enriched.filter(isPromotableDeal),
      this.recentProviders,
      this.recentCategories,
    );
    if (!best) {
      console.log("Nenhuma oferta encontrada para teste.");
      return;
    }

    const finalDeal = await enrichDealPayment(best);
    const dealWithCoupon = withPriceHistory(await this.attachCoupon(finalDeal), best.priceHistory);
    const affiliateUrl = addAffiliateTag(best.provider, best.originalUrl, this.tags);
    await this.publisher.publish(dealWithCoupon, affiliateUrl);
    console.log(`Oferta de teste publicada: ${best.title}`);
  }

  async createAlert(userId: string, query: string, maxPrice?: number): Promise<UserAlert> {
    return this.store.createAlert(userId, query, maxPrice);
  }

  async listAlerts(userId: string): Promise<UserAlert[]> {
    return this.store.listAlerts(userId);
  }

  async removeAlert(userId: string, alertId: string): Promise<boolean> {
    return this.store.removeAlert(userId, alertId);
  }

  async recordFeedback(feedbackKey: string, userId: string, type: FeedbackType): Promise<FeedbackResult> {
    const counts = await this.store.recordFeedback(feedbackKey, userId, type);
    const offer = (await this.store.getPublishedOffers()).find((item) => item.feedbackKey === feedbackKey);
    if (offer && type === "soldout" && counts.soldout >= 3 && offer.status !== "soldout") {
      void this.verifyReportedSoldOut(offer).catch((error) =>
        console.warn(`Falha ao verificar oferta reportada: ${offer.deal.title}`, error),
      );
    }
    return { counts, offer };
  }

  async publishDailySummary(now = new Date()): Promise<boolean> {
    const cutoff = now.getTime() - 24 * 60 * 60 * 1_000;
    const offers = (await this.store.getPublishedOffers())
      .filter((offer) => offer.status !== "soldout" && Date.parse(offer.publishedAt) >= cutoff)
      .sort((a, b) => compareDeals(a.deal, b.deal))
      .slice(0, 5);
    if (offers.length === 0) return false;

    const date = formatDateKey(now);
    if (!(await this.store.claimDailySummary(date))) return false;
    try {
      await this.publisher.publishDailySummary(offers);
    } catch (error) {
      await this.store.releaseDailySummary(date).catch(() => undefined);
      throw error;
    }
    console.log(`Resumo diario publicado com ${offers.length} oferta(s).`);
    return true;
  }

  private async collectDeals(): Promise<Deal[]> {
    const deals: Deal[] = [];
    for (const provider of this.providers) {
      try {
        const providerDeals = await provider.getDeals();
        deals.push(...providerDeals.map(normalizeDealPricing));
        console.log(`${provider.name}: ${providerDeals.length} ofertas encontradas.`);
      } catch (error) {
        console.error(`Falha ao consultar ${provider.name}.`, error);
      }
    }
    return deals;
  }

  private async attachCoupon(deal: Deal): Promise<Deal> {
    if (deal.couponCode && (!deal.couponEndsAt || Date.parse(deal.couponEndsAt) > Date.now())) return deal;
    const withoutExpiredCoupon = deal.couponEndsAt && Date.parse(deal.couponEndsAt) <= Date.now()
      ? { ...deal, couponCode: undefined, couponEndsAt: undefined, couponVerified: undefined }
      : deal;
    if (!this.couponProvider) return withoutExpiredCoupon;
    const coupons = await this.couponProvider.getActiveCoupons();
    const coupon = findCouponForDeal(withoutExpiredCoupon, coupons);
    return coupon ? applyCoupon(withoutExpiredCoupon, coupon) : withoutExpiredCoupon;
  }

  private async attachCoupons(deals: Deal[]): Promise<Deal[]> {
    if (!this.couponProvider) return deals;
    const coupons = await this.couponProvider.getActiveCoupons();
    if (coupons.length === 0) return deals;
    return deals.map((deal) => {
      if (deal.couponCode && (!deal.couponEndsAt || Date.parse(deal.couponEndsAt) > Date.now())) return deal;
      const coupon = findCouponForDeal(deal, coupons);
      if (coupon) return applyCoupon(deal, coupon);
      return deal.couponEndsAt && Date.parse(deal.couponEndsAt) <= Date.now()
        ? { ...deal, couponCode: undefined, couponEndsAt: undefined, couponVerified: undefined }
        : deal;
    });
  }

  private async recordPriceHistorySafely(deals: Deal[]) {
    try {
      return await this.store.recordPriceHistory(deals);
    } catch (error) {
      console.warn("Nao foi possivel atualizar o historico de precos neste ciclo.", error);
      return new Map();
    }
  }

  private async notifyAlerts(deals: Deal[]): Promise<void> {
    const alerts = await this.store.listAlerts();
    let sent = 0;
    for (const alert of alerts) {
      if (sent >= 20) break;
      const deal = selectBestDeal(deals.filter((candidate) =>
        matchesDealSearch(candidate, alert.query) &&
        (alert.maxPrice === undefined || candidate.currentPrice <= alert.maxPrice),
      ));
      if (!deal || !(await isDealAvailable(deal))) continue;
      if (!(await this.store.claimAlertNotification(alert.id, deal.id))) continue;
      const finalDeal = await enrichDealPayment(deal);
      const affiliateUrl = addAffiliateTag(deal.provider, deal.originalUrl, this.tags);
      try {
        await this.publisher.sendPrivateAlert(alert.userId, finalDeal, affiliateUrl);
        sent += 1;
      } catch (error) {
        await this.store.releaseAlertNotification(alert.id, deal.id).catch(() => undefined);
        console.warn(`Falha ao enviar alerta ${alert.id} para o usuario.`, error);
      }
    }
    if (sent > 0) console.log(`${sent} alerta(s) personalizado(s) enviado(s).`);
  }

  private async monitorPublishedOffers(currentDeals: Deal[]): Promise<void> {
    const currentById = new Map(currentDeals.map((deal) => [deal.id, deal]));
    const cutoff = Date.now() - 48 * 60 * 60 * 1_000;
    const active = (await this.store.getPublishedOffers(30))
      .filter((offer) => offer.status !== "soldout" && Date.parse(offer.publishedAt) >= cutoff)
      .slice(0, 8);

    for (let index = 0; index < active.length; index += 4) {
      const batch = active.slice(index, index + 4);
      const checked = await Promise.all(batch.map(async (offer) => ({
        offer,
        availability: await checkDealAvailability(offer.deal),
      })));
      for (const { offer, availability } of checked) {
        let updated = offer;
        const current = currentById.get(offer.deal.id);
        const refreshedBase = current ? await enrichDealPayment(current) : undefined;
        const refreshedDeal = refreshedBase
          ? withPriceHistory(await this.attachCoupon({
              ...refreshedBase,
              couponCode: undefined,
              couponEndsAt: undefined,
              couponVerified: undefined,
            }), current?.priceHistory)
          : undefined;
        const priceChanged = refreshedDeal && Math.abs(refreshedDeal.currentPrice - offer.deal.currentPrice) >= 0.01;
        const couponChanged = refreshedDeal && (
          refreshedDeal.couponCode !== offer.deal.couponCode ||
          refreshedDeal.couponEndsAt !== offer.deal.couponEndsAt
        );
        if (refreshedDeal && (priceChanged || couponChanged)) {
          updated = {
            ...updated,
            deal: refreshedDeal,
            status: priceChanged ? "price-changed" : "active",
          };
        } else if (!current && offer.deal.couponEndsAt && Date.parse(offer.deal.couponEndsAt) <= Date.now()) {
          updated = {
            ...updated,
            deal: withPriceHistory({
              ...offer.deal,
              couponCode: undefined,
              couponEndsAt: undefined,
              couponVerified: undefined,
            }, offer.deal.priceHistory),
          };
        }

        if (availability === "unavailable") updated = { ...updated, status: "soldout" };
        if (updated !== offer) {
          try {
            await this.publisher.editPublishedOffer(updated);
            await this.store.updatePublishedOffer(updated);
          } catch (error) {
            console.warn(`Falha ao atualizar oferta publicada: ${offer.deal.title}`, error);
          }
        }
      }
    }
  }

  private async verifyReportedSoldOut(offer: PublishedOffer): Promise<void> {
    if (await checkDealAvailability(offer.deal) !== "unavailable") return;
    const updated = { ...offer, status: "soldout" as const };
    await this.publisher.editPublishedOffer(updated);
    await this.store.updatePublishedOffer(updated);
  }

  private async updateLegacyMessages(): Promise<void> {
    const offers = (await this.store.getPublishedOffers(20)).slice(0, 20);
    for (let index = 0; index < offers.length; index += 4) {
      await Promise.all(offers.slice(index, index + 4).map((offer) =>
        this.publisher.editPublishedOffer(offer).catch(() => undefined),
      ));
    }
    if (offers.length > 0) {
      console.log(`${offers.length} publicacao(oes) recente(s) atualizada(s) para o formato sem score.`);
    }
  }

  private rememberProvider(provider: ProviderName): void {
    this.recentProviders.unshift(provider);
    if (this.recentProviders.length > 3) this.recentProviders.length = 3;
  }

  private rememberCategory(title: string): void {
    this.recentCategories.unshift(getDealCategory(title));
    if (this.recentCategories.length > 4) this.recentCategories.length = 4;
  }
}

export interface CouponIntegrationStatus {
  enabled: boolean;
  provider?: string;
  error?: string;
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

export interface FeedbackResult {
  counts: FeedbackCounts;
  offer?: PublishedOffer;
}

export function selectBestDeal(deals: Deal[], recentProviders: ProviderName[] = []): Deal | undefined {
  return [...deals].sort((a, b) => compareDeals(a, b, recentProviders))[0];
}

async function selectFirstAvailableDeal(
  deals: Deal[],
  recentProviders: ProviderName[] = [],
  recentCategories: string[] = [],
): Promise<Deal | undefined> {
  for (const deal of [...deals].sort((a, b) => compareDeals(a, b, recentProviders, recentCategories))) {
    if (await isDealAvailable(deal)) return deal;
  }
  return undefined;
}

export function isPromotableDeal(deal: Deal): boolean {
  const qualityScore = getHardwareQualityScore(deal.title);
  if (qualityScore < 6) return false;

  if (deal.couponCode && deal.couponVerified && qualityScore >= 6) return true;
  if ((getVerifiedDiscount(deal) ?? 0) >= 15) return true;

  if ((deal.priceHistory?.observationDays ?? 0) >= 3) {
    return (deal.priceHistory?.percentBelow30DayAverage ?? 0) >= 10;
  }

  return false;
}

export function isQualityCandidate(deal: Deal): boolean {
  return getHardwareQualityScore(deal.title) >= 6;
}

export function matchesDealSearch(deal: Deal, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  const title = normalizeSearch(deal.title);
  return terms.every((term) => title.includes(term));
}

function compareDeals(
  a: Deal,
  b: Deal,
  recentProviders: ProviderName[] = [],
  recentCategories: string[] = [],
): number {
  const scoreDifference = getDealSelectionScore(b, recentProviders, recentCategories) -
    getDealSelectionScore(a, recentProviders, recentCategories);
  if (scoreDifference !== 0) return scoreDifference;
  return a.currentPrice - b.currentPrice;
}

export function getDealSelectionScore(
  deal: Deal,
  recentProviders: ProviderName[] = [],
  recentCategories: string[] = [],
): number {
  const quality = Math.max(0, getHardwareQualityScore(deal.title));
  const discount = Math.min(getVerifiedDiscount(deal) ?? 0, 60);
  const historyBonus = Math.max(0, Math.min(deal.priceHistory?.percentBelow30DayAverage ?? 0, 20));
  const couponBonus = deal.couponCode && deal.couponVerified ? 8 : 0;
  const providerBonus = deal.provider === "kabum" ? 14 : 0;
  const categoryBonus = getCategorySelectionBonus(deal.title);
  const mostRecentPenalty = recentProviders[0] === deal.provider ? 20 : 0;
  const recentPenalty = !mostRecentPenalty && recentProviders.slice(1).includes(deal.provider) ? 8 : 0;
  const category = getDealCategory(deal.title);
  const mostRecentCategoryPenalty = recentCategories[0] === category ? 24 : 0;
  const recentCategoryPenalty = !mostRecentCategoryPenalty && recentCategories.slice(1).includes(category) ? 10 : 0;
  return quality * 5 +
    discount +
    historyBonus +
    couponBonus +
    providerBonus +
    categoryBonus -
    mostRecentPenalty -
    recentPenalty -
    mostRecentCategoryPenalty -
    recentCategoryPenalty;
}

function withPriceHistory(deal: Deal, priceHistory?: PriceHistoryStats): Deal {
  return priceHistory ? { ...deal, priceHistory } : { ...deal };
}

function applyCoupon(deal: Deal, coupon: Coupon): Deal {
  return {
    ...deal,
    couponCode: coupon.code,
    couponEndsAt: coupon.endsAt.toISOString(),
    couponVerified: Boolean(coupon.eligibleItemIds?.some((id) => deal.id.includes(id))) ||
      /(?:todo\s+(?:o\s+)?site|site\s+inteiro|qualquer\s+produto)/i.test(coupon.terms ?? ""),
  };
}

function getDealCategory(title: string): string {
  const normalized = normalizeSearch(title);
  if (/\b(?:rtx|gtx|radeon|geforce|rx\s?\d{3,4}|placa de video)\b/.test(normalized)) return "gpu";
  if (/\b(?:processador|ryzen|intel core|core i[3579])\b/.test(normalized)) return "cpu";
  if (/\b(?:monitor|ultrawide|144hz|165hz|180hz|240hz)\b/.test(normalized)) return "monitor";
  if (/\b(?:ssd|nvme|m\.2|hd externo)\b/.test(normalized)) return "armazenamento";
  if (/\b(?:water cooler|aio|liquid cooler|air cooler|cpu cooler)\b/.test(normalized)) return "cooler";
  if (/\b(?:teclado|mouse|headset|fone gamer)\b/.test(normalized)) return "periferico";
  if (/\b(?:smartphone|celular|iphone|galaxy)\b/.test(normalized)) return "celular";
  if (/\b(?:notebook|laptop)\b/.test(normalized)) return "notebook";
  if (/\b(?:smart tv|televisor|tv)\b/.test(normalized)) return "tv";
  return "outros";
}

function getCategorySelectionBonus(title: string): number {
  const normalized = normalizeSearch(title);
  if (/\b(?:rtx|gtx|radeon|geforce|rx\s?\d{3,4}|placa de video)\b/.test(normalized)) return 24;
  if (/\b(?:processador|ryzen|intel core|core i[3579])\b/.test(normalized)) return 22;
  if (/\b(?:monitor|ultrawide|144hz|165hz|180hz|240hz)\b/.test(normalized)) return 20;
  if (/\b(?:ssd|nvme|m\.2)\b/.test(normalized)) return 18;
  if (/\b(?:memoria ram|ddr4|ddr5)\b/.test(normalized)) return 16;
  if (/\b(?:fonte|80 plus|psu)\b/.test(normalized)) return 15;
  if (/\b(?:gabinete|mid tower|mini itx|aquario)\b/.test(normalized)) return 12;
  if (/\b(?:water cooler|aio|liquid cooler)\b/.test(normalized)) {
    return /\b(?:lcd|display|tela|screen)\b/.test(normalized) ? 18 : 8;
  }
  if (/\b(?:air cooler|cpu cooler|refrigerador cpu)\b/.test(normalized)) return -14;
  if (/\b(?:teclado|mouse|headset|fone gamer)\b/.test(normalized)) return 10;
  if (/\b(?:notebook|laptop)\b/.test(normalized)) return 10;
  if (/\b(?:smartphone|celular|iphone|galaxy)\b/.test(normalized)) return 8;
  if (/\b(?:smart tv|televisor|tv)\b/.test(normalized)) return 7;
  return 0;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function logProviderAvailability(qualified: Deal[], available: Deal[]): void {
  const providers = [...new Set(qualified.map((deal) => deal.provider))];
  if (providers.length === 0) return;
  const summary = providers.map((provider) => {
    const approved = qualified.filter((deal) => deal.provider === provider).length;
    const fresh = available.filter((deal) => deal.provider === provider).length;
    return `${provider}: ${fresh}/${approved} nova(s)`;
  });
  console.log(`Disponibilidade por loja: ${summary.join("; ")}.`);
}
