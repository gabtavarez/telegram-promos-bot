export function extractVisibleCouponCode(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, " ").trim();
  const explicit = normalized.match(
    /\b(?:use\s+(?:o\s+)?cupom|cupom|c[oó]digo)\s*(?::|-)\s*([A-Z0-9][A-Z0-9_-]{3,24})\b/i,
  );
  if (!explicit) return undefined;

  const code = explicit[1]?.toUpperCase();
  if (!code || /^(?:ATIVO|DISPONIVEL|APLICAVEL|DESCONTO|OFERTA)$/.test(code)) return undefined;
  return code;
}
