import type { ProviderName } from "../types/Deal.js";

function safeUrl(rawUrl: string): URL {
  return new URL(rawUrl);
}

export function addAmazonAffiliateTag(productUrl: string, tag: string): string {
  const url = safeUrl(productUrl);
  url.searchParams.set("tag", tag);
  return url.toString();
}

export function addMercadoLivreAffiliateTag(productUrl: string, tracking: string): string {
  const url = safeUrl(productUrl);
  const normalized = tracking.replace(/^\?/, "");
  const params = new URLSearchParams(normalized.includes("=") ? normalized : `matt_tool=${normalized}`);

  params.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

export function addAffiliateTag(
  provider: ProviderName,
  productUrl: string,
  tags: { amazon: string; mercadoLivre: string },
): string {
  return provider === "amazon"
    ? addAmazonAffiliateTag(productUrl, tags.amazon)
    : addMercadoLivreAffiliateTag(productUrl, tags.mercadoLivre);
}
