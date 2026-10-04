import type { Deal } from "../types/Deal.js";
import type { PriceHistoryStats } from "../types/BotState.js";
import { getHardwareQualityScore } from "../utils/hardwareFilter.js";

export function enrichDealMetrics(deal: Deal, priceHistory?: PriceHistoryStats): Deal {
  const enriched = priceHistory ? { ...deal, priceHistory } : { ...deal };
  const tavarezScore = calculateTavarezScore(enriched);
  return { ...enriched, tavarezScore, scoreLabel: getTavarezScoreLabel(tavarezScore) };
}

export function calculateTavarezScore(deal: Deal): number {
  const quality = Math.max(0, Math.min(getHardwareQualityScore(deal.title), 12));
  const qualityPoints = (quality / 12) * 35;
  const discountPoints = deal.discountPercentage !== undefined
    ? Math.min(deal.discountPercentage, 50) / 2
    : 0;
  const historyPoints = calculateHistoryPoints(deal.priceHistory);
  const couponPoints = deal.couponCode && deal.couponVerified ? 10 : 0;
  return Math.max(0, Math.min(100, Math.round(25 + qualityPoints + discountPoints + historyPoints + couponPoints)));
}

export function getTavarezScoreLabel(score: number): string {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Muito Boa";
  if (score >= 60) return "Boa";
  return "Custo-Benefício";
}

function calculateHistoryPoints(history?: PriceHistoryStats): number {
  if (!history || history.observationDays < 2) return 0;
  const belowAveragePoints = Math.max(0, Math.min(history.percentBelow30DayAverage, 20)) / 2;
  const lowestPriceBonus = history.isLowestPrice90Days ? 5 : 0;
  return Math.min(15, belowAveragePoints + lowestPriceBonus);
}
