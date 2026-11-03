import { describe, expect, it } from "vitest";
import { pickPreviousPrice, stockColumnsTrusted } from "../src/providers/KabumProvider.js";

describe("feed da KaBuM", () => {
  it("usa o preco antigo da loja quando ele faz sentido", () => {
    expect(pickPreviousPrice(800, 800, undefined, { old_price: "999.90" })).toBe(999.9);
    expect(pickPreviousPrice(800, 1000, 800, {})).toBe(1000);
    expect(pickPreviousPrice(800, 800, undefined, { saving: "200" })).toBe(1000);
    expect(pickPreviousPrice(750, 750, undefined, { savings_percent: "25" })).toBe(1000);
  });

  it("ignora preco antigo absurdo ou quase igual", () => {
    expect(pickPreviousPrice(100, 100, undefined, { old_price: "999" })).toBeUndefined();
    expect(pickPreviousPrice(100, 100, undefined, { old_price: "101" })).toBeUndefined();
    expect(pickPreviousPrice(100, 100, undefined, { old_price: "0" })).toBeUndefined();
  });

  it("so confia em colunas de estoque que o feed realmente usa", () => {
    expect(stockColumnsTrusted([{ in_stock: "0" }, { in_stock: "0" }])).toEqual({ inStock: false, forSale: false });
    expect(stockColumnsTrusted([{ in_stock: "1" }, { in_stock: "0", is_for_sale: "1" }])).toEqual({ inStock: true, forSale: true });
  });
});
