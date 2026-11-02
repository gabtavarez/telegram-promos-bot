/** Limpa decoracao comum em titulos de marketplace e corta no ponto mais natural. */
export function cleanTitle(title: string, maxLength = 110): string {
  const cleaned = title
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/[【】\[\]★☆✔✅❤️🔥]+/g, " ")
    .replace(/\s*[|/]\s*(?=\s|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;

  const window = cleaned.slice(0, maxLength);
  // Prefere cortar numa virgula ou separador, desde que sobre texto suficiente para identificar o produto.
  const separators = [", ", " - ", " | ", " com ", " para "].map((separator) => window.lastIndexOf(separator));
  const cut = Math.max(...separators);
  const base = cut >= Math.min(50, maxLength * 0.5) ? window.slice(0, cut) : window.slice(0, window.lastIndexOf(" ") > 20 ? window.lastIndexOf(" ") : maxLength);
  return `${base.replace(/[\s,;:/\-–|(]+$/, "")}…`;
}
