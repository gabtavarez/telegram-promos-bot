import { createHash } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import type { Deal, ProviderName } from "../types/Deal.js";
import type {
  PublishedMessageType,
  PublishedOffer,
  PublishedOfferStatus,
} from "../types/BotState.js";
import { getVerifiedDiscount } from "../utils/price.js";
import type { Coupon } from "../coupons/CouponProvider.js";
import { DEFAULT_BOT_CONFIG, type AdOptions } from "../config/botConfig.js";

// Legendas de foto aceitam ate 1024 caracteres; titulos enormes fariam o envio cair para texto.
const MAX_TITLE_LENGTH = 200;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export class TelegramPublisher {
  private readonly bot: Bot;

  constructor(token: string, private readonly channelId: string) {
    this.bot = new Bot(token);
  }

  private botUsername?: string;
  private ad: AdOptions = DEFAULT_BOT_CONFIG.ad;

  setAdOptions(options: AdOptions): void {
    this.ad = options;
  }

  private async getBotUsername(): Promise<string | undefined> {
    if (this.botUsername) return this.botUsername;
    try {
      this.botUsername = (await this.bot.api.getMe()).username;
    } catch {
      // Sem username a publicacao segue normalmente, apenas sem o convite para os alertas.
    }
    return this.botUsername;
  }

  private async buildCaption(deal: Deal, affiliateUrl: string, status: PublishedOfferStatus = "active"): Promise<string> {
    const caption = formatCaption(deal, affiliateUrl, status, this.ad);
    if (status === "soldout") return caption;
    const username = this.ad.showAlertFooter ? await this.getBotUsername() : undefined;
    const extras = [
      username ? `🔔 Alerta de preço grátis: https://t.me/${username}` : undefined,
      this.ad.customFooter ? escapeHtml(this.ad.customFooter) : undefined,
    ].filter((line): line is string => Boolean(line));
    const footer = extras.length ? `\n${extras.join("\n")}` : "";
    return caption.length + footer.length <= 1000 ? caption + footer : caption;
  }

  private async buildKeyboard(affiliateUrl: string, status: PublishedOfferStatus = "active"): Promise<InlineKeyboard> {
    const keyboard = new InlineKeyboard();
    if (status === "soldout" || !this.ad.showButtons) return keyboard;
    keyboard.url(this.ad.ctaLabel, affiliateUrl);
    const username = this.ad.showAlertFooter ? await this.getBotUsername() : undefined;
    if (username) keyboard.row().url("🔔 Criar alerta de preço", `https://t.me/${username}?start=alerta`);
    return keyboard;
  }

  async publish(deal: Deal, affiliateUrl: string): Promise<PublishedMessageReference> {
    const feedbackKey = getFeedbackKey(deal.id);
    const caption = await this.buildCaption(deal, affiliateUrl);
    const keyboard = await this.buildKeyboard(affiliateUrl);
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
    const caption = await this.buildCaption(offer.deal, offer.affiliateUrl, offer.status);
    const emptyKeyboard = await this.buildKeyboard(offer.affiliateUrl, offer.status);
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

  async publishNewCoupons(coupons: Coupon[]): Promise<void> {
    if (coupons.length === 0) return;
    const lines = coupons.slice(0, 10).flatMap((coupon) => [
      `🏪 <b>${escapeHtml(coupon.advertiserName)}</b>`,
      `🎟️ Cupom: <code>${escapeHtml(coupon.code)}</code>`,
      escapeHtml(coupon.title.slice(0, 140)),
      coupon.eligibleProductCount
        ? `📦 ${coupon.eligibleProductCount} produto(s) elegível(is)`
        : undefined,
      `⏳ Válido até ${formatCouponDate(coupon.endsAt)}`,
      `✅ Usar cupom: ${escapeHtml(coupon.destinationUrl)}`,
      "",
    ].filter((line): line is string => line !== undefined));
    await this.bot.api.sendMessage(this.channelId, [
      coupons.length === 1 ? "🎫 <b>NOVO CUPOM CONFIRMADO</b>" : "🎫 <b>NOVOS CUPONS CONFIRMADOS</b>",
      "",
      ...lines,
      coupons.length > 10 ? `… e mais ${coupons.length - 10} disponível(is) no comando /cupons.` : undefined,
      "ℹ️ Status confirmado automaticamente na fonte; disponibilidade pode mudar no checkout.",
    ].filter((line): line is string => line !== undefined).join("\n"), { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  }
}

function formatCouponDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCaption(
  deal: Deal,
  affiliateUrl: string,
  status: PublishedOfferStatus = "active",
  ad: AdOptions = DEFAULT_BOT_CONFIG.ad,
): string {
  const compact = ad.template === "compacto";
  const verifiedDiscount = getVerifiedDiscount(deal);
  const discount = verifiedDiscount ? ` (-${verifiedDiscount}%)` : "";
  const header = verifiedDiscount && ad.showHeader && !compact ? getDiscountHeader(verifiedDiscount) : undefined;
  const previousPrice = ad.showOldPrice && !compact && verifiedDiscount && deal.previousPrice
    ? `De <s>${currency.format(deal.previousPrice)}</s> por:`
    : undefined;
  const primaryPrice = deal.pixPrice
    ? `🔥 <b>${currency.format(deal.pixPrice)} no Pix${discount}</b>`
    : `🔥 <b>${currency.format(deal.currentPrice)}${discount}</b>`;
  const secondaryPayment = deal.pixPrice && !compact
    ? formatSecondaryPayment(deal)
    : undefined;
  const category = getCategoryHashtag(deal.title);
  const store = getStoreHashtag(deal.provider);
  const couponEnds = deal.couponEndsAt ? new Date(deal.couponEndsAt) : undefined;
  const coupon = deal.couponCode
    ? [
        "",
        `🎟️ Cupom: <code>${escapeHtml(deal.couponCode)}</code> (toque para copiar)`,
        ad.showCouponExpiry && !compact && couponEnds && !Number.isNaN(couponEnds.getTime()) ? `⏳ Cupom válido até ${formatCouponDate(couponEnds)}` : undefined,
      ]
    : [];
  const visibleUrl = affiliateUrl;
  const statusLine = status === "soldout"
    ? ["❌ <b>OFERTA ESGOTADA</b>", ""]
    : status === "price-changed"
      ? ["⚠️ <b>PREÇO ATUALIZADO</b>", ""]
      : [];

  return [
    ...statusLine,
    status === "active" ? header : undefined,
    previousPrice,
    primaryPrice,
    secondaryPayment,
    "",
    `<b>${escapeHtml(truncate(deal.title, MAX_TITLE_LENGTH))}</b>`,
    ...coupon,
    "",
    ...(status === "soldout" ? [] : ["✅ Link da Oferta:", escapeHtml(visibleUrl)]),
    "",
    ad.showHashtags || ad.disclosure === "anuncio"
      ? `📢 ${[ad.showHashtags ? store : undefined, ad.showHashtags ? category : undefined, ad.disclosure === "anuncio" ? "#Anúncio" : undefined].filter(Boolean).join(" ")}`
      : undefined,
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

function getDiscountHeader(discount: number): string | undefined {
  if (discount >= 50) return "💥 <b>DESCONTO IMPERDÍVEL</b>";
  if (discount > 30) return "🚀 <b>SUPER OFERTA</b>";
  if (discount >= 15) return "✅ <b>OFERTA BOA</b>";
  return undefined;
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
    [/\b(?:water\s*cooler|watercooler|aio|liquid\s+(?:cpu\s+)?cooler|(?:sistema\s+de\s+)?resfriamento\s+liquido|refrigeracao\s+liquida)\b/, "#WaterCooler"],
    [/\b(?:air\s*cooler|cpu\s+air\s+cooler|refrigerador\s+(?:de\s+)?cpu|cooler\s+torre)\b/, "#AirCooler"],
    [/\b(?:fan|fans|ventoinha|ventoinhas)\s+(?:pc\s+)?argb\b|\bargb\s+(?:pc\s+)?(?:fan|fans|ventoinha|ventoinhas)\b/, "#Fans"],
    [/\b(?:apple\s+)?iphone\s+(?:13|14|15|16|17)\b/, "#iPhone"],
    [/\bmacbook\s+(?:air|pro)\b/, "#MacBook"],
    [/\b(?:smartphone|celular|samsung\s+galaxy\s+[samz]\d)/, "#Celular"],
    [/\b(notebook|laptop|ultrabook|macbook)\b/, "#Notebook"],
    [/\b(smart\s*(?:tv|v)|tv|televisao|televisor|qled|oled)\b/, "#TV"],
    [/\b(rtx|gtx|radeon|geforce|gpu|placa de video)\b/, "#PlacaDeVideo"],
    [/\b(processador|cpu|ryzen|intel core|xeon|athlon)\b/, "#Processador"],
    [/\b(placa[- ]?mae|motherboard|b[45678]\d0|x[3567]\d0|a[356]\d0)\b/, "#PlacaMae"],
    [/\b(memoria ram|ram|ddr[345]|sodimm|dimm)\b/, "#MemoriaRam"],
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
