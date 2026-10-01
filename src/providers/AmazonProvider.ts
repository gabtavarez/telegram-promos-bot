import * as cheerio from "cheerio";
import type { Deal } from "../types/Deal.js";
import { calculateDiscount, parseBrlPrice } from "../utils/price.js";
import { http } from "../utils/http.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { extractVisibleCouponCode } from "../utils/couponCode.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

export class AmazonProvider implements AffiliateProvider {
  readonly name = "Amazon";

  constructor(private readonly dealsUrl: string) {}

  async getDeals(): Promise<Deal[]> {
    const { data } = await http.get<string>(this.dealsUrl);
    const $ = cheerio.load(data);
    const deals: Deal[] = [];

    $("[data-testid='product-card'], [data-asin]:has(a[href*='/dp/'])").each((_, element) => {
      const card = $(element);
      const link = card.find("a[href*='/dp/']").first();
      const href = link.attr("href");
      const asin = card.attr("data-asin") || href?.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
      const title = card
        .find("[data-testid='product-card-title'], .a-size-base-plus, .a-size-medium")
        .first()
        .text()
        .trim();
      const imageUrl = card.find("img").first().attr("src");
      const currentPrice = parseBrlPrice(
        card.find(".a-price:not(.a-text-price) .a-offscreen, [data-testid='price-block-deal-price']").first().text(),
      );
      const previousPrice = parseBrlPrice(
        card.find(".a-text-price .a-offscreen, [data-testid='price-block-list-price']").first().text(),
      );
      const couponCode = extractVisibleCouponCode(card.text());

      if (!href || !asin || !title || !imageUrl || !currentPrice) return;
      if (!isPcHardwareDeal(title)) return;

      const originalUrl = new URL(href, "https://www.amazon.com.br");
      originalUrl.search = "";
      deals.push({
        id: `amazon:${asin}`,
        provider: "amazon",
        title,
        originalUrl: originalUrl.toString(),
        imageUrl,
        currentPrice,
        previousPrice,
        discountPercentage: calculateDiscount(currentPrice, previousPrice),
        couponCode,
      });
    });

    return uniqueById(deals);
  }
}

function uniqueById(deals: Deal[]): Deal[] {
  return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
}
