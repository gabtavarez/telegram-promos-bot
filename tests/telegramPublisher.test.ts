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
});
