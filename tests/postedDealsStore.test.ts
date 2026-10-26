import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PostedDealsStore } from "../src/storage/PostedDealsStore.js";
import { formatCaption } from "../src/services/TelegramPublisher.js";
import { withTimeout } from "../src/utils/timeout.js";

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "store-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("PostedDealsStore", () => {
  it("suporta gravacoes simultaneas sem corromper os arquivos", async () => {
    const store = new PostedDealsStore(join(dir, "posted.json"));
    await store.initialize();
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.createAlert(`u${i}`, "ssd", 300)));
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.markPosted(`id${i}`, `https://x/${i}`)));
    const reloaded = new PostedDealsStore(join(dir, "posted.json"));
    await reloaded.initialize();
    expect(await reloaded.listAlerts()).toHaveLength(25);
    expect(reloaded.hasRecentlyPosted("id24")).toBe(true);
  });
});

describe("withTimeout", () => {
  it("rejeita operacoes que passam do prazo", async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, "teste")).rejects.toThrow(/excedeu/);
  });
  it("retorna o valor quando termina a tempo", async () => {
    await expect(withTimeout(Promise.resolve(7), 50, "teste")).resolves.toBe(7);
  });
});

describe("formatCaption", () => {
  it("mantem a legenda dentro do limite de 1024 caracteres com titulo gigante", () => {
    const caption = formatCaption(
      { id: "1", provider: "kabum", title: "Placa ".repeat(200), currentPrice: 100, originalUrl: "https://k/1", imageUrl: "https://i/1" } as never,
      "https://k/1?ref=abc",
    );
    expect(caption.length).toBeLessThan(1024);
  });
});

import { isRecentRepeat, isSameProduct } from "../src/utils/similarity.js";

describe("similaridade de produtos", () => {
  it("reconhece o mesmo monitor em anuncios diferentes", () => {
    expect(isSameProduct(
      "Monitor Gamer Curvo Samsung Odyssey 34\" G5 165 Hz 1ms Ultrawide Preto",
      "Monitor Samsung Odyssey G5 34 Curvo Ultrawide 165Hz",
    )).toBe(true);
    expect(isSameProduct("Monitor Samsung Odyssey G5 34 165Hz", "Monitor AOC 27 144Hz Hero")).toBe(false);
  });

  it("bloqueia repeticao em 48h, mas libera se o preco cair mais de 8%", () => {
    const offer = {
      deal: { title: "SSD NVMe Kingston NV2 1TB", currentPrice: 400 },
      publishedAt: new Date().toISOString(),
    };
    const same = { title: "SSD Kingston NV2 NVMe 1TB M.2", currentPrice: 395 } as never;
    const cheaper = { title: "SSD Kingston NV2 NVMe 1TB M.2", currentPrice: 350 } as never;
    expect(isRecentRepeat(same, [offer as never])).toBe(true);
    expect(isRecentRepeat(cheaper, [offer as never])).toBe(false);
  });
});

describe("legenda atrativa", () => {
  it("mostra preco antigo riscado, destaque e validade do cupom", () => {
    const caption = formatCaption({
      id: "1", provider: "mercado-livre", title: "Monitor Samsung Odyssey G5", currentPrice: 1329, previousPrice: 1999,
      originalUrl: "https://ml/1", imageUrl: "https://i/1", couponCode: "TVS2510", couponEndsAt: "2030-01-01T12:00:00Z",
    } as never, "https://meli.la/x");
    expect(caption).toMatch(/<s>R\$\s1\.999,00<\/s>/);
    expect(caption).toContain("SUPER OFERTA");
    expect(caption).toContain("<code>TVS2510</code> (toque para copiar)");
    expect(caption).toContain("Cupom válido até");
  });
});
