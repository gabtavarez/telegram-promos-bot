import * as cheerio from "cheerio";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { http } from "../utils/http.js";
import { calculateDiscount, parseBrlPrice } from "../utils/price.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

export class KabumProvider implements AffiliateProvider {
  readonly name = "Kabum";

  constructor(private readonly dealsUrl: string) {}

  async getDeals(): Promise<Deal[]> {
    try {
      const { data } = await http.get<string>(this.dealsUrl);
      const $ = cheerio.load(data);
      const deals: Deal[] = [];

      $('a[href*="/produto/"]').each((_, element) => {
        const card = $(element).closest("article, div, li");
        const href = $(element).attr("href");
        const title = normalizeText(
          card.find('[class*="name"], [class*="Name"], h2, h3').first().text() || $(element).text(),
        );
        const imageUrl = card.find("img").first().attr("src") || card.find("img").first().attr("data-src");
        const prices = extractPrices(card.text());

        if (!href || !title || !imageUrl || !prices.currentPrice) return;
        if (!isPcHardwareDeal(title)) return;

        const originalUrl = new URL(href, "https://www.kabum.com.br");
        const itemId = originalUrl.pathname.match(/\/produto\/(\d+)/i)?.[1] ?? originalUrl.pathname;
        originalUrl.search = "";

        deals.push({
          id: `kabum:${itemId}`,
          provider: "kabum",
          title,
          originalUrl: originalUrl.toString(),
          imageUrl,
          currentPrice: prices.currentPrice,
          previousPrice: prices.previousPrice,
          discountPercentage: calculateDiscount(prices.currentPrice, prices.previousPrice),
        });
      });

      return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
    } catch (error) {
      console.error("Falha ao consultar Kabum.", error);
      return [];
    }
  }
}

function extractPrices(text: string): { currentPrice?: number; previousPrice?: number } {
  const matches = [...text.matchAll(/R\$\s*[\d.]+,\d{2}/g)]
    .map((match) => parseBrlPrice(match[0]))
    .filter((value): value is number => Boolean(value));

  if (matches.length === 0) return {};

  const currentPrice = Math.min(...matches);
  const previousPrice = matches.find((price) => price > currentPrice);
  return { currentPrice, previousPrice };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
