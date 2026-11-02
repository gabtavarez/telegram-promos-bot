import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_CONFIG, parseBotConfig } from "../src/config/botConfig.js";
import { assessDeal, hasAmbiguousVariants } from "../src/quality/assess.js";
import { detectBrand } from "../src/quality/brands.js";
import { detectCategory } from "../src/quality/categories.js";
import { buildDiversityContext, diversityBlock } from "../src/quality/diversity.js";
import { scoreCandidate } from "../src/services/DealsJob.js";
import { isSameProduct } from "../src/utils/similarity.js";
import { cleanTitle } from "../src/utils/title.js";
import type { PublishedOffer } from "../src/types/BotState.js";
import type { Deal } from "../src/types/Deal.js";

const quality = DEFAULT_BOT_CONFIG.quality;
const diversity = DEFAULT_BOT_CONFIG.diversity;

const deal = (title: string, extra: Partial<Deal> = {}): Deal => ({
  id: `aliexpress:${title}`,
  provider: "aliexpress",
  title,
  originalUrl: "https://example.com",
  imageUrl: "https://example.com/i.png",
  currentPrice: 200,
  previousPrice: 300,
  discountPercentage: 33,
  ...extra,
});

const offer = (title: string, provider: Deal["provider"], hoursAgo: number): PublishedOffer => ({
  deal: deal(title, { provider }),
  affiliateUrl: "https://example.com",
  messageId: 1,
  messageType: "photo",
  feedbackKey: "k",
  publishedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
  status: "active",
});

describe("categorias e marcas", () => {
  it("classifica produtos completos antes de componentes", () => {
    expect(detectCategory("Notebook Gamer Acer Nitro RTX 4060")).toBe("notebook");
    expect(detectCategory("Placa de Vídeo RTX 4060 8GB")).toBe("gpu");
    expect(detectCategory("Suporte articulado para monitor VESA")).toBe("setup");
    expect(detectCategory("Water Cooler 240mm ARGB")).toBe("cooler");
    expect(detectCategory("Teclado Mecânico Gamer Redragon")).toBe("teclado");
  });

  it("reconhece marcas conhecidas e trata o resto como desconhecido", () => {
    expect(detectBrand("SSD Kingston NV3 1TB").brand).toBe("Kingston");
    expect(detectBrand("SSD WalRam 128GB NVME").known).toBe(false);
  });
});

describe("assessDeal", () => {
  it("barra SSD/RAM/AIO de marca desconhecida e aceita marca conhecida", () => {
    expect(assessDeal(deal("SSD CeaMere 512GB NVME 2280 M.2 PCIe 3.0"), quality).reasons).toContain("marca-desconhecida");
    expect(assessDeal(deal("SSD Kingston NV3 500GB NVMe M.2 PCIe 4.0"), quality).reasons).toEqual([]);
  });

  it("nao exige marca conhecida em categorias nao sensiveis", () => {
    const a = assessDeal(deal("Mouse Gamer Sem Fio Attack Shark X3 PAW3395 Tri-Modo"), quality);
    expect(a.reasons).toEqual([]);
  });

  it("detecta titulos com variacoes misturadas", () => {
    expect(hasAmbiguousVariants("NVME M2 128GB 256GB 512GB 1TB 3.0 2280")).toBe(true);
    expect(hasAmbiguousVariants("Cooler Liquido 120/240/360 ARGB para CPU")).toBe(true);
    expect(hasAmbiguousVariants("SSD Kingston NV3 1TB NVMe")).toBe(false);
  });

  it("respeita categorias desativadas, marcas bloqueadas e reputacao", () => {
    const cfg = { ...quality, disabledCategories: ["teclado" as const], blockedBrands: ["Aula"] };
    expect(assessDeal(deal("Teclado Mecânico Gamer Redragon Kumara"), cfg).reasons).toContain("categoria-desativada");
    expect(assessDeal(deal("Mouse Gamer AULA F810 RGB"), cfg).reasons).toContain("marca-bloqueada");
    expect(assessDeal(deal("Mouse Gamer Redragon Cobra", { rating: 3.9 }), quality).reasons).toContain("avaliacao-baixa");
    expect(assessDeal(deal("Mouse Gamer Redragon Cobra", { sales: 3 }), quality).reasons).toContain("poucas-vendas");
  });

  it("modo rigoroso exige mais qualidade que o amplo", () => {
    const title = "Mouse Gamer Redragon Cobra RGB";
    expect(assessDeal(deal(title), { ...quality, mode: "amplo" }).reasons).toEqual([]);
    expect(assessDeal(deal(title), { ...quality, mode: "rigoroso" }).reasons).toContain("qualidade-baixa");
  });
});

