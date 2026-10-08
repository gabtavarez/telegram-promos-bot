import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { http } from "../utils/http.js";
import { calculateDiscount, parseBrlPrice } from "../utils/price.js";
import { extractPaymentDetails } from "../utils/payment.js";
import { extractVisibleCouponCode } from "../utils/couponCode.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

interface Candidate {
  title: string;
  url: string;
  imageUrl: string;
  currentPrice: number;
  previousPrice?: number;
  pixPrice?: number;
  cardPrice?: number;
  installmentText?: string;
  couponCode?: string;
}

const CARD_SELECTOR = [
  ".promotion-item",
  ".poly-card",
  ".ui-search-result",
  ".ui-search-layout__item",
  "li[class*='search-layout']",
  "article[class*='poly-card']",
].join(", ");

export class MercadoLivreProvider implements AffiliateProvider {
  readonly name = "Mercado Livre";

  constructor(private readonly dealsUrl: string) {}

  async getDeals(): Promise<Deal[]> {
    // Mantem o mesmo perfil de requisicao simples usado antes dos experimentos
    // com OAuth/API e sem simular um navegador de datacenter.
    const { data } = await http.get<string>(this.dealsUrl);
    assertPublicPage(data);

    const candidates = extractCandidates(data);
    if (candidates.length === 0) {
      throw new Error(
        "Mercado Livre respondeu sem cards de ofertas nem dados estruturados reconheciveis na pagina publica.",
      );
    }

    const deals = candidates
      .filter((candidate) => isPcHardwareDeal(candidate.title))
      .map(toDeal)
      .filter((deal): deal is Deal => Boolean(deal));
    return [...new Map(deals.map((deal) => [deal.id, deal])).values()];
  }
}

export function extractMercadoLivreCandidates(html: string): Candidate[] {
  assertPublicPage(html);
  return extractCandidates(html);
}

function extractCandidates(html: string): Candidate[] {
  const $ = cheerio.load(html);
  const candidates = [...extractCardCandidates($), ...extractStructuredCandidates($)];
  return [...new Map(candidates.map((candidate) => [candidateKey(candidate), candidate])).values()];
}

function extractCardCandidates($: cheerio.CheerioAPI): Candidate[] {
  const candidates: Candidate[] = [];
  $(CARD_SELECTOR).each((_, element) => {
    const card = $(element);
    const link = card.find("a[href]").filter((_, anchor) => isProductUrl($(anchor).attr("href"))).first();
    const url = link.attr("href");
    const title = firstText(card, [
      ".promotion-item__title", ".poly-component__title", ".ui-search-item__title", "h2", "h3",
    ]) || link.attr("title")?.trim() || card.find("img[alt]").first().attr("alt")?.trim();
    const image = card.find("img").first();
    const imageUrl = firstAttribute(image, ["data-src", "data-lazy-src", "src"])
      ?? firstSrcsetUrl(image.attr("srcset"));
    const listedPrice = readCurrentPrice(card);
    const previousPrice = readPreviousPrice(card);
    const payment = extractPaymentDetails(card.text());
    const currentPrice = payment.pixPrice ?? listedPrice;
    if (!url || !title || !imageUrl || !currentPrice) return;

    candidates.push({
      title, url, imageUrl, currentPrice, previousPrice,
      pixPrice: payment.pixPrice,
      cardPrice: payment.cardPrice ?? (payment.pixPrice && listedPrice && listedPrice > payment.pixPrice ? listedPrice : undefined),
      installmentText: payment.installmentText,
      couponCode: extractVisibleCouponCode(card.text()),
    });
  });
  return candidates;
}

function extractStructuredCandidates($: cheerio.CheerioAPI): Candidate[] {
  const candidates: Candidate[] = [];
  $("script").each((_, script) => {
    const raw = $(script).html()?.trim();
    if (!raw || raw.length > 4_000_000) return;
    for (const value of parseScriptJson(raw)) collectJsonCandidates(value, candidates);
  });
  return candidates;
}

