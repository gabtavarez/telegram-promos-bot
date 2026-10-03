import { describe, expect, it } from "vitest";
import {
  getVerifiedDiscountPercentage,
  hasReliablePriceEvidence,
} from "../src/services/DealPriceConfidence.js";
import type { Deal } from "../src/types/Deal.js";

const deal: Deal = {
  id: "monitor-1",
  provider: "shopee",
  title: "Monitor Gamer LG UltraGear 24 IPS 180Hz 24GS60F-B",
  originalUrl: "https://example.com/monitor",
  imageUrl: "https://example.com/monitor.jpg",
  currentPrice: 1_019.9,
  discountPercentage: 48,
};

describe("confianca do preco", () => {
  it("ignora desconto alto declarado pela loja sem historico suficiente", () => {
    expect(hasReliablePriceEvidence(deal)).toBe(false);
    expect(getVerifiedDiscountPercentage(deal)).toBeUndefined();
  });

  it("rejeita preco muito acima do menor valor conhecido", () => {
    const withHistory = {
      ...deal,
      priceHistory: {
        lowestPrice90Days: 680,
        averagePrice30Days: 900,
        averagePrice90Days: 850,
        observationDays: 20,
        isLowestPrice90Days: false,
        percentBelow30DayAverage: 15,
      },
    };

    expect(hasReliablePriceEvidence(withHistory)).toBe(false);
  });

  it("aceita queda real contra o historico recente", () => {
    const realDeal = {
      ...deal,
      currentPrice: 680,
      priceHistory: {
        lowestPrice90Days: 680,
        averagePrice30Days: 800,
        averagePrice90Days: 820,
        observationDays: 20,
        isLowestPrice90Days: true,
        percentBelow30DayAverage: 15,
      },
    };

    expect(getVerifiedDiscountPercentage(realDeal)).toBe(15);
    expect(hasReliablePriceEvidence(realDeal)).toBe(true);
  });
});
