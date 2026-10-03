import { describe, expect, it } from "vitest";
import {
  extractMercadoLivreCoupons,
  extractMercadoLivreItemIds,
  extractPublicCouponSignals,
} from "../src/coupons/MercadoLivreCouponProvider.js";

describe("MercadoLivreCouponProvider", () => {
  it("extrai cupom oficial somente quando os termos confirmam todo o site", () => {
    const coupons = extractMercadoLivreCoupons(`
      <html><body>
        <h2>CUPONS</h2>
        <p>Cupom VALEDESCONTO</p>
        <p>Cupom válido de 01/10/26 até 05/10/26 às 23h59.</p>
        <p>Desconto de até 15% em compra a partir de R$ 499, com desconto máximo de R$ 150.</p>
        <p>Válido em todo o site.</p>
      </body></html>
    `, new Date("2026-10-02T15:00:00-03:00"));

    expect(coupons).toHaveLength(1);
    expect(coupons[0]).toMatchObject({
      code: "VALEDESCONTO",
      advertiserName: "Mercado Livre",
      minimumPurchase: 499,
    });
  });

  it("nao transforma cupom oficial de itens selecionados em cupom geral", () => {
    const coupons = extractMercadoLivreCoupons(`
      <html><body>
        <p>Cupom VALEDESCONTO</p>
        <p>Cupom válido de 01/10/26 até 05/10/26.</p>
        <p>Válido somente em itens selecionados.</p>
      </body></html>
    `, new Date("2026-10-02T15:00:00-03:00"));

    expect(coupons).toEqual([]);
  });

  it("ignora cupons expirados e frases comuns que nao sao codigos", () => {
    const coupons = extractMercadoLivreCoupons(`
      <html><body>
        <p>Cupom pessoal e intransferível.</p>
        <p>Cupom ANTIGO válido de 01/04/26 até 02/04/26.</p>
      </body></html>
    `, new Date("2026-10-02T15:00:00-03:00"));

    expect(coupons).toEqual([]);
  });

  it("descobre cupom recente em canal publico e captura a lista de elegibilidade", () => {
    const signals = extractPublicCouponSignals(`
      <div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message_text">
          NOVO CUPOM MERCADO LIVRE: <code>VALEDESCONTO</code>
          15% acima de R$ 79, limitado a R$ 60.
          <a href="https://mercadolivre.com/sec/lista123">Confira a lista</a>
        </div>
        <time datetime="2026-10-02T16:00:00+00:00"></time>
      </div>
    `, new Date("2026-10-02T14:00:00-03:00"));

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      code: "VALEDESCONTO",
      minimumPurchase: 79,
      selectionUrls: ["https://mercadolivre.com/sec/lista123"],
    });
    expect(extractMercadoLivreItemIds("MLB-4241687451 MLB5551883988 MLB-4241687451"))
      .toEqual(["MLB4241687451", "MLB5551883988"]);
  });
});
