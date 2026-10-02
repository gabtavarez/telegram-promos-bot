import type { Deal } from "../types/Deal.js";
import type { Coupon } from "./CouponProvider.js";

export function findCouponForDeal(deal: Deal, coupons: Coupon[]): Coupon | undefined {
  // Feeds da Awin entregam o tracking como URL principal. Para comparar a loja,
  // usamos a URL final limpa quando ela estiver disponivel.
  const dealUrl = safeUrl(deal.displayUrl ?? deal.originalUrl);
  if (!dealUrl) return undefined;

  return coupons
    .filter((coupon) => {
      if (coupon.minimumPurchase !== undefined && deal.currentPrice < coupon.minimumPurchase) return false;
      if (coupon.eligibleItemIds?.length && !coupon.eligibleItemIds.some((id) => deal.id.includes(id))) return false;
      const couponUrl = safeUrl(coupon.destinationUrl);
      if (!couponUrl || !sameMerchant(dealUrl.hostname, couponUrl.hostname)) return false;
      return isStoreWide(couponUrl.pathname) || pathsMatch(dealUrl.pathname, couponUrl.pathname);
    })
    .sort((a, b) =>
      couponConfidence(b) - couponConfidence(a) ||
      Number(b.exclusive) - Number(a.exclusive) ||
      b.endsAt.getTime() - a.endsAt.getTime(),
    )[0];
}

function couponConfidence(coupon: Coupon): number {
  // Se uma lista oficial confirmou exatamente o item, ela deve vencer um
  // codigo generico mesmo que este tenha aparecido em mais fontes.
  return (coupon.eligibleItemIds?.length ? 100 : 0) + (coupon.confidence ?? 0);
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
