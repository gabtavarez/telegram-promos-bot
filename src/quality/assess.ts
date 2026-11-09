import type { BotConfig } from "../config/botConfig.js";
import type { Deal } from "../types/Deal.js";
import { getHardwareQualityScore } from "../utils/hardwareFilter.js";
import { brandMatches, detectBrand } from "./brands.js";
import { detectCategory, normalizeText } from "./categories.js";
import type { CategoryId } from "../config/botConfig.js";

export type RejectReason =
  | "qualidade-baixa"
  | "categoria-desativada"
  | "marca-bloqueada"
  | "marca-desconhecida"
  | "titulo-ambiguo"
  | "fonte-de-baixa-qualidade"
  | "fone-generico"
  | "avaliacao-baixa"
  | "poucas-vendas";

export const REJECT_LABELS: Record<RejectReason | "limite-categoria" | "limite-marca" | "limite-loja" | "palavra-bloqueada" | "filtro-painel", string> = {
  "qualidade-baixa": "Qualidade baixa",
  "categoria-desativada": "Categoria desativada",
  "marca-bloqueada": "Marca bloqueada",
  "marca-desconhecida": "Marca desconhecida",
  "titulo-ambiguo": "Título com variações misturadas",
  "fonte-de-baixa-qualidade": "Fonte de marca com histórico ruim",
  "fone-generico": "Fone de celular sem marca",
  "avaliacao-baixa": "Avaliação baixa",
  "poucas-vendas": "Poucas vendas",
  "limite-categoria": "Limite diário da categoria",
  "limite-marca": "Limite diário da marca",
  "limite-loja": "Loja com muita participação",
  "palavra-bloqueada": "Palavra bloqueada",
  "filtro-painel": "Preço/desconto/cupom do painel",
};

export interface Assessment {
  category: CategoryId | "outros";
  brand?: string;
  knownBrand: boolean;
  /** Pontuacao base de qualidade (titulo + marca + reputacao). */
  score: number;
  reasons: RejectReason[];
}

const MIN_SCORE: Record<BotConfig["quality"]["mode"], number> = {
  rigoroso: 9,
  equilibrado: 6,
  amplo: 4,
};

/**
 * Titulos que misturam varias versoes (ex.: "128GB 256GB 512GB 1TB" ou "120/240/360") anunciam o
 * menor preco de uma variacao que nem sempre e a mostrada: nao servem como oferta confiavel.
 */
export function hasAmbiguousVariants(title: string): boolean {
  const t = normalizeText(title);
  // "8G 16G 32GB": em memoria/armazenamento, "G"/"T" sem o "B" tambem e capacidade.
  const storage = /\b(?:ddr\d?|ram|memoria|ssd|nvme|hd|pendrive|cartao)\b/.test(t);
  const sizePattern = storage ? /\b(\d{1,4})\s?(gb?|tb?|mm)\b/g : /\b(\d{1,4})\s?(gb|tb|mm)\b/g;
  const sizes = new Set([...t.matchAll(sizePattern)].map((m) => `${m[1]}${m[2]![0]}`));
  if (sizes.size >= 3) return true;
  // "3600 3200mhz", "3200/3600mhz": varias frequencias de memoria no mesmo anuncio.
  if (/\b\d{4}\s*(?:mhz)?\s*[\s/,]\s*\d{4}\s*mhz\b/.test(t)) return true;
  if (/\bddr4\b/.test(t) && /\bddr5\b/.test(t)) return true;
  if (/\b\d{2,4}\s*\/\s*\d{2,4}\s*\/\s*\d{2,4}\b/.test(t)) return true;
  if (/\b\d{2,4}\s*(?:gb|tb|mm)?\s*\/\s*\d{2,4}\s*(?:gb|tb|mm)\b/.test(t) && /\b(?:ssd|nvme|ram|ddr|cooler|aio)\b/.test(t)) return true;
  const speeds = new Set([...t.matchAll(/\b(\d{4})\s?mhz\b/g)].map((m) => m[1]));
  if (speeds.size >= 3) return true;
  return /\b(?:multiplas?\s+versoes|varios\s+modelos|multi-?models?)\b/.test(t);
}

export function assessDeal(deal: Deal, quality: BotConfig["quality"]): Assessment {
  const reasons: RejectReason[] = [];
  const category = detectCategory(deal.title);
  const { brand, known } = detectBrand(deal.title);
  const base = getHardwareQualityScore(deal.title);

  if (base < MIN_SCORE[quality.mode]) reasons.push("qualidade-baixa");
  if (category !== "outros" && quality.disabledCategories.includes(category)) reasons.push("categoria-desativada");
  if (brandMatches(deal.title, quality.blockedBrands)) reasons.push("marca-bloqueada");
  if (
    quality.requireKnownBrand && !known && category !== "outros" &&
    quality.strictCategories.includes(category) && !brandMatches(deal.title, quality.preferredBrands)
  ) {
    reasons.push("marca-desconhecida");
  }
  if (quality.blockAmbiguousTitles && hasAmbiguousVariants(deal.title)) reasons.push("titulo-ambiguo");
  if (category === "fonte" && isBudgetPowerSupply(deal.title)) reasons.push("fonte-de-baixa-qualidade");
  if (!known && isGenericPhoneEarphone(deal.title)) reasons.push("fone-generico");
  if (deal.rating !== undefined && quality.minRating > 0 && deal.rating < quality.minRating) reasons.push("avaliacao-baixa");
  if (deal.sales !== undefined && quality.minSales > 0 && deal.sales < quality.minSales) reasons.push("poucas-vendas");

  let score = base;
  if (known) score += 4;
  else score -= 4;
  if (brandMatches(deal.title, quality.preferredBrands)) score += 8;
  if (deal.rating !== undefined) score += Math.max(-4, Math.min(4, (deal.rating - 4.6) * 10));
  if (deal.sales !== undefined) score += Math.min(4, Math.log10(Math.max(1, deal.sales)));
  if (deal.title.length > 180) score -= 3;

  return { category, brand, knownBrand: known, score, reasons };
}

/** Marcas de fonte com historico ruim de protecao/potencia real: fonte ruim queima o PC inteiro. */
const BUDGET_PSU = /\b(?:fortrek|k-?mex|knup|hayom|c3\s?tech|brazil\s?pc|bluecase|mymax|goldentec|duex|oex|multilaser|elg|kmex|tgt|hoopson|vinik|pcyes\s+(?:spark|electro)|aerocool\s+(?:kcas|lux))\b/;

export function isBudgetPowerSupply(title: string): boolean {
  return BUDGET_PSU.test(normalizeText(title));
}

/** Fone de celular (USB-C/P2/intra) sem marca: nao e produto de setup e costuma ter qualidade ruim. */
export function isGenericPhoneEarphone(title: string): boolean {
  const t = normalizeText(title);
  const earphone = /\b(?:fone|fones|earphone|earbuds?|intra-?auricular|in-?ear)\b/.test(t);
  const phoneOriented = /\b(?:tipo-?c|usb-?c|p2|iphone|android|celular|samsung|xiaomi|motorola)\b/.test(t);
  const gaming = /\b(?:headset gamer|7\.1|surround|2\.4g|over-?ear)\b/.test(t);
  return earphone && phoneOriented && !gaming;
}
