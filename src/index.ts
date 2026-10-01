import { createServer } from "node:http";
import cron from "node-cron";
import { env } from "./config/env.js";
import type { AffiliateProvider } from "./providers/AffiliateProvider.js";
import { AmazonProvider } from "./providers/AmazonProvider.js";
import { MercadoLivreProvider } from "./providers/MercadoLivreProvider.js";
import { AliExpressProvider } from "./providers/aliexpress.provider.js";
import { KabumProvider } from "./providers/KabumProvider.js";
import { ShopeeProvider } from "./providers/ShopeeProvider.js";
import { DealsJob } from "./services/DealsJob.js";
import { TelegramPublisher } from "./services/TelegramPublisher.js";
import { TelegramAdminBot } from "./services/TelegramAdminBot.js";
import type { DealsStore } from "./storage/DealsStore.js";
import { PostedDealsStore } from "./storage/PostedDealsStore.js";
import { UpstashPostedDealsStore } from "./storage/UpstashPostedDealsStore.js";
import { AwinCouponProvider } from "./coupons/AwinCouponProvider.js";

async function main(): Promise<void> {
  const store: DealsStore = env.UPSTASH_REDIS_REST_URL
    ? new UpstashPostedDealsStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN!)
    : new PostedDealsStore(env.DATA_FILE);
  await store.initialize();

  const providers: AffiliateProvider[] = [new MercadoLivreProvider(env.ML_DEALS_URL)];
  if (env.AMAZON_ENABLED) providers.push(new AmazonProvider(env.AMAZON_DEALS_URL));
  if (env.KABUM_ENABLED && (env.KABUM_AWIN_FEED_URL || env.AWIN_ACCESS_TOKEN)) {
    providers.push(
      new KabumProvider({
        publisherId: env.AWIN_PUBLISHER_ID!,
        advertiserId: env.KABUM_AWIN_ADVERTISER_ID!,
        accessToken: env.AWIN_ACCESS_TOKEN,
        feedUrl: env.KABUM_AWIN_FEED_URL,
        locale: env.KABUM_AWIN_FEED_LOCALE,
      }),
    );
  } else if (env.KABUM_ENABLED) {
    console.warn("Kabum desativada neste ciclo: KABUM_AWIN_FEED_URL ou AWIN_ACCESS_TOKEN nao configurado.");
  }
  if (env.SHOPEE_ENABLED) {
    providers.push(
      new ShopeeProvider({
        appId: env.SHOPEE_APP_ID!,
        appSecret: env.SHOPEE_APP_SECRET!,
      }),
    );
  }
  if (env.ALIEXPRESS_ENABLED) {
    providers.push(
      new AliExpressProvider({
        appKey: env.ALIEXPRESS_APP_KEY!,
        appSecret: env.ALIEXPRESS_APP_SECRET!,
        trackingId: env.ALIEXPRESS_TRACKING_ID!,
      }),
    );
  }

  const couponProvider = env.AWIN_COUPONS_ENABLED
    ? new AwinCouponProvider({
        publisherId: env.AWIN_PUBLISHER_ID!,
        accessToken: env.AWIN_ACCESS_TOKEN!,
        advertiserIds: parseAdvertiserIds(env.AWIN_ADVERTISER_IDS),
      })
    : undefined;

  const job = new DealsJob(
    providers,
    store,
    new TelegramPublisher(env.TELEGRAM_BOT_TOKEN, env.CHANNEL_ID),
    {
      amazon: env.AMAZON_TAG,
      mercadoLivre: env.ML_TAG,
      kabum: env.KABUM_ENABLED
        ? {
            advertiserId: env.KABUM_AWIN_ADVERTISER_ID!,
            publisherId: env.AWIN_PUBLISHER_ID!,
            clickRef: env.KABUM_CLICK_REF,
          }
        : undefined,
    },
    couponProvider,
  );

  if (env.TELEGRAM_ADMIN_USER_ID) {
    new TelegramAdminBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ADMIN_USER_ID, job).start();
  } else {
    console.log("Comandos administrativos desativados: TELEGRAM_ADMIN_USER_ID nao configurado.");
  }

  startHttpServer(env.PORT, () => job.run(), () => job.testSend(), env.RUN_NOW_TOKEN);

  const defaultIntervalMs = 5 * 60 * 1_000;
  let nextRunAt = Date.now() + defaultIntervalMs;
  if (env.CRON_SCHEDULE) {
    if (!cron.validate(env.CRON_SCHEDULE)) throw new Error(`CRON_SCHEDULE invalido: ${env.CRON_SCHEDULE}`);
    cron.schedule(env.CRON_SCHEDULE, () => {
      void job.run().catch((error) => console.error("Ciclo de ofertas falhou.", error));
    });
    console.log(`Bot iniciado. Ofertas serao verificadas pelo cron: ${env.CRON_SCHEDULE}.`);
  } else {
    cron.schedule("* * * * *", () => {
      const now = Date.now();
      if (now < nextRunAt) return;
      nextRunAt = now + defaultIntervalMs;
      void job.run().catch((error) => console.error("Ciclo de ofertas falhou.", error));
    });
    console.log("Bot iniciado. Ofertas serao verificadas a cada 5 minutos.");
  }

  if (env.RUN_ON_START) {
    await job.run();
    nextRunAt = Date.now() + defaultIntervalMs;
  }
}

function parseAdvertiserIds(value?: string): number[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  return ids.length ? ids : undefined;
}

function startHttpServer(
  port: number | undefined,
  runNow: () => Promise<unknown>,
  testSend: () => Promise<void>,
  runNowToken?: string,
): void {
  if (!port) return;
  createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"ok"}');
      return;
    }
    if (url.pathname === "/run-now") {
      if (!runNowToken || url.searchParams.get("token") !== runNowToken) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end('{"error":"unauthorized"}');
        return;
      }

      response.writeHead(202, { "content-type": "application/json" });
      response.end('{"status":"started"}');
      void runNow().catch((error) => console.error("Execucao manual falhou.", error));
      return;
    }
    if (url.pathname === "/test-send") {
      if (!runNowToken || url.searchParams.get("token") !== runNowToken) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end('{"error":"unauthorized"}');
        return;
      }

      response.writeHead(202, { "content-type": "application/json" });
      response.end('{"status":"started"}');
      void testSend().catch((error) => console.error("Envio de teste falhou.", error));
      return;
    }
    response.writeHead(404).end();
  }).listen(port, "0.0.0.0", () => console.log(`HTTP ativo na porta ${port}.`));
}

main().catch((error) => {
  console.error("Nao foi possivel iniciar o bot.", error);
  process.exitCode = 1;
});
