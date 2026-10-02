export interface Coupon {
  code: string;
  advertiserId: number;
  advertiserName: string;
  destinationUrl: string;
  title: string;
  terms?: string;
  startsAt: Date;
  endsAt: Date;
  exclusive: boolean;
  minimumPurchase?: number;
  eligibleItemIds?: string[];
  confidence?: number;
}

export interface CouponProvider {
  readonly name: string;
  getActiveCoupons(): Promise<Coupon[]>;
  getLastError?(): string | undefined;
}
