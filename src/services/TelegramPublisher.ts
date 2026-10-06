import { createHash } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import type { Deal, ProviderName } from "../types/Deal.js";
import type {
  PublishedMessageType,
  PublishedOffer,
  PublishedOfferStatus,
} from "../types/BotState.js";
import { getVerifiedDiscount } from "../utils/price.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export class TelegramPublisher {
  private readonly bot: Bot;

  constructor(token: string, private readonly channelId: string) {
    this.bot = new Bot(token);
  }

  async publish(deal: Deal, affiliateUrl: string): Promise<PublishedMessageReference> {
    const feedbackKey = getFeedbackKey(deal.id);
    const caption = formatCaption(deal, affiliateUrl);
    try {
      const message = await this.bot.api.sendPhoto(this.channelId, deal.imageUrl, {
        caption,
        parse_mode: "HTML",
      });
      return { messageId: message.message_id, messageType: "photo", feedbackKey };
    } catch (error) {
      console.warn("Falha ao enviar a imagem; enviando a oferta sem foto.", error);
      const message = await this.bot.api.sendMessage(this.channelId, caption, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
      return { messageId: message.message_id, messageType: "text", feedbackKey };
    }
  }

  async editPublishedOffer(offer: PublishedOffer): Promise<void> {
    const caption = formatCaption(offer.deal, offer.affiliateUrl, offer.status);
    const emptyKeyboard = new InlineKeyboard();
    if (offer.messageType === "photo") {
      await this.bot.api.editMessageCaption(this.channelId, offer.messageId, {
        caption,
        parse_mode: "HTML",
        reply_markup: emptyKeyboard,
      });
      return;
    }
    await this.bot.api.editMessageText(this.channelId, offer.messageId, caption, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
      reply_markup: emptyKeyboard,
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
      return `${index + 1}. <a href="${escapeHtml(offer.affiliateUrl)}">${escapeHtml(offer.deal.title)}</a>\n` +
        `💰 ${currency.format(offer.deal.currentPrice)}`;
    });
    await this.bot.api.sendMessage(this.channelId, [
      "🏆 <b>AS MELHORES OFERTAS DO DIA</b>",
      "",
      ...lines.flatMap((line) => [line, ""]),
      "📌 Seleção automática por qualidade, preço, desconto e diversidade.",
    ].join("\n"), { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  }
}

export function formatCaption(
  deal: Deal,
  affiliateUrl: string,
  status: PublishedOfferStatus = "active",
): string {
  const verifiedDiscount = getVerifiedDiscount(deal);
  const discount = verifiedDiscount ? ` (-${verifiedDiscount}%)` : "";
  const primaryPrice = deal.pixPrice
    ? `🔥 <b>${currency.format(deal.pixPrice)} no Pix${discount}</b>`
    : `🔥 <b>${currency.format(deal.currentPrice)}${discount}</b>`;
  const secondaryPayment = deal.pixPrice
    ? formatSecondaryPayment(deal)
    : undefined;
  const category = getCategoryHashtag(deal.title);
  const store = getStoreHashtag(deal.provider);
  const coupon = deal.couponCode ? ["", `🎟️ Cupom: <code>${escapeHtml(deal.couponCode)}</code>`] : [];
  const visibleUrl = affiliateUrl;
  const statusLine = status === "soldout"
    ? ["❌ <b>OFERTA ESGOTADA</b>", ""]
    : status === "price-changed"
      ? ["⚠️ <b>PREÇO ATUALIZADO</b>", ""]
      : [];

  return [
    ...statusLine,
    primaryPrice,
    secondaryPayment,
    "",
    `<b>${escapeHtml(deal.title)}</b>`,
    ...coupon,
    "",
    ...(status === "soldout" ? [] : ["✅ Link da Oferta:", escapeHtml(visibleUrl)]),
    "",
    `📢 ${store} ${category}`,
    status === "soldout"
      ? "ℹ️ Esta publicação foi atualizada automaticamente pelo bot."
      : undefined,
  ].filter((line): line is string => line !== undefined).join("\n");
}

function formatSecondaryPayment(deal: Deal): string | undefined {
  if (deal.cardPrice && deal.cardPrice > (deal.pixPrice ?? 0)) {
    return `💳 ${currency.format(deal.cardPrice)}${deal.installmentText ? ` — ${deal.installmentText}` : ""}`;
  }
  return deal.installmentText ? `💳 ${deal.installmentText}` : undefined;
}

export function getStoreHashtag(provider: ProviderName): string {
  const hashtags: Record<ProviderName, string> = {
    amazon: "#Amazon",
    "mercado-livre": "#MercadoLivre",
    aliexpress: "#AliExpress",
    kabum: "#KaBuM",
    shopee: "#Shopee",
  };
  return hashtags[provider];
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
  if (/\b(?:secondary display|tela secundaria|watercooler screen|water cooler screen)\b/.test(normalized)) {
    return "#Setup";
  }
  if (/\b(?:dissipador|heatsink|heat sink)\s+(?:ssd|m\.2|nvme)\b/.test(normalized)) {
    return "#Setup";
  }
  const categories: Array<[RegExp, string]> = [
    [/\b(?:smartphone|celular|apple\s+iphone|samsung\s+galaxy\s+[samz]\d)/, "#Celular"],
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
