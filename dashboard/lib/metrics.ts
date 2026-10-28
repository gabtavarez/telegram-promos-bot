import type { OfferLite } from "./types";

export type Period = "24h" | "7d" | "30d";
export const PERIODS: Array<{ id: Period; label: string; hours: number }> = [
  { id: "24h", label: "24 horas", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
];

const TZ = "America/Sao_Paulo";
const HOUR = 3_600_000;

const BRT_OFFSET = -3 * HOUR; // Brasil sem horario de verao desde 2019

function windowFor(period: Period, now: number) {
  const hourly = period === "24h";
  const size = hourly ? HOUR : 24 * HOUR;
  const count = hourly ? 24 : period === "7d" ? 7 : 30;
  // Dias alinhados a meia-noite de Brasilia, para os rotulos baterem com o canal.
  const end = hourly ? Math.ceil(now / size) * size : Math.ceil((now + BRT_OFFSET) / size) * size - BRT_OFFSET;
  return { size, count, end, start: end - count * size, hourly };
}

export function inPeriod(offers: OfferLite[], period: Period, now = Date.now()): OfferLite[] {
  const { start } = windowFor(period, now);
  return offers.filter((offer) => Date.parse(offer.publishedAt) >= start);
}

export interface Bucket { label: string; count: number }

export function timeline(offers: OfferLite[], period: Period, now = Date.now()): Bucket[] {
  const { size, count, end, hourly } = windowFor(period, now);
  const buckets: Bucket[] = Array.from({ length: count }, (_, index) => {
    const date = new Date(end - (count - index) * size + (hourly ? 0 : 12 * HOUR));
    const label = hourly
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(date)
      : new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(date);
    return { label, count: 0 };
  });
  for (const offer of offers) {
    const index = count - 1 - Math.floor((end - Date.parse(offer.publishedAt) - 1) / size);
    if (index >= 0 && index < count) buckets[index]!.count += 1;
  }
  return buckets;
}

export function categoryOf(title: string): string {
  const t = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\b(water\s*cooler|watercooler|aio|air\s*cooler|cooler)\b/, "Refrigeração"],
    [/\b(rtx|gtx|radeon|geforce|placa de video)\b/, "Placa de vídeo"],
    [/\b(processador|ryzen|intel core|core i[3579])\b/, "Processador"],
    [/\b(placa[- ]?mae|motherboard)\b/, "Placa-mãe"],
    [/\b(memoria ram|ddr[345])\b/, "Memória RAM"],
    [/\b(ssd|nvme|m\.2|hd externo)\b/, "Armazenamento"],
    [/\b(fonte|psu|80 plus)\b/, "Fonte"],
    [/\b(gabinete)\b/, "Gabinete"],
    [/\b(monitor|ultrawide)\b/, "Monitor"],
    [/\b(mouse|teclado|headset|fone gamer|controle)\b/, "Periféricos"],
    [/\b(notebook|laptop)\b/, "Notebook"],
    [/\b(smartphone|celular|iphone|galaxy)\b/, "Celular"],
    [/\b(smart tv|televisor|tv)\b/, "TV"],
  ];
  return rules.find(([pattern]) => pattern.test(t))?.[1] ?? "Outros";
}

export function countBy<T>(items: T[], key: (item: T) => string): Array<{ label: string; value: number }> {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function discountBins(offers: OfferLite[]): Bucket[] {
  const bins = [
    { label: "até 10%", min: 0, max: 10 },
    { label: "10–20%", min: 10, max: 20 },
    { label: "20–30%", min: 20, max: 30 },
    { label: "30–40%", min: 30, max: 40 },
    { label: "40%+", min: 40, max: 101 },
  ].map((bin) => ({ ...bin, count: 0 }));
  for (const offer of offers) {
    if (offer.discount === undefined) continue;
    const bin = bins.find((item) => offer.discount! >= item.min && offer.discount! < item.max);
    if (bin) bin.count += 1;
  }
  return bins.map(({ label, count }) => ({ label, count }));
}

export function summarize(offers: OfferLite[]) {
  const withDiscount = offers.filter((offer) => offer.discount !== undefined);
  const avgDiscount = withDiscount.length
    ? Math.round(withDiscount.reduce((sum, offer) => sum + (offer.discount ?? 0), 0) / withDiscount.length)
    : 0;
  return {
    total: offers.length,
    avgDiscount,
    withCoupon: offers.filter((offer) => offer.couponCode).length,
    soldout: offers.filter((offer) => offer.status === "soldout").length,
    avgPrice: offers.length ? offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length : 0,
  };
}

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}
