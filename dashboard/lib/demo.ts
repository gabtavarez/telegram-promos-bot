import type { HealthLite, MetricsPayload, OfferLite } from "./types";
import type { StoreKey } from "./botConfig";

const CATALOG: Array<[string, number, StoreKey]> = [
  ["Placa de Vídeo RTX 5060 8GB Gigabyte Windforce", 2399, "kabum"],
  ["Monitor Gamer Curvo Samsung Odyssey 34\" G5 165Hz", 1329, "mercado-livre"],
  ["SSD NVMe Kingston NV3 1TB M.2 2280", 389, "kabum"],
  ["Processador AMD Ryzen 7 7800X3D 4.2GHz AM5", 2149, "kabum"],
  ["Memória RAM DDR5 Kingston Fury 32GB 6000MHz", 679, "amazon"],
  ["Mouse Gamer Logitech G305 Lightspeed sem fio", 161, "amazon"],
  ["Teclado Mecânico Redragon Kumara Rainbow", 189, "shopee"],
  ["Fonte Corsair CX650 80 Plus Bronze 650W", 349, "mercado-livre"],
  ["Gabinete Gamer Pichau Hydra com 4 Fans ARGB", 279, "aliexpress"],
  ["Water Cooler Redragon Ice Fort 240mm ARGB", 329, "kabum"],
  ["Headset Gamer HyperX Cloud Stinger 2", 199, "amazon"],
  ["Notebook Acer Nitro V15 RTX 4050 i5 16GB", 4799, "mercado-livre"],
  ["Placa-Mãe ASUS Prime B650M-A WiFi AM5", 899, "kabum"],
  ["Controle sem fio EasySMX X05 Versão Pro", 106, "aliexpress"],
];

// Gerador deterministico: o modo demonstracao nao muda a cada recarga.
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function demoOffers(now = Date.now()): OfferLite[] {
  const random = rng(42);
  const offers: OfferLite[] = [];
  for (let i = 0; i < 64; i += 1) {
    const [title, base, provider] = CATALOG[Math.floor(random() * CATALOG.length)]!;
    const discount = Math.round(8 + random() * 38);
    const price = Math.round(base * (0.92 + random() * 0.16));
    const previousPrice = Math.round(price / (1 - discount / 100));
    const ageHours = i * 5.2 + random() * 3;
    offers.push({
      id: `demo-${i}`,
      title,
      provider,
      price,
      previousPrice,
      discount,
      couponCode: random() < 0.22 ? "PROMO10" : undefined,
      publishedAt: new Date(now - ageHours * 3_600_000).toISOString(),
      status: random() < 0.12 ? "soldout" : random() < 0.1 ? "price-changed" : "active",
      url: "https://example.com",
    });
  }
  return offers;
}

export function demoHealth(now = Date.now()): HealthLite[] {
  const stamp = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  return [
    { name: "Mercado Livre", lastAttemptAt: stamp(3), lastSuccessAt: stamp(3), durationMs: 4200, received: 58, qualityApproved: 21, promotable: 9, newDeals: 3 },
    { name: "Kabum", lastAttemptAt: stamp(3), lastSuccessAt: stamp(3), durationMs: 2600, received: 120, qualityApproved: 64, promotable: 22, newDeals: 7 },
    { name: "Amazon", lastAttemptAt: stamp(3), lastSuccessAt: stamp(3), durationMs: 5100, received: 31, qualityApproved: 9, promotable: 4, newDeals: 1 },
    { name: "Shopee", lastAttemptAt: stamp(3), lastSuccessAt: stamp(63), durationMs: 900, received: 0, qualityApproved: 0, promotable: 0, newDeals: 0, error: "HTTP 429: limite de requisições" },
  ];
}

export function demoMetrics(): MetricsPayload {
  const now = Date.now();
  return { mode: "demo", offers: demoOffers(now), health: demoHealth(now), alerts: 17, coupons: 6, generatedAt: new Date(now).toISOString() };
}
