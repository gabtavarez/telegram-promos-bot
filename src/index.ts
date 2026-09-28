import { createServer } from "node:http";
import cron from "node-cron";
import { env } from "./config/env.js";
import type { AffiliateProvider } from "./providers/AffiliateProvider.js";
import { AmazonProvider } from "./providers/AmazonProvider.js";
import { MercadoLivreProvider } from "./providers/MercadoLivreProvider.js";
import { AliExpressProvider } from "./providers/aliexpress.provider.js";
import { DealsJob } from "./services/DealsJob.js";
import { TelegramPublisher } from "./services/TelegramPublisher.js";
import type { DealsStore } from "./storage/DealsStore.js";
import { PostedDealsStore } from "./storage/PostedDealsStore.js";
import { UpstashPostedDealsStore } from "./storage/UpstashPostedDealsStore.js";

async function main(): Promise<void> {
  const store: DealsStore = env.UPSTASH_REDIS_REST_URL
    ? new UpstashPostedDealsStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN!)
    : new PostedDealsStore(env.DATA_FILE);
  await store.initialize();

  const providers: AffiliateProvider[] = [new MercadoLivreProvider(env.ML_DEALS_URL)];
  if (env.AMAZON_ENABLED) providers.push(new AmazonProvider(env.AMAZON_DEALS_URL));
  if (env.ALIEXPRESS_ENABLED) {
    providers.push(
      new AliExpressProvider({
        appKey: env.ALIEXPRESS_APP_KEY!,
        appSecret: env.ALIEXPRESS_APP_SECRET!,
        trackingId: env.ALIEXPRESS_TRACKING_ID!,
      }),
    );
  }

  const job = new DealsJob(
    providers,
    store,
    new TelegramPublisher(env.TELEGRAM_BOT_TOKEN, env.CHANNEL_ID),
    { amazon: env.AMAZON_TAG, mercadoLivre: env.ML_TAG },
  );

  startHttpServer(env.PORT, () => job.run(), () => job.testSend(), env.RUN_NOW_TOKEN);

  const intervalMs = 45 * 60 * 1_000;
  let nextRunAt = Date.now() + intervalMs;
  cron.schedule("* * * * *", () => {
    const now = Date.now();
    if (now < nextRunAt) return;
    nextRunAt = now + intervalMs;
    void job.run().catch((error) => console.error("Ciclo de ofertas falhou.", error));
  });
  console.log("Bot iniciado. Ofertas serao verificadas a cada 45 minutos.");

  if (env.RUN_ON_START) {
    await job.run();
    nextRunAt = Date.now() + intervalMs;
  }
}

function startHttpServer(
  port: number | undefined,
  runNow: () => Promise<void>,
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
