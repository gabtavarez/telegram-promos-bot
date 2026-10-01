import { describe, expect, it } from "vitest";
import type { Deal } from "../src/types/Deal.js";
import {
  calculatePriceHistoryStats,
  getPriceHistoryDateKeys,
  mergeDailyPrices,
} from "../src/storage/priceHistory.js";

const deal: Deal = {
  id: "ssd-1",
  provider: "kabum",
  title: "SSD NVMe Kingston 1TB",
  originalUrl: "https://example.com/ssd",
  imageUrl: "https://example.com/ssd.jpg",
  currentPrice: 300,
};

describe("price history", () => {
  it("mantem o menor preco observado no mesmo dia", () => {
    const snapshot = mergeDailyPrices({ "ssd-1": 320 }, [deal]);
    expect(snapshot["ssd-1"]).toBe(300);
  });

  it("calcula media, menor preco e distancia da media", () => {
    const dates = getPriceHistoryDateKeys(new Date("2026-10-01T15:00:00Z"), 3);
    const snapshots = new Map([
      [dates[0]!, { "ssd-1": 300 }],
      [dates[1]!, { "ssd-1": 350 }],
      [dates[2]!, { "ssd-1": 400 }],
    ]);
    const stats = calculatePriceHistoryStats([deal], dates, snapshots).get("ssd-1");

    expect(stats?.lowestPrice90Days).toBe(300);
    expect(stats?.averagePrice30Days).toBe(350);
    expect(stats?.percentBelow30DayAverage).toBe(14);
    expect(stats?.isLowestPrice90Days).toBe(true);
  });
});
