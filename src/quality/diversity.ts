import type { BotConfig } from "../config/botConfig.js";
import type { PublishedOffer } from "../types/BotState.js";
import type { Deal } from "../types/Deal.js";
import { detectBrand } from "./brands.js";
import { detectCategory } from "./categories.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface DiversityContext {
  total: number;
  byCategory: Map<string, number>;
  byBrand: Map<string, number>;
  byStore: Map<string, number>;
  /** Mais recentes primeiro. */
  lastCategories: string[];
  lastStores: string[];
  lastBrands: string[];
}

export type DiversityBlock = "limite-categoria" | "limite-marca" | "limite-loja";

export function buildDiversityContext(offers: PublishedOffer[], now = Date.now()): DiversityContext {
  const recent = offers
    .filter((offer) => now - Date.parse(offer.publishedAt) < DAY_MS)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const ctx: DiversityContext = {
    total: recent.length,
    byCategory: new Map(),
    byBrand: new Map(),
    byStore: new Map(),
    lastCategories: [],
    lastStores: [],
    lastBrands: [],
  };
  for (const offer of recent) {
    const category = detectCategory(offer.deal.title);
    const brand = detectBrand(offer.deal.title).brand;
    ctx.byCategory.set(category, (ctx.byCategory.get(category) ?? 0) + 1);
    ctx.byStore.set(offer.deal.provider, (ctx.byStore.get(offer.deal.provider) ?? 0) + 1);
    if (brand) ctx.byBrand.set(brand, (ctx.byBrand.get(brand) ?? 0) + 1);
    ctx.lastCategories.push(category);
    ctx.lastStores.push(offer.deal.provider);
    ctx.lastBrands.push(brand ?? "");
  }
  return ctx;
}

/** Bloqueio duro: o limite configurado para categoria/marca/loja nas ultimas 24h foi atingido. */
export function diversityBlock(
  deal: Deal,
  category: string,
  brand: string | undefined,
  ctx: DiversityContext,
  cfg: BotConfig["diversity"],
): DiversityBlock | undefined {
  if (cfg.maxPerCategoryPerDay > 0 && category !== "outros" &&
    (ctx.byCategory.get(category) ?? 0) >= cfg.maxPerCategoryPerDay) return "limite-categoria";
  if (cfg.maxPerBrandPerDay > 0 && brand && (ctx.byBrand.get(brand) ?? 0) >= cfg.maxPerBrandPerDay) return "limite-marca";
  // A regra de participacao so vale quando ja ha amostra suficiente de postagens.
  if (cfg.maxStoreSharePercent > 0 && ctx.total >= 6) {
    const share = ((ctx.byStore.get(deal.provider) ?? 0) / ctx.total) * 100;
    if (share >= cfg.maxStoreSharePercent) return "limite-loja";
  }
  return undefined;
}

/** Penalidade suave para espalhar categorias, lojas e marcas entre postagens consecutivas. */
export function diversityPenalty(
  deal: Deal,
  category: string,
  brand: string | undefined,
  ctx: DiversityContext,
): number {
  let penalty = 0;
  const catIndex = ctx.lastCategories.indexOf(category);
  if (category !== "outros" && catIndex >= 0) penalty += catIndex === 0 ? 30 : catIndex < 3 ? 16 : 6;
  penalty += (ctx.byCategory.get(category) ?? 0) * 5;
  const storeIndex = ctx.lastStores.indexOf(deal.provider);
  if (storeIndex === 0) penalty += 14;
  else if (storeIndex > 0 && storeIndex < 3) penalty += 6;
  if (brand) {
    const brandIndex = ctx.lastBrands.indexOf(brand);
    if (brandIndex >= 0 && brandIndex < 4) penalty += 12;
  }
  return penalty;
}
