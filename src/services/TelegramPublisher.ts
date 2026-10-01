import { createHash } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import type { Deal } from "../types/Deal.js";
import type {
  FeedbackCounts,
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
    const keyboard = buildOfferKeyboard(affiliateUrl, feedbackKey);
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
      : buildOfferKeyboard(offer.affiliateUrl, offer.feedbackKey);
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
  const previous = deal.previousPrice ? `<del>${currency.format(deal.previousPrice)}</del> ` : "";
  const discount = deal.discountPercentage ? ` (-${deal.discountPercentage}%)` : "";
  const discountHighlight = getDiscountHighlight(deal.discountPercentage);
  const category = getCategoryHashtag(deal.title);
  const coupon = deal.couponCode ? ["", `🎟️ CUPOM: <code>${escapeHtml(deal.couponCode)}</code>`] : [];
  const visibleUrl = deal.displayUrl ?? affiliateUrl;
  const score = deal.tavarezScore
    ? [`🏅 <b>TAVAREZ SCORE: ${deal.tavarezScore}/100 — ${escapeHtml(deal.scoreLabel ?? "")}</b>`]
    : [];
  const history = formatPriceHistory(deal);
  const statusLine = status === "soldout"
    ? ["❌ <b>OFERTA ESGOTADA</b>", ""]
    : status === "price-changed"
      ? ["⚠️ <b>PREÇO ATUALIZADO</b>", ""]
      : [];

  return [
    ...statusLine,
    `🔥 <b>${escapeHtml(deal.title)}</b>`,
    "",
    `${discountHighlight}💰 ${previous}<b>${currency.format(deal.currentPrice)}</b>${discount}`,
    ...score,
    ...history,
    ...coupon,
    "",
    ...(status === "soldout" ? [] : ["✅ VER OFERTA", escapeHtml(visibleUrl)]),
    "",
    `📢 #Anuncio ${category}`,
    status === "soldout"
      ? "ℹ️ Esta publicação foi atualizada automaticamente pelo bot."
      : "⚠️ Preços e disponibilidade podem mudar a qualquer momento.",
  ].join("\n");
}

export function buildOfferKeyboard(
  affiliateUrl: string,
  feedbackKey: string,
  counts: FeedbackCounts = { worth: 0, soldout: 0, bad: 0 },
): InlineKeyboard {
  return new InlineKeyboard()
    .url("✅ VER OFERTA", affiliateUrl)
    .row()
    .text(`👍 Vale a pena${formatCount(counts.worth)}`, `fb:worth:${feedbackKey}`)
    .text(`⚠️ Esgotou${formatCount(counts.soldout)}`, `fb:soldout:${feedbackKey}`)
    .text(`👎 Preço ruim${formatCount(counts.bad)}`, `fb:bad:${feedbackKey}`);
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
  ];

  return categories.find(([pattern]) => pattern.test(normalized))?.[1] ?? "#Setup";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function formatPriceHistory(deal: Deal): string[] {
  const history = deal.priceHistory;
  if (!history || history.observationDays < 2) return ["📊 Histórico de preço em formação."];
  const lines: string[] = [];
  if (history.percentBelow30DayAverage > 0) {
    lines.push(`📉 ${history.percentBelow30DayAverage}% abaixo da média monitorada de 30 dias`);
  }
  if (history.isLowestPrice90Days) {
    lines.push(`🏆 Menor preço em ${history.observationDays} dia(s) monitorado(s)`);
  }
  return lines;
}

function formatCount(value: number): string {
  return value > 0 ? ` (${value})` : "";
}

export interface PublishedMessageReference {
  messageId: number;
  messageType: PublishedMessageType;
  feedbackKey: string;
}
