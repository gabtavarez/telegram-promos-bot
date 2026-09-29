import type { Deal } from "../types/Deal.js";
import type { Coupon } from "./CouponProvider.js";

export function findCouponForDeal(deal: Deal, coupons: Coupon[]): Coupon | undefined {
  const dealUrl = safeUrl(deal.originalUrl);
  if (!dealUrl) return undefined;

  return coupons
    .filter((coupon) => {
      const couponUrl = safeUrl(coupon.destinationUrl);
      if (!couponUrl || !sameMerchant(dealUrl.hostname, couponUrl.hostname)) return false;
      return isStoreWide(couponUrl.pathname) || pathsMatch(dealUrl.pathname, couponUrl.pathname);
    })
    .sort((a, b) => Number(b.exclusive) - Number(a.exclusive) || b.endsAt.getTime() - a.endsAt.getTime())[0];
}

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function sameMerchant(first: string, second: string): boolean {
  const normalize = (hostname: string) => hostname.toLowerCase().replace(/^www\./, "");
  const left = normalize(first);
  const right = normalize(second);
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

function isStoreWide(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

function pathsMatch(first: string, second: string): boolean {
  const normalize = (pathname: string) => pathname.replace(/\/$/, "").toLowerCase();
  const left = normalize(first);
  const right = normalize(second);
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
