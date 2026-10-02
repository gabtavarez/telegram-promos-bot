import type { Coupon, CouponProvider } from "./CouponProvider.js";

export class CompositeCouponProvider implements CouponProvider {
  readonly name: string;

  constructor(private readonly providers: CouponProvider[]) {
    this.name = providers.map((provider) => provider.name).join(" + ");
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    const results = await Promise.all(this.providers.map(async (provider) => {
      try {
        return await provider.getActiveCoupons();
      } catch (error) {
        console.warn(`Falha ao consultar cupons de ${provider.name}.`, error);
        return [];
      }
    }));

    const unique = new Map<string, Coupon>();
    for (const coupon of results.flat()) {
      const key = `${coupon.advertiserName.toLowerCase()}:${coupon.code.toUpperCase()}`;
      const current = unique.get(key);
      if (!current || coupon.endsAt > current.endsAt) unique.set(key, coupon);
    }
    return [...unique.values()];
  }

  getLastError(): string | undefined {
    const errors = this.providers
      .map((provider) => provider.getLastError?.())
      .filter((error): error is string => Boolean(error));
    return errors.length ? errors.join(" | ") : undefined;
  }
}
