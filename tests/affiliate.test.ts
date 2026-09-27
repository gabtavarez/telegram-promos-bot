import { describe, expect, it } from "vitest";
import { addAmazonAffiliateTag, addMercadoLivreAffiliateTag } from "../src/utils/affiliate.js";

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
});
