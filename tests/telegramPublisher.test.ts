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
  it("coloca preco/desconto no topo e produto em destaque abaixo", () => {
    const caption = formatCaption({ ...baseDeal, discountPercentage: 31 }, baseDeal.originalUrl);

    expect(caption).toContain("🔥 <b>R$ 299,90 (-31%)</b>\n\n<b>SSD NVMe 1 TB</b>");
  });

  it("adiciona a categoria no novo layout", () => {
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

  it("mantem o link afiliado visivel quando a oferta tem displayUrl", () => {
    const affiliateUrl = "https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&ued=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F123%2Fssd";
    const caption = formatCaption(
      { ...baseDeal, displayUrl: "https://www.kabum.com.br/produto/123/ssd" },
      affiliateUrl,
    );

    expect(caption).toContain("https://www.awin1.com/cread.php");
    expect(caption).not.toContain("\nhttps://www.kabum.com.br/produto/123/ssd");
  });

  it("mostra Tavarez Score sem exibir o historico de preco", () => {
    const caption = formatCaption({
      ...baseDeal,
      tavarezScore: 88,
      scoreLabel: "Excelente",
      priceHistory: {
        lowestPrice90Days: 299.9,
        averagePrice30Days: 350,
        averagePrice90Days: 370,
        observationDays: 12,
        isLowestPrice90Days: true,
        percentBelow30DayAverage: 14,
      },
    }, baseDeal.originalUrl);

    expect(caption).toContain("Tavarez Score: <b>88/100 — Excelente</b>");
    expect(caption).not.toContain("abaixo da média");
    expect(caption).not.toContain("Menor preço");
  });

  it("mostra cupom em formato copiavel e classifica celular", () => {
    const caption = formatCaption({
      ...baseDeal,
      title: "Samsung Galaxy S24 5G 256GB",
      couponCode: "CELULAR100",
    }, baseDeal.originalUrl);

    expect(caption).toContain("🎟️ Cupom: <code>CELULAR100</code>");
    expect(caption).toContain("#Celular");
  });

  it("nao classifica acessorio para iPhone como celular", () => {
    const caption = formatCaption({
      ...baseDeal,
      title: "Hagibis 2230 M.2 NVMe SSD Gabinete USB 3.2 Gen 2 para iPhone 17 Pro Laptops",
    }, baseDeal.originalUrl);

    expect(caption).not.toContain("#Celular");
  });

  it("mantem apenas o botao principal da oferta", () => {
    const keyboard = buildOfferKeyboard(baseDeal.originalUrl);
    expect(JSON.stringify(keyboard)).toContain("VER OFERTA");
    expect(JSON.stringify(keyboard)).not.toContain("Vale a pena");
  });
});
