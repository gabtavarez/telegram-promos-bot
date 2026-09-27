import type { Deal } from "../types/Deal.js";

export interface DealsStore {
  initialize(): Promise<void>;
  filterUnposted(deals: Deal[]): Promise<Deal[]>;
  markPosted(id: string, originalUrl: string, now?: Date): Promise<void>;
}
