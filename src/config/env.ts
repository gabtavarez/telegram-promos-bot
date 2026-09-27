import "dotenv/config";
import { z } from "zod";

const booleanFromString = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true");

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
  AMAZON_ENABLED: booleanFromString(false),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().optional(),
}).refine(
  (value) => Boolean(value.UPSTASH_REDIS_REST_URL) === Boolean(value.UPSTASH_REDIS_REST_TOKEN),
  {
    message: "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN devem ser informados juntos",
    path: ["UPSTASH_REDIS_REST_URL"],
  },
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Variaveis de ambiente ausentes ou invalidas: ${fields}`);
}

export const env = parsed.data;
