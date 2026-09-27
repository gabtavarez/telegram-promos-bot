import { Bot } from "grammy";
import type { Deal } from "../types/Deal.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export class TelegramPublisher {
  private readonly bot: Bot;

  constructor(token: string, private readonly channelId: string) {
    this.bot = new Bot(token);
  }

  async publish(deal: Deal, affiliateUrl: string): Promise<void> {
    const caption = formatCaption(deal, affiliateUrl);
    try {
      await this.bot.api.sendPhoto(this.channelId, deal.imageUrl, {
        caption,
        parse_mode: "HTML",
      });
    } catch (error) {
      console.warn("Falha ao enviar a imagem; enviando a oferta sem foto.", error);
      await this.bot.api.sendMessage(this.channelId, caption, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
    }
  }
}

export function formatCaption(deal: Deal, affiliateUrl: string): string {
  const previous = deal.previousPrice
    ? `\n<del>${currency.format(deal.previousPrice)}</del>`
    : "";
  const discount = deal.discountPercentage ? ` (-${deal.discountPercentage}%)` : "";

  return [
    `🔥 <b>${escapeHtml(deal.title)}</b>`,
    `${previous}\n💰 <b>${currency.format(deal.currentPrice)}</b>${discount}`.trim(),
    "",
    `🛒 <a href="${escapeHtml(affiliateUrl)}">Ver oferta</a>`,
    "",
    "⚠️ Preços e disponibilidade podem mudar a qualquer momento.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
