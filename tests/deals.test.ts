import { describe, expect, it } from "vitest";
import { selectBestDeal } from "../src/services/DealsJob.js";
import type { Deal } from "../src/types/Deal.js";

const base: Deal = {
  id: "1",
  provider: "amazon",
  title: "Produto",
  originalUrl: "https://example.com/item",
  imageUrl: "https://example.com/image.jpg",
  currentPrice: 100,
};

describe("deal selection", () => {
  it("prefers the greatest discount", () => {
    const best = selectBestDeal([
      { ...base, id: "1", discountPercentage: 10 },
      { ...base, id: "2", discountPercentage: 30, currentPrice: 200 },
    ]);
    expect(best?.id).toBe("2");
  });
});
