import { createHash } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import type { Deal } from "../types/Deal.js";
import type {
  PublishedMessageType,
  PublishedOffer,
  PublishedOfferStatus,
} from "../types/BotState.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export class TelegramPublisher {
  private readonly bot: Bot;

  constructor(token: string, private readonly channelId: string) {
    this.bot = new Bot(token);
  }

  async publish(deal: Deal, affiliateUrl: string): Promise<PublishedMessageReference> {
    const feedbackKey = getFeedbackKey(deal.id);
    const caption = formatCaption(deal, affiliateUrl);
    const keyboard = buildOfferKeyboard(affiliateUrl);
    try {
      const message = await this.bot.api.sendPhoto(this.channelId, deal.imageUrl, {
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return { messageId: message.message_id, messageType: "photo", feedbackKey };
    } catch (error) {
      console.warn("Falha ao enviar a imagem; enviando a oferta sem foto.", error);
      const message = await this.bot.api.sendMessage(this.channelId, caption, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
        reply_markup: keyboard,
      });
      return { messageId: message.message_id, messageType: "text", feedbackKey };
    }
  }

  async editPublishedOffer(offer: PublishedOffer): Promise<void> {
    const caption = formatCaption(offer.deal, offer.affiliateUrl, offer.status);
    const keyboard = offer.status === "soldout"
      ? new InlineKeyboard()
      : buildOfferKeyboard(offer.affiliateUrl);
    if (offer.messageType === "photo") {
      await this.bot.api.editMessageCaption(this.channelId, offer.messageId, {
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    }
    await this.bot.api.editMessageText(this.channelId, offer.messageId, caption, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
      reply_markup: keyboard,
    });
  }

  async removeCommunityButtons(offer: PublishedOffer): Promise<void> {
    const keyboard = offer.status === "soldout" ? new InlineKeyboard() : buildOfferKeyboard(offer.affiliateUrl);
    await this.bot.api.editMessageReplyMarkup(this.channelId, offer.messageId, { reply_markup: keyboard });
  }

  async sendPrivateAlert(userId: string, deal: Deal, affiliateUrl: string): Promise<void> {
    const caption = [`🔔 <b>ALERTA ENCONTRADO</b>`, "", formatCaption(deal, affiliateUrl)].join("\n");
    const keyboard = new InlineKeyboard().url("✅ VER OFERTA", affiliateUrl);
    try {
      await this.bot.api.sendPhoto(userId, deal.imageUrl, { caption, parse_mode: "HTML", reply_markup: keyboard });
    } catch {
      await this.bot.api.sendMessage(userId, caption, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
        reply_markup: keyboard,
      });
    }
  }

  async publishDailySummary(offers: PublishedOffer[]): Promise<void> {
    const lines = offers.map((offer, index) => {
      const score = offer.deal.tavarezScore ? ` · Score ${offer.deal.tavarezScore}` : "";
      return `${index + 1}. <a href="${escapeHtml(offer.affiliateUrl)}">${escapeHtml(offer.deal.title)}</a>\n` +
        `💰 ${currency.format(offer.deal.currentPrice)}${score}`;
    });
    await this.bot.api.sendMessage(this.channelId, [
      "🏆 <b>AS MELHORES OFERTAS DO DIA</b>",
      "",
      ...lines.flatMap((line) => [line, ""]),
      "📌 Seleção automática pelas notas de qualidade, preço e desconto.",
    ].join("\n"), { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  }
}

export function formatCaption(
  deal: Deal,
  affiliateUrl: string,
  status: PublishedOfferStatus = "active",
): string {
  const discount = deal.discountPercentage ? ` (-${deal.discountPercentage}%)` : "";
  const category = getCategoryHashtag(deal.title);
  const coupon = deal.couponCode ? ["", `🎟️ Cupom: <code>${escapeHtml(deal.couponCode)}</code>`] : [];
  const visibleUrl = affiliateUrl;
  const score = deal.tavarezScore
    ? ["", `🏅 Tavarez Score: <b>${deal.tavarezScore}/100 — ${escapeHtml(deal.scoreLabel ?? "")}</b>`]
    : [];
  const statusLine = status === "soldout"
    ? ["❌ <b>OFERTA ESGOTADA</b>", ""]
    : status === "price-changed"
      ? ["⚠️ <b>PREÇO ATUALIZADO</b>", ""]
      : [];

  return [
    ...statusLine,
    `🔥 <b>${currency.format(deal.currentPrice)}${discount}</b>`,
    "",
    `<b>${escapeHtml(deal.title)}</b>`,
    ...score,
    ...coupon,
    "",
    ...(status === "soldout" ? [] : ["✅ Link da Oferta:", escapeHtml(visibleUrl)]),
    "",
    `📢 #Anuncio ${category}`,
    status === "soldout"
      ? "ℹ️ Esta publicação foi atualizada automaticamente pelo bot."
      : undefined,
  ].filter((line): line is string => line !== undefined).join("\n");
}

export function buildOfferKeyboard(affiliateUrl: string): InlineKeyboard {
  return new InlineKeyboard().url("✅ VER OFERTA", affiliateUrl);
}

export function getFeedbackKey(dealId: string): string {
  return createHash("sha256").update(dealId).digest("hex").slice(0, 16);
}

export function getDiscountHighlight(discountPercentage?: number): string {
  if ((discountPercentage ?? 0) >= 50) return "💥 DESCONTO IMPERDÍVEL — ";
  if ((discountPercentage ?? 0) > 30) return "🚀 SUPER OFERTA — ";
  if ((discountPercentage ?? 0) >= 15) return "🔥 OFERTA BOA — ";
  return "";
}

export function getCategoryHashtag(title: string): string {
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const categories: Array<[RegExp, string]> = [
    [/\b(?:smartphone|celular|iphone|galaxy\s+[samz]\d)/, "#Celular"],
    [/\b(notebook|laptop|ultrabook|macbook)\b/, "#Notebook"],
    [/\b(tablet|ipad|tab\s?\d{1,2}|tab\s?[a-z]\d{1,2})\b/, "#Tablet"],
    [/\b(smart\s*(?:tv|v)|tv|televisao|televisor|qled|oled)\b/, "#TV"],
    [/\b(rtx|gtx|radeon|geforce|gpu|placa de video)\b/, "#GPU"],
    [/\b(processador|cpu|ryzen|intel core|xeon|athlon)\b/, "#CPU"],
    [/\b(placa[- ]?mae|motherboard|b[45678]\d0|x[3567]\d0|a[356]\d0)\b/, "#PlacaMae"],
    [/\b(memoria ram|ram|ddr[345]|sodimm|dimm)\b/, "#RAM"],
    [/\b(ssd|nvme|m\.2|hd externo|hard drive)\b/, "#Armazenamento"],
    [/\b(fonte|psu|80 plus|sfx|flex-atx)\b/, "#Fonte"],
    [/\b(gabinete|pc case|mid[- ]?tower|mini[- ]?itx|sff)\b/, "#Gabinete"],
    [/\b(mouse|mousepad)\b/, "#Mouse"],
    [/\b(teclado|keyboard|tkl)\b/, "#Teclado"],
    [/\b(headset|fone gamer|microfone)\b/, "#Audio"],
    [/\b(monitor|ultrawide|screenbar)\b/, "#Monitor"],
    [/\b(cadeira\s+(?:ergonomica|gamer|de escritorio))\b/, "#Cadeira"],
  ];

  return categories.find(([pattern]) => pattern.test(normalized))?.[1] ?? "#Setup";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export interface PublishedMessageReference {
  messageId: number;
  messageType: PublishedMessageType;
  feedbackKey: string;
}