function parseScriptJson(raw: string): unknown[] {
  const payloads: unknown[] = [];
  const direct = tryParseJson(raw.replace(/;\s*$/, ""));
  if (direct !== undefined) payloads.push(direct);
  for (const marker of ["__PRELOADED_STATE__", "__INITIAL_STATE__", "__NEXT_DATA__"]) {
    const markerIndex = raw.indexOf(marker);
    if (markerIndex < 0) continue;
    const json = extractBalancedJson(raw, markerIndex + marker.length);
    const parsed = json ? tryParseJson(json) : undefined;
    if (parsed !== undefined) payloads.push(parsed);
  }
  return payloads;
}

function collectJsonCandidates(root: unknown, output: Candidate[]): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let visited = 0;
  while (stack.length && visited++ < 50_000) {
    const current = stack.pop()!;
    if (!current.value || typeof current.value !== "object" || current.depth > 14) continue;
    if (Array.isArray(current.value)) {
      for (const value of current.value) stack.push({ value, depth: current.depth + 1 });
      continue;
    }
    const record = current.value as Record<string, unknown>;
    const candidate = candidateFromRecord(record);
    if (candidate) output.push(candidate);
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") stack.push({ value, depth: current.depth + 1 });
    }
  }
}

function candidateFromRecord(record: Record<string, unknown>): Candidate | undefined {
  const offers = asRecord(record.offers);
  const title = firstString(record.title, record.name, record.product_name, record.productName);
  const url = firstString(record.permalink, record.url, record.link, offers?.url);
  const imageUrl = imageFromUnknown(record.image) ?? imageFromUnknown(record.thumbnail)
    ?? imageFromUnknown(record.secure_thumbnail) ?? imageFromUnknown(record.imageUrl)
    ?? imageFromUnknown(record.pictures);
  const currentPrice = priceFromUnknown(
    record.current_price, record.currentPrice, record.sale_price, record.price, offers?.price, offers?.lowPrice,
  );
  if (!title || !url || !imageUrl || !currentPrice || !isProductUrl(url)) return undefined;
  const previousPrice = priceFromUnknown(
    record.original_price, record.originalPrice, record.old_price, record.oldPrice, offers?.highPrice,
  );
  return { title, url, imageUrl, currentPrice, previousPrice };
}

