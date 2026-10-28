import { z } from "zod";

/**
 * Contrato de configuracao editavel pelo painel web.
 * Copia de src/config/botConfig.ts do repositorio do bot; mantenha os dois identicos.
 */
const hour = z.number().int().min(0).max(23);
const keywords = z.array(z.string().trim().min(1).max(40)).max(40);

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
  }).default({
    paused: false,
    quietHours: { enabled: false, start: 23, end: 7 },
    minMinutesBetweenPosts: 0,
    dailyLimit: 0,
    repeatWindowHours: 48,
    repostPriceDropPercent: 8,
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
  }),
});

export type BotConfig = z.infer<typeof botConfigSchema>;
export type AdOptions = BotConfig["ad"];
export type StoreKey = keyof BotConfig["filters"]["stores"];

export const DEFAULT_BOT_CONFIG: BotConfig = botConfigSchema.parse({});

/** Entrada invalida nunca derruba o bot: volta para o padrao. */
export function parseBotConfig(raw: unknown): BotConfig {
  const result = botConfigSchema.safeParse(raw ?? {});
  return result.success ? result.data : DEFAULT_BOT_CONFIG;
}
