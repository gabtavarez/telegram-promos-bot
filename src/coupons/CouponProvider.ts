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
}

export interface CouponProvider {
  readonly name: string;
  getActiveCoupons(): Promise<Coupon[]>;
}
