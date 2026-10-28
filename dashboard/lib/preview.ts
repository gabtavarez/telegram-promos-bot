import type { AdOptions } from "./botConfig";
import { brl, categoryOf } from "./metrics";
import { STORE_LABEL, type OfferLite } from "./types";

export interface Span { t: string; b?: boolean; s?: boolean; code?: boolean; link?: boolean }
export type Line = Span[];

export const SAMPLE_OFFER: OfferLite = {
  id: "sample",
  title: "Monitor Gamer Curvo Samsung Odyssey 34\" G5 165Hz 1ms Ultrawide",
  provider: "mercado-livre",
  price: 1329,
  previousPrice: 1899,
  discount: 30,
  couponCode: "PROMO10",
  publishedAt: new Date().toISOString(),
  status: "active",
  url: "https://meli.la/2Q2gVmD",
};

const HASHTAG_STORE: Record<string, string> = {
  "mercado-livre": "#MercadoLivre", amazon: "#Amazon", kabum: "#KaBuM", shopee: "#Shopee", aliexpress: "#AliExpress",
};

function hashtag(label: string): string {
  return `#${label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ?? "").toUpperCase())}`;
}

function header(discount: number): string | undefined {
  if (discount >= 50) return "💥 DESCONTO IMPERDÍVEL";
  if (discount > 30) return "🚀 SUPER OFERTA";
  if (discount >= 15) return "✅ OFERTA BOA";
  return undefined;
}

/** Espelha formatCaption do bot para o preview ao vivo (mantenha as duas em sincronia). */
export function previewCaption(offer: OfferLite, ad: AdOptions, botUsername: string): { lines: Line[]; buttons: string[] } {
  const compact = ad.template === "compacto";
  const discount = offer.discount;
  const lines: Line[] = [];
  const blank = () => lines.push([]);

  const head = discount && ad.showHeader && !compact ? header(discount) : undefined;
  if (head) lines.push([{ t: head, b: true }]);
  if (ad.showOldPrice && !compact && discount && offer.previousPrice) {
    lines.push([{ t: "De " }, { t: brl.format(offer.previousPrice), s: true }, { t: " por:" }]);
  }
  lines.push([{ t: `🔥 ${brl.format(offer.price)}${discount ? ` (-${discount}%)` : ""}`, b: true }]);
  blank();
  lines.push([{ t: offer.title.length > 200 ? `${offer.title.slice(0, 199)}…` : offer.title, b: true }]);
  if (offer.couponCode) {
    blank();
    lines.push([{ t: "🎟️ Cupom: " }, { t: offer.couponCode, code: true }, { t: " (toque para copiar)" }]);
    if (ad.showCouponExpiry && !compact) lines.push([{ t: "⏳ Cupom válido até 31/12 23:59" }]);
  }
  blank();
  lines.push([{ t: "✅ Link da Oferta:" }]);
  lines.push([{ t: offer.url, link: true }]);
  blank();
  const tags = [
    ad.showHashtags ? HASHTAG_STORE[offer.provider] ?? `#${STORE_LABEL[offer.provider]}` : undefined,
    ad.showHashtags ? hashtag(categoryOf(offer.title)) : undefined,
    ad.disclosure === "anuncio" ? "#Anúncio" : undefined,
  ].filter(Boolean).join(" ");
  if (tags) lines.push([{ t: `📢 ${tags}` }]);
  if (ad.showAlertFooter) lines.push([{ t: "🔔 Alerta de preço grátis: " }, { t: `https://t.me/${botUsername}`, link: true }]);
  if (ad.customFooter) lines.push([{ t: ad.customFooter }]);
  while (lines.length && lines[lines.length - 1]!.length === 0) lines.pop();

  const buttons = ad.showButtons ? [ad.ctaLabel, ...(ad.showAlertFooter ? ["🔔 Criar alerta de preço"] : [])] : [];
  return { lines, buttons };
}
