import { describe, expect, it } from "vitest";
import { addAmazonAffiliateTag, addAwinAffiliateTag, addMercadoLivreAffiliateTag } from "../src/utils/affiliate.js";

describe("affiliate links", () => {
  it("adds and replaces the Amazon tag", () => {
    const result = addAmazonAffiliateTag("https://www.amazon.com.br/dp/B012345678?tag=old", "new-20");
    expect(new URL(result).searchParams.get("tag")).toBe("new-20");
  });

  it("adds all Mercado Livre tracking parameters", () => {
    const result = addMercadoLivreAffiliateTag(
      "https://produto.mercadolivre.com.br/MLB-123?source=home",
      "matt_tool=123&matt_word=hardware",
    );
    const url = new URL(result);
    expect(url.searchParams.get("source")).toBe("home");
    expect(url.searchParams.get("matt_tool")).toBe("123");
    expect(url.searchParams.get("matt_word")).toBe("hardware");
  });

  it("builds Awin deep links for Kabum", () => {
    const result = addAwinAffiliateTag("https://www.kabum.com.br/produto/123/placa-de-video", {
      advertiserId: "17729",
      publisherId: "3108044",
      clickRef: "Telegram",
    });
    const url = new URL(result);
    expect(url.origin).toBe("https://www.awin1.com");
    expect(url.searchParams.get("awinmid")).toBe("17729");
    expect(url.searchParams.get("awinaffid")).toBe("3108044");
    expect(url.searchParams.get("clickref")).toBe("Telegram");
    expect(url.searchParams.get("ued")).toBe("https://www.kabum.com.br/produto/123/placa-de-video");
  });

  it("keeps existing Awin links unchanged", () => {
    const awinUrl = "https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&ued=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F123";
    const result = addAwinAffiliateTag(awinUrl, {
      advertiserId: "17729",
      publisherId: "3108044",
      clickRef: "Telegram",
    });

    const url = new URL(result);
    expect(url.origin).toBe("https://www.awin1.com");
    expect(url.searchParams.get("awinmid")).toBe("17729");
    expect(url.searchParams.get("awinaffid")).toBe("3108044");
    expect(url.searchParams.get("clickref")).toBeNull();
    expect(url.searchParams.get("ued")).toBe("https://www.kabum.com.br/produto/123");
  });
});
