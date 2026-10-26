import type { Deal } from "../types/Deal.js";
import type { PublishedOffer } from "../types/BotState.js";

const STOPWORDS = new Set([
  "de", "da", "do", "com", "para", "e", "o", "a", "em", "um", "uma", "kit", "novo", "nova",
  "gamer", "preto", "preta", "branco", "branca", "original", "oficial", "pro",
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d)\s+(hz|gb|tb|mb|w|ms|mhz|ghz)\b/g, "$1$2");
}

export function productTokens(title: string): string[] {
  return [...new Set(
    normalize(title)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
  )];
}

// Tokens de modelo (ex.: "g5", "5060", "165hz", "7800x3d") identificam o produto melhor que palavras comuns.
const isModelToken = (token: string) => /\d/.test(token);

export function isSameProduct(titleA: string, titleB: string): boolean {
  const a = productTokens(titleA);
  const b = productTokens(titleB);
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token));
  const jaccard = shared.length / (a.length + b.length - shared.length);
  const sharedModels = shared.filter(isModelToken).length;
  return jaccard >= 0.7 || (sharedModels >= 2 && jaccard >= 0.5);
}

/**
 * Impede o mesmo produto (mesmo com outro anuncio/vendedor) de aparecer de novo
 * dentro da janela, a menos que o preco tenha caido de forma relevante.
 */
export function isRecentRepeat(
  deal: Deal,
  recentOffers: PublishedOffer[],
  now = Date.now(),
  windowMs = 48 * 60 * 60 * 1_000,
  minPriceDrop = 0.08,
): boolean {
  return recentOffers.some((offer) => {
    if (now - Date.parse(offer.publishedAt) >= windowMs) return false;
    if (!isSameProduct(deal.title, offer.deal.title)) return false;
    return deal.currentPrice > offer.deal.currentPrice * (1 - minPriceDrop);
  });
}
