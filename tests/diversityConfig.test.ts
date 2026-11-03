import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_CONFIG, parseBotConfig } from "../src/config/botConfig.js";
import { effectiveDiversity } from "../src/services/DealsJob.js";

describe("configuracao de diversidade", () => {
  it("migra os limites antigos que travavam o canal", () => {
    const cfg = parseBotConfig({ diversity: { maxPerCategoryPerDay: 3, maxPerBrandPerDay: 2, maxStoreSharePercent: 60 } });
    expect(cfg.diversity).toEqual({ maxPerCategoryPerDay: 5, maxPerBrandPerDay: 3, maxStoreSharePercent: 60, maxSilenceMinutes: 45 });
  });

  it("respeita limites personalizados", () => {
    const cfg = parseBotConfig({ diversity: { maxPerCategoryPerDay: 8, maxPerBrandPerDay: 4, maxStoreSharePercent: 70 } });
    expect(cfg.diversity.maxPerCategoryPerDay).toBe(8);
    expect(parseBotConfig({ diversity: { maxPerCategoryPerDay: 3, maxPerBrandPerDay: 2, maxStoreSharePercent: 60, maxSilenceMinutes: 30 } }).diversity.maxPerCategoryPerDay).toBe(3);
  });

  it("modo evento dobra os limites e encurta o silencio", () => {
    const cfg = { ...DEFAULT_BOT_CONFIG, bot: { ...DEFAULT_BOT_CONFIG.bot, eventMode: true } };
    expect(effectiveDiversity(cfg)).toEqual({ maxPerCategoryPerDay: 10, maxPerBrandPerDay: 6, maxStoreSharePercent: 75, maxSilenceMinutes: 20 });
    expect(effectiveDiversity(DEFAULT_BOT_CONFIG)).toEqual(DEFAULT_BOT_CONFIG.diversity);
  });
});
