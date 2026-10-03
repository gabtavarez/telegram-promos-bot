import type { PriceHistoryStats } from "../types/BotState.js";
import type { Deal } from "../types/Deal.js";

const MIN_OBSERVATION_DAYS = 3;
const MIN_DROP_PERCENT = 8;
const MIN_DROP_WITH_VERIFIED_COUPON_PERCENT = 5;
const MAX_PREMIUM_OVER_KNOWN_LOW_PERCENT = 12;

export function withPriceHistory(deal: Deal, priceHistory?: PriceHistoryStats): Deal {
  return priceHistory ? { ...deal, priceHistory } : { ...deal };
}

export function getVerifiedDiscountPercentage(deal: Deal): number | undefined {
  const history = deal.priceHistory;
  if (!history || history.observationDays < MIN_OBSERVATION_DAYS) return undefined;
  if (!Number.isFinite(history.lowestPrice90Days) || history.lowestPrice90Days <= 0) return undefined;

  const maximumAcceptablePrice = history.lowestPrice90Days *
    (1 + MAX_PREMIUM_OVER_KNOWN_LOW_PERCENT / 100);
  if (deal.currentPrice > maximumAcceptablePrice) return undefined;

  const minimumDrop = deal.couponCode && deal.couponVerified
    ? MIN_DROP_WITH_VERIFIED_COUPON_PERCENT
    : MIN_DROP_PERCENT;
  return history.percentBelow30DayAverage >= minimumDrop
    ? history.percentBelow30DayAverage
    : undefined;
}

export function hasReliablePriceEvidence(deal: Deal): boolean {
  return getVerifiedDiscountPercentage(deal) !== undefined;
}
