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

describe("categorias em foco", () => {
  it("dobra (forte) ou soma 2 (leve) no limite diario so da categoria em foco", async () => {
    const { priorityLimits } = await import("../src/services/DealsJob.js");
    const forte = parseBotConfig({ priority: { categories: ["gpu", "cpu", "monitor"], strength: "forte" } });
    expect(priorityLimits(forte.diversity, "gpu", forte).maxPerCategoryPerDay).toBe(10);
    expect(priorityLimits(forte.diversity, "teclado", forte).maxPerCategoryPerDay).toBe(5);
    const leve = parseBotConfig({ priority: { categories: ["monitor"], strength: "leve" } });
    expect(priorityLimits(leve.diversity, "monitor", leve).maxPerCategoryPerDay).toBe(7);
  });

  it("da bonus de pontuacao para a categoria em foco", async () => {
    const { scoreCandidate } = await import("../src/services/DealsJob.js");
    const { buildDiversityContext } = await import("../src/quality/diversity.js");
    const ctx = buildDiversityContext([]);
    const gpu = { id: "1", provider: "kabum", title: "Placa de Video RTX 5060 8GB Gigabyte", originalUrl: "https://x", imageUrl: "https://x", currentPrice: 2000 } as const;
    const priority = { categories: ["gpu" as const], strength: "forte" as const };
    expect(scoreCandidate({ ...gpu }, undefined, ctx, priority) - scoreCandidate({ ...gpu }, undefined, ctx)).toBe(35);
  });
});
