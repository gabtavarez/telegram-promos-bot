import { describe, expect, it } from "vitest";
import { buildOfferKeyboard, formatCaption } from "../src/services/TelegramPublisher.js";
import type { Deal } from "../src/types/Deal.js";

const baseDeal: Deal = {
  id: "deal-1",
  provider: "mercado-livre",
  title: "SSD NVMe 1 TB",
  currentPrice: 299.9,
  originalUrl: "https://example.com/produto",
  imageUrl: "https://example.com/produto.jpg",
};

describe("formatCaption", () => {
  it("destaca descontos superiores a 30%", () => {
    const caption = formatCaption({ ...baseDeal, discountPercentage: 31 }, baseDeal.originalUrl);

    expect(caption).toContain("🚀 SUPER OFERTA — 💰");
  });

  it("não destaca descontos de até 30%", () => {
    const caption = formatCaption({ ...baseDeal, discountPercentage: 30 }, baseDeal.originalUrl);

    expect(caption).not.toContain("SUPER OFERTA");
  });

  it("classifica os níveis de desconto e adiciona a categoria", () => {
    expect(formatCaption({ ...baseDeal, discountPercentage: 15 }, baseDeal.originalUrl)).toContain("🔥 OFERTA BOA");
    expect(formatCaption({ ...baseDeal, discountPercentage: 50 }, baseDeal.originalUrl)).toContain("💥 DESCONTO IMPERDÍVEL");
    expect(formatCaption(baseDeal, baseDeal.originalUrl)).toContain("#Armazenamento");
  });

  it("prioriza a categoria do equipamento sobre seus componentes", () => {
    const notebook = { ...baseDeal, title: "Notebook Vaio Ryzen 7 16GB RAM SSD" };
    const tablet = { ...baseDeal, title: "Positivo Vision TAB10 4GB RAM 128GB SSD" };

    expect(formatCaption(notebook, notebook.originalUrl)).toContain("#Notebook");
    expect(formatCaption(notebook, notebook.originalUrl)).not.toContain("#CPU");
    expect(formatCaption(tablet, tablet.originalUrl)).toContain("#Tablet");
    expect(formatCaption(tablet, tablet.originalUrl)).not.toContain("#RAM");
  });

  it("classifica televisores premium como TV", () => {
    const television = { ...baseDeal, title: "Smart TV Samsung 55 polegadas QLED 4K" };

    expect(formatCaption(television, television.originalUrl)).toContain("#TV");
  });

  it("mostra o link limpo quando a oferta tem displayUrl", () => {
    const caption = formatCaption(
      { ...baseDeal, displayUrl: "https://www.kabum.com.br/produto/123/ssd" },
      "https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&ued=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F123%2Fssd",
    );

    expect(caption).toContain("https://www.kabum.com.br/produto/123/ssd");
    expect(caption).not.toContain("https://www.awin1.com/cread.php");
  });

  it("mostra Tavarez Score e historico quando disponiveis", () => {
    const caption = formatCaption({
      ...baseDeal,
      tavarezScore: 88,
      scoreLabel: "EXCELENTE",
      priceHistory: {
        lowestPrice90Days: 299.9,
        averagePrice30Days: 350,
        averagePrice90Days: 370,
        observationDays: 12,
        isLowestPrice90Days: true,
        percentBelow30DayAverage: 14,
      },
    }, baseDeal.originalUrl);

    expect(caption).toContain("TAVAREZ SCORE: 88/100 — EXCELENTE");
    expect(caption).toContain("14% abaixo da média");
    expect(caption).toContain("Menor preço em 12 dia(s)");
  });

  it("mantem apenas o botao principal da oferta", () => {
    const keyboard = buildOfferKeyboard(baseDeal.originalUrl);
    expect(JSON.stringify(keyboard)).toContain("VER OFERTA");
    expect(JSON.stringify(keyboard)).not.toContain("Vale a pena");
  });
});
