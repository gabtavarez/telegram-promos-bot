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
    : 8;
  const historyPoints = calculateHistoryPoints(deal.priceHistory);
  const couponPoints = deal.couponCode ? 5 : 0;
  return Math.max(0, Math.min(100, Math.round(20 + qualityPoints + discountPoints + historyPoints + couponPoints)));
}

export function getTavarezScoreLabel(score: number): string {
  if (score >= 85) return "EXCELENTE";
  if (score >= 70) return "MUITO BOA";
  if (score >= 60) return "BOA";
  return "CUSTO-BENEFÍCIO";
}

function calculateHistoryPoints(history?: PriceHistoryStats): number {
  if (!history || history.observationDays < 2) return 8;
  const belowAveragePoints = Math.max(0, Math.min(history.percentBelow30DayAverage, 20)) / 2;
  const lowestPriceBonus = history.isLowestPrice90Days ? 5 : 0;
  return Math.min(15, belowAveragePoints + lowestPriceBonus);
}
