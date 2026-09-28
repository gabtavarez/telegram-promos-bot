import { describe, expect, it } from "vitest";
import { formatCaption } from "../src/services/TelegramPublisher.js";
import type { Deal } from "../src/types/Deal.js";

const baseDeal: Deal = {
  id: "deal-1",
  provider: "Test",
  title: "SSD NVMe 1 TB",
  currentPrice: 299.9,
  link: "https://example.com/produto",
  imageUrl: "https://example.com/produto.jpg",
};

describe("formatCaption", () => {
  it("destaca descontos superiores a 30%", () => {
    const caption = formatCaption({ ...baseDeal, discountPercentage: 31 }, baseDeal.link);

    expect(caption).toContain("🚀 SUPER OFERTA — 💰");
  });

  it("não destaca descontos de até 30%", () => {
    const caption = formatCaption({ ...baseDeal, discountPercentage: 30 }, baseDeal.link);

    expect(caption).not.toContain("SUPER OFERTA");
  });
});