function toDeal(candidate: Candidate): Deal | undefined {
  const originalUrl = canonicalProductUrl(candidate.url);
  if (!originalUrl) return undefined;
  const fragment = new URLSearchParams(originalUrl.hash.replace(/^#/, ""));
  const itemId = fragment.get("wid")?.replace("-", "")
    ?? originalUrl.pathname.match(/(MLB-?\d+)/i)?.[1]?.replace("-", "")
    ?? originalUrl.pathname;
  originalUrl.search = "";
  originalUrl.hash = "";
  return {
    id: `mercado-livre:${itemId}`,
    provider: "mercado-livre",
    title: candidate.title,
    originalUrl: originalUrl.toString(),
    imageUrl: normalizeImageUrl(candidate.imageUrl),
    currentPrice: candidate.currentPrice,
    pixPrice: candidate.pixPrice,
    cardPrice: candidate.cardPrice,
    installmentText: candidate.installmentText,
    previousPrice: candidate.previousPrice && candidate.previousPrice > candidate.currentPrice ? candidate.previousPrice : undefined,
    discountPercentage: calculateDiscount(candidate.currentPrice, candidate.previousPrice),
    couponCode: candidate.couponCode,
    couponVerified: Boolean(candidate.couponCode),
  };
}

function readCurrentPrice(card: cheerio.Cheerio<AnyNode>): number | undefined {
  const offscreen = firstText(card, [
    ".poly-price__current .andes-money-amount__screen-reader",
    ".promotion-item__price .andes-money-amount__screen-reader",
    ".andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__screen-reader",
  ]);
  return parseBrlPrice(offscreen ?? "") ?? readFractionPrice(card, [
    ".poly-price__current .andes-money-amount__fraction",
    ".promotion-item__price .andes-money-amount__fraction",
    ".andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction",
  ]);
}

function readPreviousPrice(card: cheerio.Cheerio<AnyNode>): number | undefined {
  const offscreen = firstText(card, [
    ".andes-money-amount--previous .andes-money-amount__screen-reader",
    ".poly-component__price .andes-money-amount--previous .andes-money-amount__screen-reader",
  ]);
  return parseBrlPrice(offscreen ?? "") ?? readFractionPrice(card, [
    ".andes-money-amount--previous .andes-money-amount__fraction",
  ]);
}

function readFractionPrice(card: cheerio.Cheerio<AnyNode>, selectors: string[]): number | undefined {
  for (const selector of selectors) {
    const fraction = card.find(selector).first();
    if (!fraction.length) continue;
    const cents = fraction.siblings(".andes-money-amount__cents").first().text().trim();
    const value = parseBrlPrice(`${fraction.text().trim()}${cents ? `,${cents}` : ""}`);
    if (value) return value;
  }
  return undefined;
}

function assertPublicPage(html: string): void {
  const normalized = html.toLowerCase();
  if (["suspicious-traffic-frontend", "account-verification", "registrationtype=negative_traffic", "para continuar, acesse<br/>sua conta"]
    .some((marker) => normalized.includes(marker))) {
    throw new Error("Mercado Livre bloqueou a pagina publica com verificacao de trafego suspeito.");
  }
}

function canonicalProductUrl(value: string): URL | undefined {
  try {
    const url = new URL(value, "https://www.mercadolivre.com.br");
    const nested = url.searchParams.get("url") ?? url.searchParams.get("redirect");
    if (nested) return canonicalProductUrl(decodeURIComponent(nested));
    if (!/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isProductUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const url = new URL(value, "https://www.mercadolivre.com.br");
    const nested = url.searchParams.get("url") ?? url.searchParams.get("redirect");
    if (nested) return isProductUrl(decodeURIComponent(nested));
    return /(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)
      && (/MLB-?\d+/i.test(url.pathname + url.hash) || url.pathname.includes("/p/"));
  } catch {
    return false;
  }
}

function normalizeImageUrl(value: string): string {
  if (value.startsWith("//")) return `https:${value}`;
  return value.replace(/^http:/, "https:");
}

function firstText(card: cheerio.Cheerio<AnyNode>, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = card.find(selector).first().text().trim();
    if (value) return value;
  }
  return undefined;
}

function firstAttribute(element: cheerio.Cheerio<AnyNode>, names: string[]): string | undefined {
  for (const name of names) {
    const value = element.attr(name)?.trim();
    if (value && !value.startsWith("data:image/")) return value;
  }
  return undefined;
}

function firstSrcsetUrl(srcset?: string): string | undefined {
  return srcset?.split(",")[0]?.trim().split(/\s+/)[0];
}

function imageFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageFromUnknown(item);
      if (image) return image;
    }
  }
  const record = asRecord(value);
  return record ? firstString(record.secure_url, record.url, record.contentUrl, record.thumbnail) : undefined;
}

function priceFromUnknown(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string") {
      const parsed = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : parseBrlPrice(value);
      if (parsed && Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const record = asRecord(value);
    const nested = record ? priceFromUnknown(record.amount, record.value, record.price) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function tryParseJson(value: string): unknown | undefined {
  if (!value.startsWith("{") && !value.startsWith("[")) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

function extractBalancedJson(value: string, from: number): string | undefined {
  const start = value.slice(from).search(/[\[{]/);
  if (start < 0) return undefined;
  const absoluteStart = from + start;
  const opening = value[absoluteStart];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = absoluteStart; index < value.length; index++) {
    const character = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === opening) depth++;
    else if (character === closing && --depth === 0) return value.slice(absoluteStart, index + 1);
  }
  return undefined;
}

function candidateKey(candidate: Candidate): string {
  return `${candidate.url.split(/[?#]/)[0]}|${candidate.currentPrice}`;
}
