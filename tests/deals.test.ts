import { describe, expect, it } from "vitest";
import { matchesDealSearch, selectBestDeal } from "../src/services/DealsJob.js";
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

  it("busca por todos os termos ignorando acentos e caixa", () => {
    const deal = { ...base, title: "Memória RAM DDR5 Kingston" };

    expect(matchesDealSearch(deal, "memoria ddr5")).toBe(true);
    expect(matchesDealSearch(deal, "memoria ssd")).toBe(false);
  });
});
