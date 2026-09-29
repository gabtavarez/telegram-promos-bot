import { Bot, InlineKeyboard } from "grammy";
import type { DealsJob, JobRunResult } from "./DealsJob.js";
import { formatCaption } from "./TelegramPublisher.js";

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
      { command: "buscar", description: "Buscar ofertas por termo" },
      { command: "cupons", description: "Listar cupons ativos" },
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

    this.bot.command("buscar", async (context) => {
      const query = context.match.trim().slice(0, 80);
      if (query.length < 2) {
        await context.reply("Use assim: /buscar SSD NVMe");
        return;
      }

      await context.reply(`🔎 Buscando ofertas para: ${query}`);
      const results = await this.job.search(query);
      if (results.length === 0) {
        await context.reply("ℹ️ Nenhuma oferta correspondente encontrada agora.");
        return;
      }

      for (const { deal, affiliateUrl } of results) {
        const caption = formatCaption(deal, affiliateUrl);
        const keyboard = new InlineKeyboard().url("✅ VER OFERTA", affiliateUrl);
        try {
          await context.api.sendPhoto(context.chat.id, deal.imageUrl, {
            caption,
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
        } catch {
          await context.api.sendMessage(context.chat.id, caption, {
            parse_mode: "HTML",
            reply_markup: keyboard,
            link_preview_options: { is_disabled: false },
          });
        }
      }
    });

    this.bot.command("cupons", async (context) => {
      await context.reply("🎟️ Consultando cupons ativos...");
      const coupons = await this.job.getActiveCoupons();
      if (coupons.length === 0) {
        await context.reply("ℹ️ Nenhum cupom ativo encontrado ou a integração Awin está desativada.");
        return;
      }

      const visible = coupons.slice(0, 15);
      const lines = visible.map((coupon) => [
        `🎟️ <code>${escapeHtml(coupon.code)}</code> — <b>${escapeHtml(coupon.advertiserName)}</b>`,
        escapeHtml(coupon.title.slice(0, 120)),
        `⏳ Até ${formatDateOnly(coupon.endsAt)}`,
      ].join("\n"));
      if (coupons.length > visible.length) lines.push(`… e mais ${coupons.length - visible.length} cupom(ns).`);
      await context.reply(lines.join("\n\n"), { parse_mode: "HTML" });
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

function formatDateOnly(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
