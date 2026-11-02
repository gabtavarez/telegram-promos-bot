import type { StoreKey } from "./botConfig";

export type OfferStatus = "active" | "soldout" | "price-changed";

export interface OfferLite {
  id: string;
  title: string;
  provider: StoreKey;
  price: number;
  previousPrice?: number;
  discount?: number;
  couponCode?: string;
  imageUrl?: string;
  publishedAt: string;
  status: OfferStatus;
  url: string;
}

export interface HealthLite {
  name: string;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  durationMs: number;
  received: number;
  qualityApproved: number;
  promotable: number;
  newDeals: number;
  error?: string;
}

export interface CycleLite {
  at: string;
  durationMs: number;
  result: string;
  received: number;
  stages: { quality: number; promotable: number; fresh: number; noRepeat: number; allowed: number; diverse: number };
  rejected: Record<string, number>;
  byStore: Record<string, { received: number; passed: number }>;
  published?: { title: string; provider: string; category: string; brand?: string; score: number };
}

export interface MetricsPayload {
  mode: "live" | "demo";
  offers: OfferLite[];
  health: HealthLite[];
  cycles: CycleLite[];
  alerts: number;
  coupons: number;
  generatedAt: string;
}

export const STORE_LABEL: Record<StoreKey, string> = {
  "mercado-livre": "Mercado Livre",
  amazon: "Amazon",
  kabum: "KaBuM!",
  shopee: "Shopee",
  aliexpress: "AliExpress",
};

export const REJECT_LABEL: Record<string, string> = {
  "qualidade-baixa": "Qualidade baixa",
  "categoria-desativada": "Categoria desativada",
  "marca-bloqueada": "Marca bloqueada",
  "marca-desconhecida": "Marca desconhecida",
  "titulo-ambiguo": "Título com variações misturadas",
  "avaliacao-baixa": "Avaliação baixa",
  "poucas-vendas": "Poucas vendas",
  "sem-desconto-relevante": "Sem desconto relevante",
  "repeticao-recente": "Produto repetido",
  "filtro-painel": "Filtros do painel",
  "limite-categoria": "Limite da categoria",
  "limite-marca": "Limite da marca",
  "limite-loja": "Loja dominante",
};
