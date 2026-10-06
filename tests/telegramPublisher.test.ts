import { describe, expect, it } from "vitest";
import { formatCaption } from "../src/services/TelegramPublisher.js";
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
    const caption = formatCaption({ ...baseDeal, previousPrice: 434.64, discountPercentage: 31 }, baseDeal.originalUrl);

    expect(caption).toContain("🔥 <b>R$ 299,90 (-31%)</b>\n\n<b>SSD NVMe 1 TB</b>");
  });

  it("adiciona a categoria no novo layout", () => {
    expect(formatCaption(baseDeal, baseDeal.originalUrl)).toContain("#Armazenamento");
  });

  it("substitui Anuncio pela hashtag da loja", () => {
    expect(formatCaption(baseDeal, baseDeal.originalUrl)).toContain("📢 #MercadoLivre #Armazenamento");
    expect(formatCaption({ ...baseDeal, provider: "aliexpress" }, baseDeal.originalUrl))
      .toContain("📢 #AliExpress #Armazenamento");
    expect(formatCaption({ ...baseDeal, provider: "kabum" }, baseDeal.originalUrl))
      .toContain("📢 #KaBuM #Armazenamento");
    expect(formatCaption(baseDeal, baseDeal.originalUrl)).not.toContain("#Anuncio");
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

  it("nao mostra Tavarez Score nem o historico de preco", () => {
    const caption = formatCaption({
      ...baseDeal,
      priceHistory: {
        lowestPrice90Days: 299.9,
        averagePrice30Days: 350,
        averagePrice90Days: 370,
        observationDays: 12,
        isLowestPrice90Days: true,
        percentBelow30DayAverage: 14,
      },
    }, baseDeal.originalUrl);

    expect(caption).not.toContain("Tavarez Score");
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

  it("nao classifica display avulso como GPU", () => {
    const caption = formatCaption({
      ...baseDeal,
      title: "Turzx 2.1 Polegada IPS Tela Secundaria USB Tipo-C Display Redondo para CPU GPU RAM HDD",
    }, baseDeal.originalUrl);

    expect(caption).toContain("#Setup");
    expect(caption).not.toContain("#GPU");
  });

  it("mantem o link da oferta visivel sem depender de botao", () => {
    const caption = formatCaption(baseDeal, baseDeal.originalUrl);
    expect(caption).toContain("✅ Link da Oferta:");
    expect(caption).toContain(baseDeal.originalUrl);
  });

  it("destaca Pix e mostra o parcelamento quando a loja os informa", () => {
    const caption = formatCaption({
      ...baseDeal,
      currentPrice: 779,
      pixPrice: 779,
      cardPrice: 849,
      installmentText: "em até 10x de R$ 84,90",
      previousPrice: 1025,
      discountPercentage: 24,
    }, baseDeal.originalUrl);

    expect(caption).toContain("🔥 <b>R$ 779,00 no Pix (-24%)</b>");
    expect(caption).toContain("💳 R$ 849,00 — em até 10x de R$ 84,90");
  });

  it("nao chama um preco comum de Pix", () => {
    const caption = formatCaption(baseDeal, baseDeal.originalUrl);
    expect(caption).not.toContain("no Pix");
    expect(caption).not.toContain("💳");
  });

  it("nunca exibe percentual isolado ou desconto absurdo", () => {
    const caption = formatCaption({
      ...baseDeal,
      currentPrice: 1449,
      previousPrice: 144900,
      discountPercentage: 99,
    }, baseDeal.originalUrl);

    expect(caption).toContain("R$ 1.449,00");
    expect(caption).not.toContain("99%");
  });
});
