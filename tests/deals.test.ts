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
  it("prioriza a maior queda de preco validada pelo historico", () => {
    const best = selectBestDeal([
      { ...base, id: "1", priceHistory: priceHistory(100, 9) },
      { ...base, id: "2", currentPrice: 200, priceHistory: priceHistory(200, 18) },
    ]);
    expect(best?.id).toBe("2");
  });

  it("busca por todos os termos ignorando acentos e caixa", () => {
    const deal = { ...base, title: "Memória RAM DDR5 Kingston" };

    expect(matchesDealSearch(deal, "memoria ddr5")).toBe(true);
    expect(matchesDealSearch(deal, "memoria ssd")).toBe(false);
  });

  it("exige produto bom e evidencia independente de preco", () => {
    const qualityDeal = {
      ...base,
      title: "SSD NVMe Kingston 1TB M.2 PCIe 4.0",
      discountPercentage: 20,
    };

    expect(isPromotableDeal(qualityDeal)).toBe(false);
    expect(isPromotableDeal({ ...qualityDeal, priceHistory: priceHistory(100, 10) })).toBe(true);
    expect(isPromotableDeal({ ...qualityDeal, priceHistory: priceHistory(100, 4) })).toBe(false);
    expect(isPromotableDeal({
      ...qualityDeal,
      title: "SSD 128GB generico",
      priceHistory: priceHistory(100, 20),
    })).toBe(false);
  });

  it("nao aceita produto sem evidencia de promocao apenas pelo nome", () => {
    expect(isPromotableDeal({
      ...base,
      title: "Placa Mae Asus B650 AM5 DDR5 Ryzen",
      discountPercentage: undefined,
    })).toBe(false);
    expect(isPromotableDeal({
      ...base,
      title: "Memoria Kingston 16GB DDR4",
      discountPercentage: undefined,
    })).toBe(false);
  });

  it("exige evidencia de promocao tambem para produtos da Kabum", () => {
    expect(isPromotableDeal({
      ...base,
      provider: "kabum",
      title: "Fonte ATX MSI MAG A650BN 650W 80 Plus Bronze",
      discountPercentage: undefined,
    })).toBe(false);
  });

  it("cupom verificado reduz o limiar, mas nao substitui a validacao do preco", () => {
    const couponDeal = {
      ...base,
      title: "SSD NVMe Kingston Fury Renegade 1TB PCIe 4.0",
      couponCode: "SSD20",
    };
    expect(isPromotableDeal(couponDeal)).toBe(false);
    expect(isPromotableDeal({
      ...couponDeal,
      couponVerified: true,
      priceHistory: priceHistory(100, 6),
    })).toBe(true);
    expect(isPromotableDeal({
      ...couponDeal,
      couponVerified: false,
      priceHistory: priceHistory(100, 6),
    })).toBe(false);
  });

  it("prioriza water cooler com tela sobre air cooler comum", () => {
    const waterCooler = {
      ...base,
      id: "water",
      title: "Water Cooler Rise Mode 240mm LCD Display Tela ARGB",
      discountPercentage: 25,
    };
    const airCooler = {
      ...base,
      id: "air",
      title: "Deepcool AG400 Air Cooler CPU ARGB 220W",
      discountPercentage: 25,
    };

    expect(getDealSelectionScore(waterCooler)).toBeGreaterThan(getDealSelectionScore(airCooler));
    expect(selectBestDeal([airCooler, waterCooler])?.id).toBe("water");
  });

  it("aceita preco historicamente bom mesmo quando o desconto informado e pequeno", () => {
    expect(isPromotableDeal({
      ...base,
      title: "SSD NVMe Kingston 1TB M.2 PCIe 4.0",
      discountPercentage: 8,
      priceHistory: {
        lowestPrice90Days: 300,
        averagePrice30Days: 350,
        averagePrice90Days: 360,
        observationDays: 10,
        isLowestPrice90Days: true,
        percentBelow30DayAverage: 14,
      },
    })).toBe(true);
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

  it("penaliza repeticao recente da mesma categoria", () => {
    const gpu = { ...base, id: "gpu", title: "Placa de video RTX 4060 8GB", discountPercentage: 25 };
    const monitor = { ...base, id: "monitor", title: "Monitor Gamer LG 180Hz IPS", discountPercentage: 25 };

    expect(getDealSelectionScore(monitor, [], ["gpu"]))
      .toBeGreaterThan(getDealSelectionScore(gpu, [], ["gpu"]));
  });
});

function priceHistory(currentPrice: number, percentBelow30DayAverage: number) {
  return {
    lowestPrice90Days: currentPrice,
    averagePrice30Days: currentPrice / (1 - percentBelow30DayAverage / 100),
    averagePrice90Days: currentPrice / (1 - percentBelow30DayAverage / 100),
    observationDays: 10,
    isLowestPrice90Days: true,
    percentBelow30DayAverage,
  };
}
