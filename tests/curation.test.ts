import { describe, expect, it } from "vitest";
import { isBudgetPowerSupply, isGenericPhoneEarphone } from "../src/quality/assess.js";
import { hasInflatedDiscount, isExceptionalDeal } from "../src/services/DealsJob.js";
import { isRecentRepeat, isSameProduct } from "../src/utils/similarity.js";
import type { Deal } from "../src/types/Deal.js";
import type { PublishedOffer } from "../src/types/BotState.js";

const deal = (title: string, price: number, extra: Partial<Deal> = {}): Deal => ({
  id: title, provider: "aliexpress", title, originalUrl: "https://x/" + encodeURIComponent(title), imageUrl: "https://x/i.jpg", currentPrice: price, ...extra,
});
const posted = (title: string, price: number, hoursAgo: number): PublishedOffer => ({
  messageId: Math.round(Math.random() * 1e6), publishedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), status: "active", deal: deal(title, price),
} as unknown as PublishedOffer);

describe("curadoria", () => {
  it("reconhece o mesmo modelo com titulos bem diferentes", () => {
    expect(isSameProduct("AJAZZ AK820 / AK820 Pro Teclado Mecânico", "Teclado Mecânico Sem Fio AJAZZ AK820/Pro Bluetooth 5.1 2.4G USB-C Com Fio Hot Swappable RGB para Jogos com Montagem Gasket")).toBe(true);
    expect(isSameProduct("Teclado Mecânico para Jogos AJAZZ AK820, Tri-Modo Bluetooth 5.1", "AJAZZ AK820 / AK820 Pro Teclado Mecânico")).toBe(true);
    expect(isSameProduct("Monitor LG Ultragear 27g523 200hz", "Monitor Gamer LG UltraGear 27\" FHD 144Hz IPS - 27G411B-B")).toBe(false);
    expect(isSameProduct("Processador AMD Ryzen 7 5700X 3.4GHz AM4", "Processador AMD Ryzen 7 5700 4.6GHz 8 Núcleos AM4")).toBe(false);
  });

  it("depois da janela, so repete se estiver tao barato quanto da ultima vez (ate 7 dias)", () => {
    const history = [posted("Mouse Gamer Redragon M990 MMO RGB 32000 DPI", 200, 6 * 24)];
    expect(isRecentRepeat(deal("Mouse Gamer Redragon M990 MMO, Mouse RGB com Fio", 210), history)).toBe(true);
    expect(isRecentRepeat(deal("Mouse Gamer Redragon M990 MMO, Mouse RGB com Fio", 199), history)).toBe(false);
    expect(isRecentRepeat(deal("Mouse Gamer Redragon M990 MMO, Mouse RGB com Fio", 210), [posted("Mouse Gamer Redragon M990 MMO", 200, 8 * 24)])).toBe(false);
  });

  it("barra fonte de marca ruim e fone generico de celular", () => {
    expect(isBudgetPowerSupply("Fonte Gamer ATX Fortrek Crusader 500W Bivolt")).toBe(true);
    expect(isBudgetPowerSupply("Fonte Corsair RMe Series RM650e, 650W, 80 Plus Gold")).toBe(false);
    expect(isGenericPhoneEarphone("Fones De Ouvido Usb-c Tipo C Com Microfone Integrado Compatível Com iPhone 15 Android")).toBe(true);
    expect(isGenericPhoneEarphone("Fones de Ouvido com Fio Tipo-C para Jogos, Headset Intra-auricular com Cancelamento de Ruído para iPhone")).toBe(true);
    expect(isGenericPhoneEarphone("Headset Gamer Sem Fio Attack Shark G800 2.4G, Bluetooth 5.3, Som Surround 7.1")).toBe(false);
  });

  it("desconto com preco 'de' inflado nao conta; madrugada so aceita oferta excepcional", () => {
    const history = { observationDays: 6, percentBelow30DayAverage: 0, lowest30DayPrice: 799, average30DayPrice: 799 } as unknown as Deal["priceHistory"];
    const inflated = deal("SSD Kingston NV3 1TB", 799, { previousPrice: 949, discountPercentage: 16, priceHistory: history });
    expect(hasInflatedDiscount(inflated)).toBe(true);
    expect(hasInflatedDiscount(deal("SSD Kingston NV3 1TB", 799, { previousPrice: 949, discountPercentage: 16 }))).toBe(false);
    expect(isExceptionalDeal(deal("SSD Kingston NV3 1TB", 600, { previousPrice: 900, discountPercentage: 33 }), 25)).toBe(true);
    expect(isExceptionalDeal(deal("SSD Kingston NV3 1TB", 800, { previousPrice: 900, discountPercentage: 11 }), 25)).toBe(false);
  });
});
