import * as cheerio from "cheerio";
import { http } from "../utils/http.js";
import type { Coupon, CouponProvider } from "./CouponProvider.js";

const PROMOTIONS_URL = "https://www.mercadolivre.com.br/l/promocoes";
const CACHE_DURATION_MS = 5 * 60 * 1_000;
const PUBLIC_COUPON_FEEDS = [
  "https://t.me/s/iuriindica",
  "https://t.me/s/sddescontos",
  "https://t.me/s/PromosdaMih",
  "https://t.me/s/cmdiasyoutube",
  "https://t.me/s/fafaofertas",
];
const PUBLIC_SIGNAL_MAX_AGE_MS = 8 * 60 * 60 * 1_000;
const PUBLIC_COUPON_LIFETIME_MS = 6 * 60 * 60 * 1_000;
const MAX_ELIGIBILITY_PAGES = 8;
const INVALID_CODES = new Set([
  "ATIVO",
  "ATIVADO",
  "CODIGO",
  "CUPOM",
  "DESCONTO",
  "DISPONIVEL",
  "OFERTA",
  "PESSOAL",
  "MERCADO",
  "LIVRE",
  "PRODUTOS",
  "SELECIONADOS",
]);

interface PublicCouponSignal {
  code: string;
  publishedAt: Date;
  minimumPurchase?: number;
  selectionUrls: string[];
  text: string;
  sources: string[];
}

export class MercadoLivreCouponProvider implements CouponProvider {
  readonly name = "Mercado Livre";
  private cache: Coupon[] = [];
  private cacheExpiresAt = 0;
  private lastError?: string;

