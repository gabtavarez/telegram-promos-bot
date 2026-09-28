import { Bot } from "grammy";
import type { Deal } from "../types/Deal.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type ShortLinkOptions = {
  enabled: boolean;
  apiUrl: string;
};

export class TelegramPublisher {
  private readonly bot: Bot;

  constructor(
    token: string,
    private readonly channelId: string,
    private readonly shortLinks: ShortLinkOptions,
  ) {
    this.bot = new Bot(token);
  }

  async publish(deal: Deal, affiliateUrl: string): Promise<void> {
    const publicUrl = await this.getPublicUrl(affiliateUrl);
    const caption = formatCaption(deal, publicUrl);
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

  private async getPublicUrl(url: string): Promise<string> {
    if (!this.shortLinks.enabled) return url;

    try {
      return await shortenUrl(url, this.shortLinks.apiUrl);
    } catch (error) {
      console.warn("Falha ao encurtar link; usando URL original.", error);
      return url;
    }
  }
}

export function formatCaption(deal: Deal, affiliateUrl: string): string {
  const previous = deal.previousPrice ? `<del>${currency.format(deal.previousPrice)}</del> ` : "";
  const discount = deal.discountPercentage ? ` (-${deal.discountPercentage}%)` : "";
  const coupon = deal.couponCode ? ["", `🎟️ CUPOM: <code>${escapeHtml(deal.couponCode)}</code>`] : [];

  return [
    `🔥 <b>${escapeHtml(deal.title)}</b>`,
    "",
    `💰 ${previous}<b>${currency.format(deal.currentPrice)}</b>${discount}`,
    ...coupon,
    "",
    "✅ VER OFERTA",
    escapeHtml(affiliateUrl),
    "",
    "📢 #Anuncio",
    "⚠️ Preços e disponibilidade podem mudar a qualquer momento.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function shortenUrl(url: string, apiUrl: string): Promise<string> {
  const requestUrl = new URL(apiUrl);
  requestUrl.searchParams.set("url", url);

  const response = await fetch(requestUrl, {
    signal: AbortSignal.timeout(8_000),
    headers: { "user-agent": "TelegramHardwareDealsBot/1.0" },
  });

  if (!response.ok) throw new Error(`Encurtador retornou HTTP ${response.status}`);

  const shortUrl = (await response.text()).trim();
  if (!isHttpUrl(shortUrl)) throw new Error("Encurtador retornou uma URL invalida");

  return shortUrl;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
