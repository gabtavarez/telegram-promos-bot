import "dotenv/config";
import { z } from "zod";

const booleanFromString = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true");

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  CHANNEL_ID: z.string().min(2),
  AMAZON_TAG: z.string().min(1),
  ML_TAG: z.string().min(1),
  AMAZON_DEALS_URL: z.url().default("https://www.amazon.com.br/deals?node=16339926011"),
  ML_DEALS_URL: z
    .url()
    .default("https://www.mercadolivre.com.br/ofertas/?cat=MLB421969&category=MLB1648"),
  DATA_FILE: z.string().default("./data/posted-deals.json"),
  RUN_ON_START: booleanFromString(true),
  RUN_NOW_TOKEN: optionalString,
  TELEGRAM_ADMIN_USER_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d+$/).optional(),
  ),
  CRON_SCHEDULE: optionalString,
  AMAZON_ENABLED: booleanFromString(false),
  ALIEXPRESS_ENABLED: booleanFromString(false),
  ALIEXPRESS_APP_KEY: optionalString,
  ALIEXPRESS_APP_SECRET: optionalString,
  ALIEXPRESS_TRACKING_ID: optionalString,
  SHOPEE_ENABLED: booleanFromString(false),
  SHOPEE_APP_ID: optionalString,
  SHOPEE_APP_SECRET: optionalString,
  KABUM_ENABLED: booleanFromString(false),
  KABUM_AWIN_ADVERTISER_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d+$/).optional(),
  ),
  KABUM_AWIN_FEED_URL: optionalUrl,
  KABUM_AWIN_FEED_LOCALE: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/).default("pt_BR"),
  KABUM_CLICK_REF: z.string().default("telegram_canal"),
  AWIN_COUPONS_ENABLED: booleanFromString(false),
  AWIN_PUBLISHER_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d+$/).optional(),
  ),
  AWIN_ACCESS_TOKEN: optionalString,
  AWIN_ADVERTISER_IDS: optionalString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  PORT: z.coerce.number().int().positive().optional(),
})
  .refine(
    (value) => Boolean(value.UPSTASH_REDIS_REST_URL) === Boolean(value.UPSTASH_REDIS_REST_TOKEN),
    {
      message: "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN devem ser informados juntos",
      path: ["UPSTASH_REDIS_REST_URL"],
    },
  )
  .refine(
    (value) =>
      !value.ALIEXPRESS_ENABLED ||
      Boolean(value.ALIEXPRESS_APP_KEY && value.ALIEXPRESS_APP_SECRET && value.ALIEXPRESS_TRACKING_ID),
    {
      message: "Credenciais do AliExpress sao obrigatorias quando ALIEXPRESS_ENABLED=true",
      path: ["ALIEXPRESS_APP_KEY"],
    },
  )
  .refine(
    (value) => !value.SHOPEE_ENABLED || Boolean(value.SHOPEE_APP_ID && value.SHOPEE_APP_SECRET),
    {
      message: "SHOPEE_APP_ID e SHOPEE_APP_SECRET sao obrigatorios quando SHOPEE_ENABLED=true",
      path: ["SHOPEE_APP_ID"],
    },
  )
  .refine(
    (value) => !value.AWIN_COUPONS_ENABLED || Boolean(value.AWIN_PUBLISHER_ID && value.AWIN_ACCESS_TOKEN),
    {
      message: "AWIN_PUBLISHER_ID e AWIN_ACCESS_TOKEN sao obrigatorios quando AWIN_COUPONS_ENABLED=true",
      path: ["AWIN_PUBLISHER_ID"],
    },
  )
  .refine(
    (value) => !value.KABUM_ENABLED || Boolean(value.KABUM_AWIN_ADVERTISER_ID && value.AWIN_PUBLISHER_ID),
    {
      message: "KABUM_AWIN_ADVERTISER_ID e AWIN_PUBLISHER_ID sao obrigatorios quando KABUM_ENABLED=true",
      path: ["KABUM_AWIN_ADVERTISER_ID"],
    },
  )
  .refine(
    (value) => !value.KABUM_ENABLED || Boolean(value.KABUM_AWIN_FEED_URL || value.AWIN_ACCESS_TOKEN),
    {
      message: "KABUM_AWIN_FEED_URL ou AWIN_ACCESS_TOKEN sao obrigatorios quando KABUM_ENABLED=true",
      path: ["KABUM_AWIN_FEED_URL"],
    },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Variaveis de ambiente ausentes ou invalidas: ${fields}`);
}

export const env = parsed.data;
