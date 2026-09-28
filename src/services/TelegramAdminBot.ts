import { Bot } from "grammy";
import type { DealsJob, JobRunResult } from "./DealsJob.js";

export class TelegramAdminBot {
  private readonly bot: Bot;

  constructor(token: string, private readonly adminUserId: string, private readonly job: DealsJob) {
    this.bot = new Bot(token);
    this.registerHandlers();
  }

  start(): void {
    this.bot.catch((error) => console.error("Falha no bot administrativo.", error.error));
    void this.bot.api.setMyCommands([
      { command: "oferta", description: "Publicar uma oferta agora" },
      { command: "status", description: "Ver o estado do bot" },
      { command: "pausar", description: "Pausar publicações automáticas" },
      { command: "retomar", description: "Retomar publicações automáticas" },
    ]).catch((error) => console.error("Falha ao configurar comandos.", error));
    void this.bot
      .start({ onStart: () => console.log("Comandos administrativos do Telegram ativos.") })
      .catch((error) => console.error("Nao foi possivel iniciar os comandos do Telegram.", error));
  }

  private registerHandlers(): void {
    this.bot.use(async (context, next) => {
      if (String(context.from?.id) !== this.adminUserId) {
        if (context.message?.text?.startsWith("/")) await context.reply("⛔ Comando não autorizado.");
        return;
      }
      await next();
    });

    this.bot.command("oferta", async (context) => {
      await context.reply("🔎 Buscando uma oferta para publicar...");
      const result = await this.job.run(true);
      await context.reply(runResultMessage(result));
    });

    this.bot.command("status", async (context) => {
      const status = this.job.getStatus();
      await context.reply([
        status.paused ? "⏸️ Bot pausado" : "✅ Bot ativo",
        status.running ? "🔄 Busca em andamento" : "💤 Aguardando próximo ciclo",
        `🏪 Lojas: ${status.providers.join(", ")}`,
        `🕒 Última busca: ${formatDate(status.lastRunAt)}`,
        `📤 Última publicação: ${formatDate(status.lastPublishedAt)}`,
        status.lastPublishedTitle ? `📦 ${status.lastPublishedTitle}` : undefined,
      ].filter(Boolean).join("\n"));
    });

    this.bot.command("pausar", async (context) => {
      this.job.pause();
      await context.reply("⏸️ Publicações automáticas pausadas.");
    });

    this.bot.command("retomar", async (context) => {
      this.job.resume();
      await context.reply("▶️ Publicações automáticas retomadas.");
    });
  }
}

function runResultMessage(result: JobRunResult): string {
  const messages: Record<JobRunResult, string> = {
    published: "✅ Oferta publicada no canal.",
    "no-deal": "ℹ️ Nenhuma oferta nova disponível agora.",
    "already-running": "🔄 Já existe uma busca em andamento.",
    paused: "⏸️ O bot está pausado.",
  };
  return messages[result];
}

function formatDate(date?: Date): string {
  return date?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? "ainda não ocorreu";
}
