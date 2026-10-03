import type { Deal } from "../types/Deal.js";
import type { PriceHistoryStats } from "../types/BotState.js";

export type DailyPrices = Record<string, number>;

export function getPriceHistoryDateKeys(now = new Date(), days = 90): string[] {
  const keys: string[] = [];
  const currentBrazilDate = formatBrazilDate(now);
  const start = new Date(`${currentBrazilDate}T12:00:00-03:00`);
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() - offset);
    keys.push(formatBrazilDate(date));
  }
  return keys;
}

function formatBrazilDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function mergeDailyPrices(current: DailyPrices, deals: Deal[]): DailyPrices {
  const merged = { ...current };
  for (const deal of deals) {
    const previous = merged[deal.id];
    merged[deal.id] = previous === undefined ? deal.currentPrice : Math.min(previous, deal.currentPrice);
  }
  return merged;
}

export function calculatePriceHistoryStats(
  deals: Deal[],
  dates: string[],
  snapshots: Map<string, DailyPrices>,
): Map<string, PriceHistoryStats> {
  const result = new Map<string, PriceHistoryStats>();
  for (const deal of deals) {
    const prices90 = dates.flatMap((date) => {
      const value = snapshots.get(date)?.[deal.id];
      return value === undefined ? [] : [value];
    });
    if (prices90.length === 0) continue;

    const prices30 = dates.slice(0, 30).flatMap((date) => {
      const value = snapshots.get(date)?.[deal.id];
      return value === undefined ? [] : [value];
    });
    const average30 = average(prices30.length ? prices30 : prices90);
    const average90 = average(prices90);
    const lowest = Math.min(...prices90);
    result.set(deal.id, {
      lowestPrice90Days: roundPrice(lowest),
      averagePrice30Days: roundPrice(average30),
      averagePrice90Days: roundPrice(average90),
      observationDays: prices90.length,
      isLowestPrice90Days: deal.currentPrice <= lowest,
      percentBelow30DayAverage: Math.round(((average30 - deal.currentPrice) / average30) * 100),
    });
  }
  return result;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
