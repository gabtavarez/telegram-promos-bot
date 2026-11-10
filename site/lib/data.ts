import { categoryOf, normalize } from "./categories";
import { cleanTitle, slugify } from "./format";
import { DEMO_OFFERS } from "./demo";

const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
export const isDemo = !url || !token;

export type StoreKey = "mercado-livre" | "amazon" | "kabum" | "shopee" | "aliexpress";
export const STORES: Record<StoreKey, string> = {
  "mercado-livre": "Mercado Livre",
  amazon: "Amazon",
  kabum: "KaBuM!",
  shopee: "Shopee",
  aliexpress: "AliExpress",
};

/** Formato que o bot grava em telegram-promos:published (só os campos usados aqui). */
export interface StoredOffer {
  deal: {
    id: string;
    provider: StoreKey;
    title: string;
    imageUrl: string;
    currentPrice: number;
    previousPrice?: number;
    couponCode?: string;
    couponEndsAt?: string;
    couponVerified?: boolean;
    installmentText?: string;
    pixPrice?: number;
    rating?: number;
  };
  affiliateUrl: string;
  messageId: number;
  publishedAt: string;
  status: "active" | "soldout" | "price-changed";
}

export interface Offer {
  id: string;
  slug: string;
  dealId: string;
  title: string;
  shortTitle: string;
  image: string;
  price: number;
  previousPrice?: number;
  discount?: number;
  coupon?: string;
  couponEndsAt?: string;
  installment?: string;
  store: StoreKey;
  storeLabel: string;
  category: { slug: string; label: string };
  url: string;
  publishedAt: string;
  active: boolean;
}

async function get<T>(key: string, revalidate: number | false, fallback: T): Promise<T> {
  if (!url || !token) return fallback;
  try {
    const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate, tags: [key] },
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { result?: string | null };
    return data.result ? (JSON.parse(data.result) as T) : fallback;
  } catch {
    return fallback;
  }
}

function discountOf(price: number, previous?: number): number | undefined {
  if (!previous || previous <= price) return undefined;
  const value = Math.round((1 - price / previous) * 100);
  return value >= 3 && value <= 90 ? value : undefined;
}

export function toOffer(stored: StoredOffer): Offer {
  const { deal } = stored;
  const discount = discountOf(deal.currentPrice, deal.previousPrice);
  const couponValid = deal.couponCode && (!deal.couponEndsAt || Date.parse(deal.couponEndsAt) > Date.now());
  return {
    id: String(stored.messageId),
    slug: `${stored.messageId}-${slugify(cleanTitle(deal.title, 70))}`,
    dealId: deal.id,
    title: deal.title,
    shortTitle: cleanTitle(deal.title, 90),
    image: deal.imageUrl.replace(/^http:\/\//, "https://"),
    price: deal.currentPrice,
    previousPrice: discount ? deal.previousPrice : undefined,
    discount,
    coupon: couponValid ? deal.couponCode : undefined,
    couponEndsAt: couponValid ? deal.couponEndsAt : undefined,
    installment: deal.installmentText,
    store: deal.provider,
    storeLabel: STORES[deal.provider] ?? deal.provider,
    category: categoryOf(deal.title),
    url: stored.affiliateUrl,
    publishedAt: stored.publishedAt,
    active: stored.status === "active",
  };
}

/** Ofertas publicadas pelo bot, da mais recente para a mais antiga (uma por produto). */
export async function getOffers(): Promise<Offer[]> {
  const stored = isDemo ? DEMO_OFFERS : await get<StoredOffer[]>("telegram-promos:published", 60, []);
  const seen = new Set<string>();
  return stored
    .filter((item) => item?.deal?.title && item.affiliateUrl && item.deal.imageUrl)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((item) => (seen.has(item.deal.id) ? false : (seen.add(item.deal.id), true)))
    .map(toOffer);
}

export async function getOffer(slugOrId: string): Promise<Offer | undefined> {
  const id = slugOrId.split("-")[0];
  const stored = isDemo ? DEMO_OFFERS : await get<StoredOffer[]>("telegram-promos:published", 60, []);
  const found = stored.find((item) => String(item.messageId) === id);
  return found ? toOffer(found) : undefined;
}

export type SortKey = "recentes" | "desconto" | "menor-preco" | "maior-preco";

export interface OfferQuery {
  q?: string;
  categoria?: string;
  loja?: string;
  ordem?: SortKey;
  ativas?: boolean;
  cupom?: boolean;
  max?: number;
}

export function filterOffers(offers: Offer[], query: OfferQuery): Offer[] {
  const words = query.q ? normalize(query.q).split(/\s+/).filter(Boolean) : [];
  const filtered = offers.filter((offer) => {
    if (query.ativas && !offer.active) return false;
    if (query.cupom && !offer.coupon) return false;
    if (query.categoria && offer.category.slug !== query.categoria) return false;
    if (query.loja && offer.store !== query.loja) return false;
    if (query.max && offer.price > query.max) return false;
    if (words.length) {
      const haystack = normalize(`${offer.title} ${offer.storeLabel} ${offer.category.label}`);
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
  const sorters: Record<SortKey, (a: Offer, b: Offer) => number> = {
    recentes: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    desconto: (a, b) => (b.discount ?? 0) - (a.discount ?? 0) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    "menor-preco": (a, b) => a.price - b.price,
    "maior-preco": (a, b) => b.price - a.price,
  };
  return filtered.sort(sorters[query.ordem ?? "recentes"]);
}

export interface PricePoint { date: string; price: number }

function dateKeys(days: number): string[] {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const today = new Date(`${format.format(new Date())}T12:00:00-03:00`);
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    return format.format(date);
  }).reverse();
}

/**
 * Histórico diário (menor preço visto no dia) que o bot grava em telegram-promos:prices:AAAA-MM-DD.
 * Dias passados não mudam, então ficam em cache por 1 dia; o dia atual, por 10 min.
 */
export async function getPriceHistory(dealId: string, days = 60): Promise<PricePoint[]> {
  if (isDemo) return demoHistory(dealId, days);
  const keys = dateKeys(days);
  const today = keys[keys.length - 1];
  const snapshots = await Promise.all(
    keys.map((date) => get<Record<string, number>>(`telegram-promos:prices:${date}`, date === today ? 600 : 86_400, {})),
  );
  return keys.flatMap((date, index) => {
    const price = snapshots[index]?.[dealId];
    return typeof price === "number" && price > 0 ? [{ date, price }] : [];
  });
}

function demoHistory(dealId: string, days: number): PricePoint[] {
  const offer = DEMO_OFFERS.find((item) => item.deal.id === dealId);
  if (!offer) return [];
  const base = offer.deal.previousPrice ?? offer.deal.currentPrice * 1.2;
  return dateKeys(days).slice(-35).map((date, index, all) => ({
    date,
    price: index === all.length - 1 ? offer.deal.currentPrice : Math.round(base * (0.93 + ((index * 37) % 11) / 100)),
  }));
}
