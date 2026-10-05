import { describe, expect, it } from "vitest";
import { extractPaymentDetails } from "../src/utils/payment.js";

describe("extractPaymentDetails", () => {
  it("extrai Pix e parcelamento somente quando estao explicitos", () => {
    expect(extractPaymentDetails("R$ 779,00 no Pix ou em até 10x de R$ 84,90 sem juros")).toEqual({
      pixPrice: 779,
      cardPrice: undefined,
      installmentText: "em até 10x de R$ 84,90",
    });
  });

  it("aceita o rotulo Pix antes do preco", () => {
    expect(extractPaymentDetails("No Pix por R$ 1.299,90")).toMatchObject({ pixPrice: 1299.9 });
  });

  it("nao infere Pix a partir de um preco comum", () => {
    expect(extractPaymentDetails("Oferta por R$ 779,00")).toEqual({});
  });

  it("nao inventa o preco total do cartao multiplicando parcelas", () => {
    expect(extractPaymentDetails("12x de R$ 114,71 sem juros")).toEqual({
      pixPrice: undefined,
      cardPrice: undefined,
      installmentText: "em até 12x de R$ 114,71",
    });
  });
});
