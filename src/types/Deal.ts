export type ProviderName = "amazon" | "mercado-livre" | "aliexpress" | "kabum" | "shopee";

import type { PriceHistoryStats } from "./BotState.js";

export interface Deal {
  id: string;
  provider: ProviderName;
  title: string;
  originalUrl: string;
  displayUrl?: string;
  imageUrl: string;
  currentPrice: number;
  /** Preco explicitamente identificado pela loja como pagamento via Pix. */
  pixPrice?: number;
  /** Preco total para outras formas de pagamento, quando informado separadamente. */
  cardPrice?: number;
  /** Parcelamento normalizado, por exemplo: "em ate 10x de R$ 84,90". */
  installmentText?: string;
  previousPrice?: number;
  discountPercentage?: number;
  couponCode?: string;
  couponEndsAt?: string;
  couponVerified?: boolean;
  priceHistory?: PriceHistoryStats;
}
