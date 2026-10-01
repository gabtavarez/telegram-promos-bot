import type { ProviderName } from "../types/Deal.js";

export interface AffiliateTags {
  amazon: string;
  mercadoLivre: string;
  kabum?: { advertiserId: string; publisherId: string; clickRef?: string };
}

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

export function addAwinAffiliateTag(
  productUrl: string,
  options: { advertiserId: string; publisherId: string; clickRef?: string },
): string {
  const originalUrl = safeUrl(productUrl);
  if (originalUrl.hostname.endsWith("awin1.com")) return originalUrl.toString();

  const url = new URL("https://www.awin1.com/cread.php");
  url.searchParams.set("awinmid", options.advertiserId);
  url.searchParams.set("awinaffid", options.publisherId);
  if (options.clickRef) url.searchParams.set("clickref", options.clickRef);
  url.searchParams.set("ued", productUrl);
  return url.toString();
}

export function addAffiliateTag(
  provider: ProviderName,
  productUrl: string,
  tags: AffiliateTags,
): string {
  if (provider === "amazon") return addAmazonAffiliateTag(productUrl, tags.amazon);
  if (provider === "mercado-livre") {
    return addMercadoLivreAffiliateTag(productUrl, tags.mercadoLivre);
  }
  if (provider === "kabum" && tags.kabum) return addAwinAffiliateTag(productUrl, tags.kabum);
  return productUrl;
}
