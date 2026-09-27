import { createServer } from "node:http";
import cron from "node-cron";
import { env } from "./config/env.js";
import type { AffiliateProvider } from "./providers/AffiliateProvider.js";
import { AmazonProvider } from "./providers/AmazonProvider.js";
import { MercadoLivreProvider } from "./providers/MercadoLivreProvider.js";
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

  const job = new DealsJob(
    providers,
    store,
    new TelegramPublisher(env.TELEGRAM_BOT_TOKEN, env.CHANNEL_ID),
    { amazon: env.AMAZON_TAG, mercadoLivre: env.ML_TAG },
  );

  startHealthServer(env.PORT);

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

function startHealthServer(port?: number): void {
  if (!port) return;
  createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"ok"}');
      return;
    }
    response.writeHead(404).end();
  }).listen(port, "0.0.0.0", () => console.log(`Health check ativo na porta ${port}.`));
}

main().catch((error) => {
  console.error("Nao foi possivel iniciar o bot.", error);
  process.exitCode = 1;
});
