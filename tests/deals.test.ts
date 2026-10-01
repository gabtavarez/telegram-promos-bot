import { describe, expect, it } from "vitest";
import {
  getDealSelectionScore,
  isPromotableDeal,
  matchesDealSearch,
  selectBestDeal,
} from "../src/services/DealsJob.js";
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

  it("exige produto bom e promocao media quando o desconto e conhecido", () => {
    const qualityDeal = {
      ...base,
      title: "SSD NVMe Kingston 1TB M.2 PCIe 4.0",
      discountPercentage: 20,
    };

    expect(isPromotableDeal(qualityDeal)).toBe(true);
    expect(isPromotableDeal({ ...qualityDeal, discountPercentage: 10 })).toBe(false);
    expect(isPromotableDeal({ ...qualityDeal, title: "SSD 128GB generico", discountPercentage: 70 })).toBe(false);
  });

  it("aceita sem percentual apenas produtos com muitos sinais fortes", () => {
    expect(isPromotableDeal({
      ...base,
      title: "Placa Mae Asus B650 AM5 DDR5 Ryzen",
      discountPercentage: undefined,
    })).toBe(true);
    expect(isPromotableDeal({
      ...base,
      title: "Memoria Kingston 16GB DDR4",
      discountPercentage: undefined,
    })).toBe(false);
  });

  it("favorece outra loja quando as ofertas sao comparaveis", () => {
    const title = "SSD NVMe Kingston 1TB M.2 PCIe 4.0";
    const sameStore = { ...base, id: "same", provider: "shopee" as const, title, discountPercentage: 30 };
    const otherStore = { ...base, id: "other", provider: "kabum" as const, title, discountPercentage: 25 };

    expect(getDealSelectionScore(otherStore, ["shopee"])).toBeGreaterThan(
      getDealSelectionScore(sameStore, ["shopee"]),
    );
    expect(selectBestDeal([sameStore, otherStore], ["shopee"])?.id).toBe("other");
  });
});
