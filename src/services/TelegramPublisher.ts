import { Bot, InlineKeyboard } from "grammy";
import type { Deal } from "../types/Deal.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export class TelegramPublisher {
  private readonly bot: Bot;

  constructor(token: string, private readonly channelId: string) {
    this.bot = new Bot(token);
  }

  async publish(deal: Deal, affiliateUrl: string): Promise<void> {
    const caption = formatCaption(deal, affiliateUrl);
    const keyboard = new InlineKeyboard().url("✅ VER OFERTA", affiliateUrl);
    try {
      await this.bot.api.sendPhoto(this.channelId, deal.imageUrl, {
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch (error) {
      console.warn("Falha ao enviar a imagem; enviando a oferta sem foto.", error);
      await this.bot.api.sendMessage(this.channelId, caption, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
        reply_markup: keyboard,
      });
    }
  }
}

export function formatCaption(deal: Deal, affiliateUrl: string): string {
  const previous = deal.previousPrice ? `<del>${currency.format(deal.previousPrice)}</del> ` : "";
  const discount = deal.discountPercentage ? ` (-${deal.discountPercentage}%)` : "";
  const discountHighlight = getDiscountHighlight(deal.discountPercentage);
  const category = getCategoryHashtag(deal.title);
  const coupon = deal.couponCode ? ["", `🎟️ CUPOM: <code>${escapeHtml(deal.couponCode)}</code>`] : [];

  return [
    `🔥 <b>${escapeHtml(deal.title)}</b>`,
    "",
    `${discountHighlight}💰 ${previous}<b>${currency.format(deal.currentPrice)}</b>${discount}`,
    ...coupon,
    "",
    "✅ VER OFERTA",
    escapeHtml(affiliateUrl),
    "",
    `📢 #Anuncio ${category}`,
    "⚠️ Preços e disponibilidade podem mudar a qualquer momento.",
  ].join("\n");
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
