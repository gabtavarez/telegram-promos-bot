import { NextResponse } from "next/server";
import type { StoreKey } from "@/lib/botConfig";
import { demoMetrics } from "@/lib/demo";
import type { HealthLite, MetricsPayload, OfferLite } from "@/lib/types";
import { KEYS, hasUpstash, parseJson, redis } from "@/lib/upstash";

export const dynamic = "force-dynamic";

interface RawOffer {
  deal: {
    id: string;
    provider: StoreKey;
    title: string;
    currentPrice: number;
    previousPrice?: number;
    imageUrl?: string;
    couponCode?: string;
  };
  affiliateUrl: string;
  publishedAt: string;
  status: OfferLite["status"];
}

// Mesma regra do bot: so considera desconto verificavel (1% a 80%, preco anterior ate 5x).
function verifiedDiscount(current: number, previous?: number): number | undefined {
  if (!previous || previous <= current || previous / current > 5) return undefined;
  const value = Math.round(((previous - current) / previous) * 100);
  return value >= 1 && value <= 80 ? value : undefined;
}

export async function GET() {
  if (!hasUpstash) return NextResponse.json(demoMetrics());
  try {
    const [published, health, alerts, coupons] = await redis<Array<string | null>>([
      "MGET", KEYS.published, KEYS.health, KEYS.alerts, KEYS.coupons,
    ]) as [string | null, string | null, string | null, string | null];
    const offers: OfferLite[] = parseJson<RawOffer[]>(published, []).map((offer) => ({
      id: offer.deal.id,
      title: offer.deal.title,
      provider: offer.deal.provider,
      price: offer.deal.currentPrice,
      previousPrice: offer.deal.previousPrice,
      discount: verifiedDiscount(offer.deal.currentPrice, offer.deal.previousPrice),
      couponCode: offer.deal.couponCode,
      imageUrl: offer.deal.imageUrl,
      publishedAt: offer.publishedAt,
      status: offer.status,
      url: offer.affiliateUrl,
    }));
    const payload: MetricsPayload = {
      mode: "live",
      offers,
      health: parseJson<HealthLite[]>(health, []),
      alerts: parseJson<unknown[]>(alerts, []).length,
      coupons: parseJson<unknown[]>(coupons, []).length,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler o Redis" }, { status: 502 });
  }
}