  async getActiveCoupons(): Promise<Coupon[]> {
    if (Date.now() < this.cacheExpiresAt) return activeCoupons(this.cache);

    try {
      const now = new Date();
      const [officialResult, ...feedResults] = await Promise.allSettled([
        http.get<string>(PROMOTIONS_URL),
        ...PUBLIC_COUPON_FEEDS.map((url) => http.get<string>(url)),
      ]);
      if (officialResult.status === "rejected" && feedResults.every((result) => result.status === "rejected")) {
        throw officialResult.reason;
      }

      const official = officialResult.status === "fulfilled"
        ? extractMercadoLivreCoupons(officialResult.value.data, now)
        : [];
      const signals = feedResults.flatMap((result, index) => result.status === "fulfilled"
        ? extractPublicCouponSignals(result.value.data, now, PUBLIC_COUPON_FEEDS[index])
        : []);
      const publicCoupons = await this.resolvePublicCoupons(signals, now);
      this.cache = mergeCoupons([...official, ...publicCoupons]);
      this.cacheExpiresAt = Date.now() + CACHE_DURATION_MS;
      this.lastError = undefined;
      console.log(
        `Mercado Livre: ${this.cache.length} cupom(ns) automatico(s) com codigo; ` +
        `${publicCoupons.length} validado(s) por lista de produtos.`,
      );
      return activeCoupons(this.cache);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.cacheExpiresAt = Date.now() + 60_000;
      console.warn(`Falha ao consultar cupons do Mercado Livre: ${this.lastError}`);
      return activeCoupons(this.cache);
    }
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  private async resolvePublicCoupons(signals: PublicCouponSignal[], now: Date): Promise<Coupon[]> {
    const recent = mergeSignals(signals).slice(0, MAX_ELIGIBILITY_PAGES);
    const coupons = await Promise.all(recent.map(async (signal): Promise<Coupon | undefined> => {
      const pages = await Promise.allSettled(signal.selectionUrls.slice(0, 4).map((url) => http.get<string>(url)));
      const eligibleItemIds = [...new Set(pages.flatMap((result) => result.status === "fulfilled"
        ? extractMercadoLivreItemIds(result.value.data)
        : []))];
      const explicitlyStoreWide = /(?:todo\s+(?:o\s+)?site|site\s+inteiro|qualquer\s+produto)/i.test(signal.text);
      if (eligibleItemIds.length === 0 && !explicitlyStoreWide) return undefined;

      return {
        code: signal.code,
        advertiserId: 0,
        advertiserName: "Mercado Livre",
        destinationUrl: "https://www.mercadolivre.com.br/",
        title: summarizeTerms(signal.text, signal.code),
        terms: signal.text.slice(0, 800),
        startsAt: signal.publishedAt,
        endsAt: new Date(Math.min(
          signal.publishedAt.getTime() + PUBLIC_COUPON_LIFETIME_MS,
          endOfBrazilDay(now).getTime(),
        )),
        exclusive: true,
        minimumPurchase: signal.minimumPurchase,
        eligibleItemIds: explicitlyStoreWide ? undefined : eligibleItemIds,
        confidence: signal.sources.length,
      };
    }));
    return coupons.filter((coupon): coupon is Coupon => Boolean(coupon));
  }
}

export function extractMercadoLivreCoupons(html: string, now = new Date()): Coupon[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, template").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const matches = [...text.matchAll(/\bcupom\s*(?::|-)?\s*([A-Z0-9][A-Z0-9_-]{3,24})\b/gi)];
  const coupons: Coupon[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const rawCode = match[1];
    const code = rawCode?.toUpperCase();
    if (!code || rawCode !== code || INVALID_CODES.has(code)) continue;

    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? text.length;
    const context = text.slice(start, Math.min(nextStart, start + 1_800));
    const validity = readValidity(context, now);
    if (!validity || validity.startsAt.getTime() > now.getTime() || validity.endsAt.getTime() < now.getTime()) {
      continue;
    }
    const explicitlyStoreWide = /(?:todo\s+(?:o\s+)?site|site\s+inteiro|qualquer\s+produto)/i.test(context);
    // A pagina de termos tambem lista cupons limitados a categorias, vendedores
    // ou itens selecionados. Sem uma lista verificavel, nao os tratamos como gerais.
    if (!explicitlyStoreWide) continue;

    coupons.push({
      code,
      advertiserId: 0,
      advertiserName: "Mercado Livre",
      destinationUrl: "https://www.mercadolivre.com.br/",
      title: summarizeTerms(context, code),
      terms: context.slice(0, 800),
      startsAt: validity.startsAt,
      endsAt: validity.endsAt,
      exclusive: /(?:afiliad|exclusiv)/i.test(context),
      minimumPurchase: readMinimumPurchase(context),
      confidence: 3,
    });
  }

  return [...new Map(coupons.map((coupon) => [coupon.code, coupon])).values()];
}

export function extractPublicCouponSignals(
  html: string,
  now = new Date(),
  source = "public",
): PublicCouponSignal[] {
  const $ = cheerio.load(html);
  const messages = $(".tgme_widget_message_wrap").toArray().reverse();
  const inactiveCodes = new Set<string>();
  const signals: PublicCouponSignal[] = [];

  for (const element of messages) {
    const message = $(element);
    const text = message.find(".tgme_widget_message_text").text().replace(/\s+/g, " ").trim();
    const datetime = message.find("time[datetime]").attr("datetime");
    const publishedAt = datetime ? new Date(datetime) : undefined;
    if (!text || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (now.getTime() - publishedAt.getTime() > PUBLIC_SIGNAL_MAX_AGE_MS || publishedAt > now) continue;

    const links = message.find(".tgme_widget_message_text a[href]").toArray()
      .map((anchor) => $(anchor).attr("href"))
      .filter((url): url is string => Boolean(url))
      .filter(isMercadoLivreSelectionUrl);
    const mentionsMercadoLivre = /mercado\s*livre|\bmeli\b/i.test(text) || links.length > 0;
    if (!mentionsMercadoLivre) continue;

    const codes = extractCodesFromPublicMessage(text);
    if (/(?:esgotad|encerrad|acabou|j[aá]\s+era|n[aã]o\s+funciona)/i.test(text)) {
      codes.forEach((code) => inactiveCodes.add(code));
      continue;
    }

    for (const code of codes) {
      if (inactiveCodes.has(code)) continue;
      signals.push({
        code,
        publishedAt,
        minimumPurchase: readMinimumPurchase(text),
        selectionUrls: links,
        text,
        sources: [source],
      });
    }
  }
  return signals;
}

export function extractMercadoLivreItemIds(html: string): string[] {
  const primary = html.match(/"polycards"\s*:\s*\[\s*\{[\s\S]{0,2500}?"metadata"\s*:\s*\{[\s\S]{0,500}?"id"\s*:\s*"MLB-?(\d{7,12})"/i)?.[1];
  if (primary) return [`MLB${primary}`];
  return [...new Set([...html.matchAll(/\bMLB-?(\d{7,12})\b/gi)].map((match) => `MLB${match[1]}`))];
}

function readValidity(context: string, now: Date): { startsAt: Date; endsAt: Date } | undefined {
  const dates = [...context.matchAll(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/g)]
    .map((match) => parseBrazilDate(match[1], match[2], match[3]))
    .filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return undefined;

  const startsAt = startOfBrazilDay(dates[0]!);
  const endsAt = endOfBrazilDay(dates[1] ?? dates[0]!);
  // Alguns textos dizem apenas "até DD/MM/AA". Nesse caso a primeira data é o fim,
  // e o cupom já pode estar em vigor quando a página oficial o exibe.
  if (/\b(?:at[eé]|termina|expira)\b/i.test(context.slice(0, 100)) && dates.length === 1) {
    return { startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000), endsAt };
  }
  return { startsAt, endsAt };
}

function parseBrazilDate(day?: string, month?: string, year?: string): Date | undefined {
  if (!day || !month || !year) return undefined;
  const fullYear = year.length === 2 ? 2_000 + Number(year) : Number(year);
  const iso = `${fullYear}-${month}-${day}T12:00:00-03:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfBrazilDay(date: Date): Date {
  const parts = brazilDateParts(date);
  return new Date(`${parts}T00:00:00-03:00`);
}

function endOfBrazilDay(date: Date): Date {
  const parts = brazilDateParts(date);
  return new Date(`${parts}T23:59:59-03:00`);
}

function brazilDateParts(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function readMinimumPurchase(context: string): number | undefined {
  const match = context.match(/(?:compra(?:s)?\s+(?:a partir de|acima de)|acima\s+de|m[ií]nimo(?:\s+de)?)\s*R\$\s*([\d.,]+)/i);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function summarizeTerms(context: string, code: string): string {
  const discount = context.match(/desconto\s+de\s+(?:at[eé]\s+)?([^.;]{1,45})/i)?.[1]?.trim();
  return discount ? `Cupom ${code}: ${discount}` : `Cupom ${code} do Mercado Livre`;
}

function extractCodesFromPublicMessage(text: string): string[] {
  const candidates = [
    ...text.matchAll(/(?:cupom|c[oó]digo)(?:\s+(?:mercado\s*livre|meli))?\s*(?::|-)?\s*[`'"]?([A-Z][A-Z0-9_-]{3,24})/gi),
    ...text.matchAll(/`([A-Z][A-Z0-9_-]{3,24})`/g),
  ];
  return [...new Set(candidates
    .map((match) => match[1])
    .filter((code): code is string => typeof code === "string" && code === code.toUpperCase() && !INVALID_CODES.has(code)))];
}

function isMercadoLivreSelectionUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "mercadolivre.com" || hostname.endsWith(".mercadolivre.com") ||
      hostname === "mercadolivre.com.br" || hostname.endsWith(".mercadolivre.com.br") || hostname === "meli.la";
  } catch {
    return false;
  }
}

function mergeSignals(signals: PublicCouponSignal[]): PublicCouponSignal[] {
  const merged = new Map<string, PublicCouponSignal>();
  for (const signal of signals.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
    const current = merged.get(signal.code);
    if (!current) {
      merged.set(signal.code, {
        ...signal,
        selectionUrls: [...signal.selectionUrls],
        sources: [...signal.sources],
      });
      continue;
    }
    current.selectionUrls = [...new Set([...current.selectionUrls, ...signal.selectionUrls])];
    current.sources = [...new Set([...current.sources, ...signal.sources])];
    current.minimumPurchase ??= signal.minimumPurchase;
  }
  return [...merged.values()];
}

function mergeCoupons(coupons: Coupon[]): Coupon[] {
  const merged = new Map<string, Coupon>();
  for (const coupon of coupons) {
    const current = merged.get(coupon.code);
    if (!current) {
      merged.set(coupon.code, coupon);
      continue;
    }
    const eligibleItemIds = current.eligibleItemIds && coupon.eligibleItemIds
      ? [...new Set([...current.eligibleItemIds, ...coupon.eligibleItemIds])]
      : undefined;
    merged.set(coupon.code, {
      ...(coupon.endsAt > current.endsAt ? coupon : current),
      eligibleItemIds: eligibleItemIds?.length ? eligibleItemIds : undefined,
      minimumPurchase: Math.max(current.minimumPurchase ?? 0, coupon.minimumPurchase ?? 0) || undefined,
    });
  }
  return [...merged.values()];
}

function activeCoupons(coupons: Coupon[], now = Date.now()): Coupon[] {
  return coupons.filter((coupon) => coupon.startsAt.getTime() <= now && coupon.endsAt.getTime() > now);
}
