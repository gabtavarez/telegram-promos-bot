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
      { ...base, id: "1", previousPrice: 111.11, discountPercentage: 10 },
      { ...base, id: "2", previousPrice: 285.71, discountPercentage: 30, currentPrice: 200 },
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
      previousPrice: 125,
      discountPercentage: 20,
    };

    expect(isPromotableDeal(qualityDeal)).toBe(true);
    expect(isPromotableDeal({ ...qualityDeal, previousPrice: 111.11, discountPercentage: 10 })).toBe(false);
    expect(isPromotableDeal({ ...qualityDeal, title: "SSD 128GB generico", previousPrice: 333.33, discountPercentage: 70 })).toBe(false);
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

  it("nao aceita percentual sem preco anterior nem desconto absurdo", () => {
    const title = "Processador AMD Ryzen 5 5600GT 6-Core AM4 BOX";
    expect(isPromotableDeal({ ...base, title, currentPrice: 1449, discountPercentage: 99 })).toBe(false);
    expect(isPromotableDeal({
      ...base,
      title,
      currentPrice: 1449,
      previousPrice: 144900,
      discountPercentage: 99,
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

  it("aceita cupom somente quando a elegibilidade do produto foi verificada", () => {
    const couponDeal = {
      ...base,
      title: "SSD NVMe Kingston Fury Renegade 1TB PCIe 4.0",
      couponCode: "SSD20",
    };
    expect(isPromotableDeal(couponDeal)).toBe(false);
    expect(isPromotableDeal({ ...couponDeal, couponVerified: true })).toBe(true);
  });

  it("prioriza water cooler com tela sobre air cooler comum", () => {
    const waterCooler = {
      ...base,
      id: "water",
      title: "Water Cooler Rise Mode 240mm LCD Display Tela ARGB",
      previousPrice: 133.33,
      discountPercentage: 25,
    };
    const airCooler = {
      ...base,
      id: "air",
      title: "Deepcool AG400 Air Cooler CPU ARGB 220W",
      previousPrice: 133.33,
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
    const sameStore = { ...base, id: "same", provider: "shopee" as const, title, previousPrice: 142.86, discountPercentage: 30 };
    const otherStore = { ...base, id: "other", provider: "kabum" as const, title, previousPrice: 133.33, discountPercentage: 25 };

    expect(getDealSelectionScore(otherStore, ["shopee"])).toBeGreaterThan(
      getDealSelectionScore(sameStore, ["shopee"]),
    );
    expect(selectBestDeal([sameStore, otherStore], ["shopee"])?.id).toBe("other");
  });

  it("penaliza repeticao recente da mesma categoria", () => {
    const gpu = { ...base, id: "gpu", title: "Placa de video RTX 4060 8GB", previousPrice: 133.33, discountPercentage: 25 };
    const monitor = { ...base, id: "monitor", title: "Monitor Gamer LG 180Hz IPS", previousPrice: 133.33, discountPercentage: 25 };

    expect(getDealSelectionScore(monitor, [], ["gpu"]))
      .toBeGreaterThan(getDealSelectionScore(gpu, [], ["gpu"]));
  });
});
