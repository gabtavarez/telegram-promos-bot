import { describe, expect, it } from "vitest";
import { enrichDealMetrics } from "../src/services/DealScoring.js";
import type { Deal } from "../src/types/Deal.js";

const deal: Deal = {
  id: "gpu-1",
  provider: "mercado-livre",
  title: "Placa de video Asus RTX 4060 8GB GDDR6",
  originalUrl: "https://example.com/gpu",
  imageUrl: "https://example.com/gpu.jpg",
  currentPrice: 1800,
  discountPercentage: 30,
};

describe("Tavarez Score", () => {
  it("aumenta quando a oferta esta abaixo da media e no menor preco", () => {
    const normal = enrichDealMetrics(deal);
    const historicalLow = enrichDealMetrics(deal, {
      lowestPrice90Days: 1800,
      averagePrice30Days: 2100,
      averagePrice90Days: 2200,
      observationDays: 20,
      isLowestPrice90Days: true,
      percentBelow30DayAverage: 14,
    });

    expect(historicalLow.tavarezScore).toBeGreaterThan(normal.tavarezScore!);
    expect(historicalLow.scoreLabel).toBeTruthy();
  });

  it("nao concede pontos de desconto ou historico quando os dados estao ausentes", () => {
    const withoutEvidence = enrichDealMetrics({
      ...deal,
      discountPercentage: undefined,
      couponCode: undefined,
    });
    const withUnverifiedCoupon = enrichDealMetrics({
      ...deal,
      discountPercentage: undefined,
      couponCode: "QUALQUER10",
    });

    expect(withUnverifiedCoupon.tavarezScore).toBe(withoutEvidence.tavarezScore);
    expect(withoutEvidence.tavarezScore).toBeLessThan(enrichDealMetrics(deal).tavarezScore!);
  });
});
