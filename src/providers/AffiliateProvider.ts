import type { Deal } from "../types/Deal.js";

export interface AffiliateProvider {
  readonly name: string;
  getDeals(): Promise<Deal[]>;
}
