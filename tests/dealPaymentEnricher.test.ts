import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "../src/types/Deal.js";

const mocks = vi.hoisted(() => ({ fetchDealPage: vi.fn() }));
vi.mock("../src/services/DealAvailabilityChecker.js", () => ({
  fetchDealPage: mocks.fetchDealPage,
}));

import { enrichDealPayment } from "../src/services/DealPaymentEnricher.js";

const shopeeDeal: Deal = {
  id: "shopee:1:2",
  provider: "shopee",
  title: "Apple iPhone 16 128GB 5G",
  originalUrl: "https://s.shopee.com.br/example",
  imageUrl: "https://example.com/iphone.jpg",
  currentPrice: 5299,
  discountPercentage: 32,
};

describe("enrichDealPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("substitui o preco da API pelo Pix explicito da pagina final", async () => {
    mocks.fetchDealPage.mockResolvedValue(
      "R$4.775,08 no Pix com cupom ou R$5.299,00 sem cupom em outros métodos de pagamento",
    );

    await expect(enrichDealPayment(shopeeDeal)).resolves.toMatchObject({
      currentPrice: 4775.08,
      pixPrice: 4775.08,
      cardPrice: 5299,
    });
  });

  it("ignora um suposto Pix muito distante que pode pertencer a uma recomendacao", async () => {
    mocks.fetchDealPage.mockResolvedValue("Outro produto por R$ 99,90 no Pix");
    await expect(enrichDealPayment(shopeeDeal)).resolves.toEqual(shopeeDeal);
  });

  it("mantem o preco da API se a pagina nao trouxer Pix", async () => {
    mocks.fetchDealPage.mockResolvedValue("R$ 5.299,00 em outros métodos de pagamento");
    await expect(enrichDealPayment(shopeeDeal)).resolves.toEqual(shopeeDeal);
  });
});
