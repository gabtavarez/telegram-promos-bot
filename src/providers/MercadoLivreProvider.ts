import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { http } from "../utils/http.js";
import { calculateDiscount, parseBrlPrice } from "../utils/price.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

export class MercadoLivreProvider implements AffiliateProvider {
  readonly name = "Mercado Livre";

  constructor(private readonly dealsUrl: string) {}

  async getDeals(): Promise<Deal[]> {
    const { data } = await http.get<string>(this.dealsUrl);
    const $ = cheerio.load(data);
    const deals: Deal[] = [];

    $(".promotion-item, .poly-card, .ui-search-result").each((_, element) => {
      const card = $(element);
      const link = card.find("a[href]").filter((_, anchor) => {
        const href = $(anchor).attr("href") ?? "";
        return href.includes("mercadolivre.com.br") || href.startsWith("/");
      }).first();
      const href = link.attr("href");
      const title = card
        .find(".promotion-item__title, .poly-component__title, .ui-search-item__title")
        .first()
        .text()
        .trim();
      const image = card.find("img").first();
      const imageUrl = image.attr("data-src") || image.attr("src");
      const currentPrice = readPrice(card, [
        ".andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction",
        ".poly-price__current .andes-money-amount__fraction",
      ]);
      const previousPrice = readPrice(card, [
        ".andes-money-amount--previous .andes-money-amount__fraction",
        ".andes-money-amount__discount + .andes-money-amount .andes-money-amount__fraction",
      ]);

      if (!href || !title || !imageUrl || !currentPrice) return;
      if (!isPcHardwareDeal(title)) return;

      const originalUrl = new URL(href, "https://www.mercadolivre.com.br");
      const itemId = originalUrl.pathname.match(/(MLB-?\d+)/i)?.[1]?.replace("-", "") ?? originalUrl.pathname;
      const couponCode = extractCouponCode(card.text());
      originalUrl.search = "";
      deals.push({
        id: `mercado-livre:${itemId}`,
        provider: "mercado-livre",
        title,
        originalUrl: originalUrl.toString(),
        imageUrl,
        currentPrice,
        previousPrice,
        discountPercentage: calculateDiscount(currentPrice, previousPrice),
        couponCode,
      });
    });

    return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
  }
}

function extractCouponCode(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(/\b(?:cupom|coupon|c[oó]digo)\b[:\s-]*([A-Z0-9][A-Z0-9_-]{3,24})\b/i);
  return match?.[1]?.toUpperCase();
}

function readPrice(card: cheerio.Cheerio<AnyNode>, selectors: string[]): number | undefined {
  for (const selector of selectors) {
    const fraction = card.find(selector).first();
    if (!fraction.length) continue;
    const cents = fraction.siblings(".andes-money-amount__cents").first().text().trim();
    const value = parseBrlPrice(`${fraction.text().trim()}${cents ? `,${cents}` : ""}`);
    if (value) return value;
  }
  return undefined;
}
