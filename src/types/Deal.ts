export type ProviderName = "amazon" | "mercado-livre" | "aliexpress" | "kabum" | "shopee";

export interface Deal {
  id: string;
  provider: ProviderName;
  title: string;
  originalUrl: string;
  displayUrl?: string;
  imageUrl: string;
  currentPrice: number;
  previousPrice?: number;
  discountPercentage?: number;
  couponCode?: string;
}
