import { z } from "zod";

/**
 * Contrato de configuracao editavel pelo painel web.
 * Mantenha este arquivo identico a lib/botConfig.ts do repositorio do dashboard.
 */
const hour = z.number().int().min(0).max(23);
const keywords = z.array(z.string().trim().min(1).max(40)).max(40);

/** Categorias de produto reconhecidas pelo bot (usadas em filtros e limites de diversidade). */
export const CATEGORY_IDS = [
  "gpu", "cpu", "placa-mae", "ram", "ssd", "fonte", "gabinete", "cooler", "monitor",
  "teclado", "mouse", "audio", "cadeira", "setup", "celular", "notebook", "tv",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];
const category = z.enum(CATEGORY_IDS);

export const botConfigSchema = z.object({
  version: z.literal(1).default(1),
  bot: z.object({
    paused: z.boolean().default(false),
    quietHours: z.object({
      enabled: z.boolean().default(false),
      start: hour.default(23),
      end: hour.default(7),
    }).default({ enabled: false, start: 23, end: 7 }),
    minMinutesBetweenPosts: z.number().int().min(0).max(720).default(0),
    dailyLimit: z.number().int().min(0).max(500).default(0),
    repeatWindowHours: z.number().int().min(12).max(336).default(48),
    repostPriceDropPercent: z.number().min(1).max(50).default(8),
    /** Modo evento (11.11, Black Friday): limites de diversidade em dobro e canal nunca fica parado. */
    eventMode: z.boolean().default(false),
    /** Madrugada: so ofertas excepcionais e no maximo uma por hora (as boas ficam para o dia). */
    nightMode: z.object({
      enabled: z.boolean().default(true),
      start: hour.default(0),
      end: hour.default(7),
      minDiscount: z.number().int().min(0).max(90).default(25),
    }).default({ enabled: true, start: 0, end: 7, minDiscount: 25 }),
  }).default({
    paused: false,
    quietHours: { enabled: false, start: 23, end: 7 },
    minMinutesBetweenPosts: 0,
    dailyLimit: 0,
    repeatWindowHours: 48,
    repostPriceDropPercent: 8,
    eventMode: false,
    nightMode: { enabled: true, start: 0, end: 7, minDiscount: 25 },
  }),
  filters: z.object({
    minDiscount: z.number().min(0).max(90).default(0),
    minPrice: z.number().min(0).max(1_000_000).default(0),
    maxPrice: z.number().min(0).max(1_000_000).default(0),
    stores: z.object({
      "mercado-livre": z.boolean().default(true),
      amazon: z.boolean().default(true),
      kabum: z.boolean().default(true),
      shopee: z.boolean().default(true),
      aliexpress: z.boolean().default(true),
    }).default({ "mercado-livre": true, amazon: true, kabum: true, shopee: true, aliexpress: true }),
    requiredKeywords: keywords.default([]),
    blockedKeywords: keywords.default([]),
    onlyWithCoupon: z.boolean().default(false),
  }).default({
    minDiscount: 0,
    minPrice: 0,
    maxPrice: 0,
    stores: { "mercado-livre": true, amazon: true, kabum: true, shopee: true, aliexpress: true },
    requiredKeywords: [],
    blockedKeywords: [],
    onlyWithCoupon: false,
  }),
  ad: z.object({
    template: z.enum(["completo", "compacto"]).default("completo"),
    showHeader: z.boolean().default(true),
    showOldPrice: z.boolean().default(true),
    showCouponExpiry: z.boolean().default(true),
    showHashtags: z.boolean().default(true),
    showButtons: z.boolean().default(true),
    showAlertFooter: z.boolean().default(true),
    disclosure: z.enum(["none", "anuncio"]).default("none"),
    ctaLabel: z.string().trim().min(1).max(30).default("🛒 VER OFERTA"),
    customFooter: z.string().trim().max(120).default(""),
    titleMaxLength: z.number().int().min(40).max(200).default(110),
    showStoreLine: z.boolean().default(true),
  }).default({
    template: "completo",
    showHeader: true,
    showOldPrice: true,
    showCouponExpiry: true,
    showHashtags: true,
    showButtons: true,
    showAlertFooter: true,
    disclosure: "none",
    ctaLabel: "🛒 VER OFERTA",
    customFooter: "",
    titleMaxLength: 110,
    showStoreLine: true,
  }),
  quality: z.object({
    mode: z.enum(["rigoroso", "equilibrado", "amplo"]).default("equilibrado"),
    /** Em categorias sensiveis, so passam marcas conhecidas (evita SSD/RAM/AIO "genericos"). */
    requireKnownBrand: z.boolean().default(true),
    strictCategories: z.array(category).default(["ram", "ssd", "fonte", "cooler", "gpu", "cpu", "placa-mae", "monitor"]),
    blockAmbiguousTitles: z.boolean().default(true),
    minRating: z.number().min(0).max(5).default(4.5),
    minSales: z.number().int().min(0).max(100_000).default(30),
    disabledCategories: z.array(category).default([]),
    blockedBrands: keywords.default([]),
    preferredBrands: keywords.default([]),
  }).default({
    mode: "equilibrado",
    requireKnownBrand: true,
    strictCategories: ["ram", "ssd", "fonte", "cooler", "gpu", "cpu", "placa-mae", "monitor"],
    blockAmbiguousTitles: true,
    minRating: 4.5,
    minSales: 30,
    disabledCategories: [],
    blockedBrands: [],
    preferredBrands: [],
  }),
  diversity: z.object({
    /** Maximo de ofertas da mesma categoria nas ultimas 24h (0 = sem limite). */
    maxPerCategoryPerDay: z.number().int().min(0).max(50).default(5),
    /** Maximo de ofertas da mesma marca nas ultimas 24h (0 = sem limite). */
    maxPerBrandPerDay: z.number().int().min(0).max(50).default(3),
    /** Participacao maxima de uma loja nas ultimas 24h, em % (0 = sem limite). */
    maxStoreSharePercent: z.number().int().min(0).max(100).default(60),
    /** Sem post ha esse tempo e com ofertas boas na fila, os limites viram so preferencia (0 = nunca). */
    maxSilenceMinutes: z.number().int().min(0).max(720).default(45),
  }).default({ maxPerCategoryPerDay: 5, maxPerBrandPerDay: 3, maxStoreSharePercent: 60, maxSilenceMinutes: 45 }),
});

export type BotConfig = z.infer<typeof botConfigSchema>;
export type AdOptions = BotConfig["ad"];
export type StoreKey = keyof BotConfig["filters"]["stores"];

export const DEFAULT_BOT_CONFIG: BotConfig = botConfigSchema.parse({});

/** Entrada invalida nunca derruba o bot: volta para o padrao. */
export function parseBotConfig(raw: unknown): BotConfig {
  const result = botConfigSchema.safeParse(migrateDiversity(raw ?? {}));
  return result.success ? result.data : DEFAULT_BOT_CONFIG;
}

/**
 * Os limites antigos (3 por categoria / 2 por marca) travavam o canal. Configuracoes salvas
 * exatamente com esses valores antigos (sem o campo novo) passam para os padroes atuais.
 */
function migrateDiversity(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const config = raw as Record<string, unknown>;
  const diversity = config.diversity as Record<string, unknown> | undefined;
  if (!diversity || "maxSilenceMinutes" in diversity) return raw;
  const legacy = diversity.maxPerCategoryPerDay === 3 && diversity.maxPerBrandPerDay === 2;
  return {
    ...config,
    diversity: legacy ? { ...diversity, maxPerCategoryPerDay: 5, maxPerBrandPerDay: 3 } : diversity,
  };
}
