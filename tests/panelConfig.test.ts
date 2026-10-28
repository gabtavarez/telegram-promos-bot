import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_CONFIG, parseBotConfig } from "../src/config/botConfig.js";
import { applyConfigFilters, isWithinHours } from "../src/services/DealsJob.js";
import { formatCaption } from "../src/services/TelegramPublisher.js";

const deal = (over: Record<string, unknown> = {}) => ({
  id: "1", provider: "kabum", title: "SSD NVMe Kingston 1TB", currentPrice: 300, previousPrice: 400,
  originalUrl: "https://k/1", imageUrl: "https://i/1", ...over,
}) as never;

describe("configuracao do painel", () => {
  it("entrada invalida volta ao padrao e parcial e completada", () => {
    expect(parseBotConfig({ bot: { dailyLimit: -5 } })).toEqual(DEFAULT_BOT_CONFIG);
    expect(parseBotConfig({ bot: { dailyLimit: 10 } }).bot.dailyLimit).toBe(10);
    expect(parseBotConfig(undefined)).toEqual(DEFAULT_BOT_CONFIG);
  });

  it("aplica filtros de loja, preco, desconto, cupom e palavras", () => {
    const f = DEFAULT_BOT_CONFIG.filters;
    expect(applyConfigFilters([deal()], f)).toHaveLength(1);
    expect(applyConfigFilters([deal()], { ...f, stores: { ...f.stores, kabum: false } })).toHaveLength(0);
    expect(applyConfigFilters([deal()], { ...f, minDiscount: 30 })).toHaveLength(0);
    expect(applyConfigFilters([deal()], { ...f, minDiscount: 20 })).toHaveLength(1);
    expect(applyConfigFilters([deal()], { ...f, maxPrice: 200 })).toHaveLength(0);
    expect(applyConfigFilters([deal()], { ...f, minPrice: 500 })).toHaveLength(0);
    expect(applyConfigFilters([deal()], { ...f, onlyWithCoupon: true })).toHaveLength(0);
    expect(applyConfigFilters([deal()], { ...f, blockedKeywords: ["kingston"] })).toHaveLength(0);
    expect(applyConfigFilters([deal()], { ...f, requiredKeywords: ["samsung", "nvme"] })).toHaveLength(1);
    expect(applyConfigFilters([deal()], { ...f, requiredKeywords: ["samsung"] })).toHaveLength(0);
  });

  it("horario silencioso atravessa a meia-noite", () => {
    expect(isWithinHours(23, 23, 7)).toBe(true);
    expect(isWithinHours(3, 23, 7)).toBe(true);
    expect(isWithinHours(7, 23, 7)).toBe(false);
    expect(isWithinHours(12, 23, 7)).toBe(false);
    expect(isWithinHours(10, 9, 9)).toBe(false);
  });

  it("anuncio respeita as opcoes", () => {
    const ad = DEFAULT_BOT_CONFIG.ad;
    const base = formatCaption(deal(), "https://x");
    expect(base).toContain("OFERTA BOA");
    const plain = formatCaption(deal(), "https://x", "active", { ...ad, showHeader: false, showOldPrice: false, showHashtags: false });
    expect(plain).not.toContain("OFERTA BOA");
    expect(plain).not.toContain("<s>");
    expect(plain).not.toContain("#KaBuM");
    expect(formatCaption(deal(), "https://x", "active", { ...ad, disclosure: "anuncio" })).toContain("#Anúncio");
    const compact = formatCaption(deal(), "https://x", "active", { ...ad, template: "compacto" });
    expect(compact).not.toContain("<s>");
    expect(compact).not.toContain("OFERTA BOA");
  });
});
