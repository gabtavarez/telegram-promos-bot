export type ProviderName = "amazon" | "mercado-livre";

export interface Deal {
  id: string;
  provider: ProviderName;
  title: string;
  originalUrl: string;
  imageUrl: string;
  currentPrice: number;
  previousPrice?: number;
  discountPercentage?: number;
}
