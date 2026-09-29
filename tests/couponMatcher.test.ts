import { describe, expect, it } from "vitest";
import { findCouponForDeal } from "../src/coupons/CouponMatcher.js";
import type { Coupon } from "../src/coupons/CouponProvider.js";
import type { Deal } from "../src/types/Deal.js";

const deal: Deal = {
  id: "kabum:1",
  provider: "mercado-livre",
  title: "SSD NVMe 1TB",
  originalUrl: "https://www.kabum.com.br/produto/123/ssd-nvme",
  imageUrl: "https://example.com/image.jpg",
  currentPrice: 300,
};

const coupon: Coupon = {
  code: "HARDWARE10",
  advertiserId: 75796,
  advertiserName: "KaBuM! BR",
  destinationUrl: "https://kabum.com.br/",
  title: "10% em hardware",
  startsAt: new Date("2026-01-01T00:00:00Z"),
  endsAt: new Date("2027-01-01T00:00:00Z"),
  exclusive: false,
};

describe("coupon matcher", () => {
  it("associa cupom do mesmo domínio", () => {
    expect(findCouponForDeal(deal, [coupon])?.code).toBe("HARDWARE10");
  });

  it("não associa cupom de outra loja", () => {
    expect(findCouponForDeal(deal, [{ ...coupon, destinationUrl: "https://outraloja.com.br/" }])).toBeUndefined();
  });
});
