import type { AffiliateProvider } from "../providers/AffiliateProvider.js";
import type { DealsStore } from "../storage/DealsStore.js";
import type { Deal } from "../types/Deal.js";
import { addAffiliateTag } from "../utils/affiliate.js";
import { TelegramPublisher } from "./TelegramPublisher.js";

export class DealsJob {
  private running = false;

  constructor(
    private readonly providers: AffiliateProvider[],
    private readonly store: DealsStore,
    private readonly publisher: TelegramPublisher,
    private readonly tags: { amazon: string; mercadoLivre: string },
  ) {}

  async run(): Promise<void> {
    if (this.running) {
      console.log("Ciclo anterior ainda em execucao; novo ciclo ignorado.");
      return;
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
        return;
      }

      const affiliateUrl = addAffiliateTag(best.provider, best.originalUrl, this.tags);
      await this.publisher.publish(best, affiliateUrl);
      await this.store.markPosted(best.id, best.originalUrl);
      console.log(`Oferta publicada: ${best.title}`);
    } finally {
      this.running = false;
    }
  }

  async testSend(): Promise<void> {
    const deals = await this.collectDeals();
    const best = selectBestDeal(deals);
    if (!best) {
      console.log("Nenhuma oferta encontrada para teste.");
      return;
    }

    const affiliateUrl = addAffiliateTag(best.provider, best.originalUrl, this.tags);
    await this.publisher.publish(best, affiliateUrl);
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
}

export function selectBestDeal(deals: Deal[]): Deal | undefined {
  return [...deals].sort((a, b) => {
    const discountDifference = (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0);
    if (discountDifference !== 0) return discountDifference;
    return a.currentPrice - b.currentPrice;
  })[0];
}
