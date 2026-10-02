import { Bot, InlineKeyboard } from "grammy";
import type { DealsJob, JobRunResult } from "./DealsJob.js";
import { formatCaption, getPhotoForTelegram } from "./TelegramPublisher.js";

export class TelegramAdminBot {
  private readonly bot: Bot;

  constructor(token: string, private readonly adminUserId: string, private readonly job: DealsJob) {
    this.bot = new Bot(token);
    this.registerHandlers();
  }

  start(): void {
    this.bot.catch((error) => console.error("Falha no bot administrativo.", error.error));
    const publicCommands = [
      { command: "alerta", description: "Criar alerta de produto e preço" },
      { command: "meus_alertas", description: "Listar seus alertas" },
      { command: "remover_alerta", description: "Remover um alerta" },
    ];
    const adminCommands = [
      { command: "oferta", description: "Publicar uma oferta agora" },
      { command: "teste", description: "Testar o novo modelo de mensagem" },
      { command: "status", description: "Ver o estado do bot" },
      { command: "buscar", description: "Buscar ofertas por termo" },
      { command: "cupons", description: "Listar cupons ativos" },
      { command: "pausar", description: "Pausar publicações automáticas" },
      { command: "retomar", description: "Retomar publicações automáticas" },
      ...publicCommands,
    ];
    void this.bot.api.setMyCommands(publicCommands)
      .then(() => this.adminUserId
        ? this.bot.api.setMyCommands(adminCommands, {
            scope: { type: "chat", chat_id: Number(this.adminUserId) },
          })
        : undefined)
      .catch((error) => console.error("Falha ao configurar comandos.", error));
    this.startPolling();
  }