describe("diversidade", () => {
  it("bloqueia a categoria que atingiu o limite diario", () => {
    const offers = [
      offer("Teclado Mecânico Redragon Kumara", "aliexpress", 1),
      offer("Teclado Mecânico Akko 3068", "shopee", 3),
      offer("Teclado Mecânico Keychron K2", "shopee", 5),
    ];
    const ctx = buildDiversityContext(offers);
    const candidate = deal("Teclado Mecânico Havit KB487L");
    expect(diversityBlock(candidate, "teclado", "Havit", ctx, diversity)).toBe("limite-categoria");
    expect(diversityBlock(deal("Monitor AOC 24G2"), "monitor", "AOC", ctx, diversity)).toBeUndefined();
  });

  it("bloqueia marca repetida e loja dominante", () => {
    const offers = [
      offer("Mouse Redragon Cobra", "aliexpress", 1),
      offer("Teclado Redragon Kumara", "aliexpress", 2),
      offer("Monitor AOC", "aliexpress", 3),
      offer("SSD Kingston", "aliexpress", 4),
      offer("Fonte Corsair", "aliexpress", 5),
      offer("Gabinete Gamemax", "kabum", 6),
    ];
    const ctx = buildDiversityContext(offers);
    expect(diversityBlock(deal("Headset Redragon Zeus"), "audio", "Redragon", ctx, diversity)).toBe("limite-marca");
    expect(diversityBlock(deal("Headset HyperX Cloud"), "audio", "HyperX", ctx, diversity)).toBe("limite-loja");
  });

  it("penaliza a categoria da ultima postagem na pontuacao", () => {
    const ctx = buildDiversityContext([offer("Teclado Mecânico Redragon Kumara", "shopee", 1)]);
    const keyboard = deal("Teclado Mecânico Gamer Akko 3068 Hot Swap");
    const monitor = deal("Monitor Gamer AOC 24G2 144Hz IPS");
    const a = (d: Deal) => assessDeal(d, quality);
    expect(scoreCandidate(keyboard, a(keyboard), ctx)).toBeLessThan(
      scoreCandidate(keyboard, a(keyboard), buildDiversityContext([])),
    );
    expect(scoreCandidate(monitor, a(monitor), ctx)).toBe(scoreCandidate(monitor, a(monitor), ctx));
  });
});

describe("repeticao de produto", () => {
  it("marcas diferentes com especificacoes iguais nao sao o mesmo produto", () => {
    expect(isSameProduct(
      "Jonsbo Water Cooler 360mm ARGB LGA1700 AM5 AM4",
      "DeepCool Water Cooler 360mm ARGB LGA1700 AM5 AM4",
    )).toBe(false);
  });

  it("mesmo produto continua sendo detectado", () => {
    expect(isSameProduct(
      "Teclado Mecânico Gamer Redragon Mitra K551RGB-1 Outemu Brown",
      "Teclado Gamer Mecanico Redragon Mitra K551RGB-1 RGB Preto",
    )).toBe(true);
  });
});

describe("cleanTitle", () => {
  it("corta titulos longos num ponto natural", () => {
    const title = "Mouse Gamer Sem Fio ATK Dragonfly A9 Pro Max com Sensor Ultra PAW3395, Leve (57g), Taxa de Polling de 8K, Tri-Modo 2.4G/Bluetooth/Com Fio";
    const cleaned = cleanTitle(title, 110);
    expect(cleaned.length).toBeLessThanOrEqual(111);
    expect(cleaned.endsWith("…")).toBe(true);
    expect(cleaned.startsWith("Mouse Gamer Sem Fio ATK Dragonfly A9 Pro Max")).toBe(true);
  });

  it("nao altera titulos curtos", () => {
    expect(cleanTitle("SSD Kingston NV3 1TB")).toBe("SSD Kingston NV3 1TB");
  });
});

describe("configuracao do painel", () => {
  it("aplica padroes de qualidade e diversidade", () => {
    const cfg = parseBotConfig({});
    expect(cfg.quality.requireKnownBrand).toBe(true);
    expect(cfg.diversity.maxPerCategoryPerDay).toBe(3);
  });

  it("entradas invalidas voltam ao padrao", () => {
    expect(parseBotConfig({ quality: { mode: "xyz" } })).toEqual(DEFAULT_BOT_CONFIG);
  });
});

describe("ajustes de classificacao", () => {
  it("RAM que menciona placa-mae continua sendo RAM", () => {
    expect(detectCategory("Memória RAM Netac DDR5 16GBx2 para Placa-Mãe de PC")).toBe("ram");
    expect(detectCategory("Placa Mãe Gigabyte B550M DDR4")).toBe("placa-mae");
  });

  it("kits antigos de upgrade sao considerados baixa qualidade", () => {
    const old = assessDeal(deal("Kit Upgrade, Processador Intel Core i5-3ª, Placa-Mãe 1155"), quality);
    expect(old.reasons).toContain("qualidade-baixa");
  });
});
