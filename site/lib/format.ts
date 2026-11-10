export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brlShort = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Tira decoração de marketplace e corta o título num ponto natural (mesma regra do anúncio do bot). */
export function cleanTitle(title: string, maxLength = 110): string {
  const cleaned = title
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/[【】★☆✔✅❤️🔥]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  const window = cleaned.slice(0, maxLength);
  const cut = Math.max(...[", ", " - ", " | ", " com ", " para "].map((separator) => window.lastIndexOf(separator)));
  const base = cut >= Math.min(50, maxLength * 0.5) ? window.slice(0, cut) : window.slice(0, window.lastIndexOf(" ") > 20 ? window.lastIndexOf(" ") : maxLength);
  return `${base.replace(/[\s,;:/\-–|(]+$/, "")}…`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
}

export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}