  private registerHandlers(): void {
    this.bot.command("start", async (context) => {
      await context.reply([
        "👋 Bem-vindo ao bot do Tavarez Promos!",
        "",
        "Crie alertas personalizados e receba ofertas quando o produto chegar ao preço desejado.",
        "",
        "Exemplo:",
        "/alerta RTX 4060 abaixo de 1900",
        "/alerta SSD NVMe 1TB | 350",
        "",
        "Use /meus_alertas para consultar e /remover_alerta ID para excluir.",
      ].join("\n"));
    });

    this.bot.command("alerta", async (context) => {
      if (!ensurePrivateChat(context.chat.type)) {
        await context.reply("Envie esse comando no chat privado com o bot para proteger seus alertas.");
        return;
      }
      const parsed = parseAlertInput(context.match.trim().slice(0, 120));
      if (!parsed) {
        await context.reply("Use assim: /alerta RTX 4060 abaixo de 1900\nOu: /alerta SSD NVMe 1TB | 350");
        return;
      }
      const userId = String(context.from?.id);
      const existing = await this.job.listAlerts(userId);
      if (existing.length >= 10) {
        await context.reply("Você já possui 10 alertas. Remova um com /remover_alerta ID antes de criar outro.");
        return;
      }
      const alert = await this.job.createAlert(userId, parsed.query, parsed.maxPrice);
      await context.reply([
        "✅ Alerta criado!",
        `🔎 Produto: ${alert.query}`,
        alert.maxPrice ? `💰 Até ${formatCurrency(alert.maxPrice)}` : "💰 Qualquer preço aprovado pelo filtro",
        `🆔 ${alert.id}`,
      ].join("\n"));
    });

    this.bot.command("meus_alertas", async (context) => {
      if (!ensurePrivateChat(context.chat.type)) {
        await context.reply("Consulte seus alertas no chat privado com o bot.");
        return;
      }
      const alerts = await this.job.listAlerts(String(context.from?.id));
      if (alerts.length === 0) {
        await context.reply("Você ainda não possui alertas. Crie um com /alerta.");
        return;
      }
      await context.reply(alerts.map((alert) =>
        `🆔 ${alert.id} · ${alert.query}${alert.maxPrice ? ` · até ${formatCurrency(alert.maxPrice)}` : ""}`,
      ).join("\n"));
    });

    this.bot.command("remover_alerta", async (context) => {
      if (!ensurePrivateChat(context.chat.type)) {
        await context.reply("Remova alertas no chat privado com o bot.");
        return;
      }
      const id = context.match.trim().split(/\s+/)[0];
      if (!id) {
        await context.reply("Use assim: /remover_alerta ID");
        return;
      }
      const removed = await this.job.removeAlert(String(context.from?.id), id);
      await context.reply(removed ? "✅ Alerta removido." : "ℹ️ Alerta não encontrado.");
    });

    this.bot.command("oferta", async (context) => {
      if (!(await this.requireAdmin(context))) return;
      await context.reply("🔎 Buscando uma oferta para publicar...");
      const result = await this.job.run(true);
      await context.reply(runResultMessage(result));
    });

    this.bot.command("teste", async (context) => {
      if (!(await this.requireAdmin(context))) return;
      await context.reply("🧪 Preparando uma mensagem de teste...");
      await this.job.testSend();
      await context.reply("✅ Mensagem de teste enviada ao canal sem alterar o histórico.");
    });

    this.bot.command("status", async (context) => {
      if (!(await this.requireAdmin(context))) return;
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
      if (!(await this.requireAdmin(context))) return;
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
          const photo = await getPhotoForTelegram(deal.imageUrl);
          await context.api.sendPhoto(context.chat.id, photo, {
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
      if (!(await this.requireAdmin(context))) return;
      const initialStatus = this.job.getCouponIntegrationStatus();
      if (!initialStatus.enabled) {
        await context.reply([
          "⚠️ A busca de cupons Awin não está ativa.",
          "Configure AWIN_ACCESS_TOKEN e AWIN_PUBLISHER_ID no Render.",
          "O feed de produtos da KaBuM, sozinho, não fornece os cupons da Awin.",
        ].join("\n"));
        return;
      }

      await context.reply("🎟️ Consultando cupons ativos...");
      const coupons = await this.job.getActiveCoupons();
      if (coupons.length === 0) {
        const status = this.job.getCouponIntegrationStatus();
        await context.reply(status.error
          ? `❌ A Awin não pôde ser consultada (${escapeHtml(status.error.slice(0, 180))}). Confira o token e os logs do Render.`
          : "ℹ️ A Awin respondeu normalmente, mas não há cupons com código ativos para os anunciantes afiliados neste momento.",
          { parse_mode: "HTML" },
        );
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
      if (!(await this.requireAdmin(context))) return;
      this.job.pause();
      await context.reply("⏸️ Publicações automáticas pausadas.");
    });

    this.bot.command("retomar", async (context) => {
      if (!(await this.requireAdmin(context))) return;
      this.job.resume();
      await context.reply("▶️ Publicações automáticas retomadas.");
    });
  }

  private startPolling(attempt = 1): void {
    void this.bot
      .start({ onStart: () => console.log("Comandos e alertas do Telegram ativos.") })
      .catch((error) => {
        console.error("Nao foi possivel iniciar os comandos do Telegram.", error);
        if (attempt >= 6) return;
        const delayMs = 15_000;
        console.warn(`Nova tentativa de conexao com o Telegram em ${delayMs / 1_000}s.`);
        setTimeout(() => this.startPolling(attempt + 1), delayMs);
      });
  }

  private async requireAdmin(context: { from?: { id: number }; reply: (text: string) => Promise<unknown> }): Promise<boolean> {
    if (String(context.from?.id) === this.adminUserId) return true;
    await context.reply("⛔ Comando administrativo não autorizado.");
    return false;
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

function parseAlertInput(value: string): { query: string; maxPrice?: number } | undefined {
  if (!value) return undefined;
  const match = value.match(/^(.+?)(?:\s*(?:\||abaixo\s+de|at[eé])\s*(?:r\$\s*)?([\d.,]+))$/i);
  const query = (match?.[1] ?? value).trim();
  if (query.length < 2) return undefined;
  const maxPrice = match?.[2] ? parsePrice(match[2]) : undefined;
  if (match?.[2] && !maxPrice) return undefined;
  return { query, maxPrice };
}

function parsePrice(value: string): number | undefined {
  const normalized = /^\d{1,3}(?:\.\d{3})+$/.test(value)
    ? value.replace(/\./g, "")
    : value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ensurePrivateChat(type: string): boolean {
  return type === "private";
}
