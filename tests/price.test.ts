import { describe, expect, it } from "vitest";
import { calculateDiscount, normalizeDealPricing, parseBrlPrice } from "../src/utils/price.js";
import type { Deal } from "../src/types/Deal.js";

const deal: Deal = {
  id: "test",
  provider: "shopee",
  title: "Processador AMD Ryzen 5 5600GT",
  originalUrl: "https://example.com",
  imageUrl: "https://example.com/image.jpg",
  currentPrice: 1449,
};

describe("price engine", () => {
  it("interpreta formatos monetarios brasileiros e de API", () => {
    expect(parseBrlPrice("R$ 1.266,43")).toBe(1266.43);
    expect(parseBrlPrice("1449.00 BRL")).toBe(1449);
    expect(parseBrlPrice("1,266.43")).toBe(1266.43);
  });

  it("calcula desconto apenas a partir de dois precos coerentes", () => {
    expect(calculateDiscount(1266.43, 1449)).toBe(13);
    expect(calculateDiscount(1449, undefined)).toBeUndefined();
    expect(calculateDiscount(1449, 144_900)).toBeUndefined();
  });

  it("remove percentual isolado e preco anterior artificial de 99%", () => {
    expect(normalizeDealPricing({
      ...deal,
      previousPrice: 144_900,
      discountPercentage: 99,
    })).toMatchObject({
      currentPrice: 1449,
      previousPrice: undefined,
      discountPercentage: undefined,
    });
  });
});
