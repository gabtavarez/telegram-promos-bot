import type { Deal } from "../types/Deal.js";
import type { PublishedOffer } from "../types/BotState.js";
import { detectBrand } from "../quality/brands.js";

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

// Especificacoes e sockets sao compartilhados por produtos diferentes (ex.: "360mm", "am5", "ddr5"):
// nao identificam o modelo.
const SPEC_TOKEN = /^(?:\d+(?:mm|hz|gb|tb|mb|w|ms|mhz|ghz|dpi|rpm|v|k|cm|kg|mah|gbps|pol)|ddr\d|am[345]|lga\d+|\d{4}|115x|2011|pcie\d?|usb\d?|\d)$/;

// Tokens de modelo (ex.: "k551rgb", "7800x3d", "ak820") misturam letras e numeros e identificam o produto.
const isModelToken = (token: string) => /\d/.test(token) && /[a-z]/.test(token) && !SPEC_TOKEN.test(token);

export function isSameProduct(titleA: string, titleB: string): boolean {
  const a = productTokens(titleA);
  const b = productTokens(titleB);
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token));
  const jaccard = shared.length / (a.length + b.length - shared.length);
  const sharedModels = shared.filter(isModelToken).length;
  // Marcas conhecidas diferentes nunca sao o mesmo produto, por mais parecidos que sejam os titulos.
  const brandA = detectBrand(titleA);
  const brandB = detectBrand(titleB);
  if (brandA.known && brandB.known && brandA.brand !== brandB.brand) return false;
  // Mesmo codigo de modelo e mesma marca ("AJAZZ AK820" com titulos bem diferentes) = mesmo produto.
  const strongModel = shared.some((token) => isModelToken(token) && token.length >= 4);
  const sameBrand = brandA.known && brandB.known && brandA.brand === brandB.brand;
  if (strongModel && (sameBrand || jaccard >= 0.3)) return true;
  return jaccard >= 0.75 || (sharedModels >= 1 && jaccard >= 0.5);
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
  memoryMs = 7 * 24 * 60 * 60 * 1_000,
): boolean {
  return recentOffers.some((offer) => {
    const age = now - Date.parse(offer.publishedAt);
    if (age >= memoryMs) return false;
    if (!isSameProduct(deal.title, offer.deal.title)) return false;
    // Dentro da janela: so volta com queda relevante de preco.
    if (age < windowMs) return deal.currentPrice > offer.deal.currentPrice * (1 - minPriceDrop);
    // Depois da janela (ate 7 dias): so volta se estiver pelo menos tao barato quanto da ultima vez.
    return deal.currentPrice > offer.deal.currentPrice * 1.01;
  });
}
