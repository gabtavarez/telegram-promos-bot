import { timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
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
import { CompositeCouponProvider } from "./coupons/CompositeCouponProvider.js";
import { MercadoLivreCouponProvider } from "./coupons/MercadoLivreCouponProvider.js";
import type { CouponProvider } from "./coupons/CouponProvider.js";

async function main(): Promise<void> {
  const store: DealsStore = env.UPSTASH_REDIS_REST_URL
    ? new UpstashPostedDealsStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN!)
    : new PostedDealsStore(env.DATA_FILE);
  await store.initialize();

  const providers: AffiliateProvider[] = [new MercadoLivreProvider(env.ML_DEALS_URL)];
  console.log("Coleta publica de ofertas do Mercado Livre ativa.");
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

  const couponsEnabled = env.AWIN_COUPONS_ENABLED ?? Boolean(env.AWIN_PUBLISHER_ID && env.AWIN_ACCESS_TOKEN);
  const couponProviders: CouponProvider[] = [new MercadoLivreCouponProvider()];
  if (couponsEnabled) {
    couponProviders.push(new AwinCouponProvider({
        publisherId: env.AWIN_PUBLISHER_ID!,
        accessToken: env.AWIN_ACCESS_TOKEN!,
        advertiserIds: parseAdvertiserIds(env.AWIN_ADVERTISER_IDS),
      }));
    console.log("Cupons Awin ativos.");
  } else {
    console.log("Cupons Awin desativados: informe AWIN_ACCESS_TOKEN ou defina AWIN_COUPONS_ENABLED=true.");
  }
  const couponProvider = new CompositeCouponProvider(couponProviders);
  console.log("Busca automatica de cupons do Mercado Livre ativa.");

  const job = new DealsJob(
    providers,
    store,
    new TelegramPublisher(env.TELEGRAM_BOT_TOKEN, env.CHANNEL_ID),
    {
      amazon: env.AMAZON_TAG ?? "",
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

  const adminBot = new TelegramAdminBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ADMIN_USER_ID ?? "", job);
  adminBot.start();
  if (!env.TELEGRAM_ADMIN_USER_ID) {
    console.log("Comandos administrativos desativados; alertas publicos continuam ativos.");
  }

  const server = startHttpServer(env.PORT, job, env.RUN_NOW_TOKEN);

  const runCycle = () => {
    void job.run().catch((error) => console.error("Ciclo de ofertas falhou.", error));
  };
  const schedule = env.CRON_SCHEDULE ?? "*/5 * * * *";
  if (!cron.validate(schedule)) throw new Error(`CRON_SCHEDULE invalido: ${schedule}`);
  if (!cron.validate(env.DAILY_SUMMARY_CRON)) throw new Error(`DAILY_SUMMARY_CRON invalido: ${env.DAILY_SUMMARY_CRON}`);

  const tasks = [cron.schedule(schedule, runCycle, { timezone: env.TIMEZONE })];
  if (env.DAILY_SUMMARY_ENABLED) {
    tasks.push(cron.schedule(env.DAILY_SUMMARY_CRON, () => {
      void job.publishDailySummary().catch((error) => console.error("Falha ao publicar resumo diario.", error));
    }, { timezone: env.TIMEZONE }));
  }
  console.log(`Bot iniciado. Ofertas serao verificadas pelo cron: ${schedule} (${env.TIMEZONE}).`);

  // Primeiro ciclo sem bloquear a inicializacao; o lock do job evita sobreposicao com o cron.
  if (env.RUN_ON_START) runCycle();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} recebido; encerrando o bot...`);
    for (const task of tasks) task.stop();
    adminBot.stop();
    server?.close();
    // Ciclos em andamento sao interrompidos; o historico ja reservado impede duplicacao.
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

function parseAdvertiserIds(value?: string): number[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  return ids.length ? ids : undefined;
}

function isValidToken(provided: string | null, expected?: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function startHttpServer(port: number | undefined, job: DealsJob, runNowToken?: string): Server | undefined {
  if (!port) return undefined;
  const send = (response: import("node:http").ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/health") {
      const status = job.getStatus();
      send(response, 200, {
        status: "ok",
        paused: status.paused,
        running: status.running,
        lastRunAt: status.lastRunAt?.toISOString() ?? null,
        lastPublishedAt: status.lastPublishedAt?.toISOString() ?? null,
      });
      return;
    }
    if (url.pathname === "/run-now" || url.pathname === "/test-send") {
      if (!isValidToken(url.searchParams.get("token"), runNowToken)) {
        send(response, 401, { error: "unauthorized" });
        return;
      }
      send(response, 202, { status: "started" });
      const task = url.pathname === "/run-now" ? job.run() : job.testSend();
      void task.catch((error) => console.error("Execucao manual falhou.", error));
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(port, "0.0.0.0", () => console.log(`HTTP ativo na porta ${port}.`));
  return server;
}

process.on("unhandledRejection", (reason) => console.error("Promise rejeitada sem tratamento.", reason));

main().catch((error) => {
  console.error("Nao foi possivel iniciar o bot.", error);
  process.exitCode = 1;
});
