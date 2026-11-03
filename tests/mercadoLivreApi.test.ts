import { describe, expect, it } from "vitest";
import { pickBestOffer } from "../src/providers/MercadoLivreApiProvider.js";

describe("Mercado Livre API", () => {
  it("escolhe o menor preco novo e com estoque, preferindo loja oficial em empate", () => {
    expect(pickBestOffer([
      { item_id: "A", price: 500, condition: "new" },
      { item_id: "B", price: 450, condition: "used" },
      { item_id: "C", price: 505, condition: "new", official_store_id: 9 },
      { item_id: "D", price: 300, condition: "new", available_quantity: 0 },
    ])?.item_id).toBe("C");
    expect(pickBestOffer([{ item_id: "A", price: 500 }, { item_id: "B", price: 520, official_store_id: 1 }])?.item_id).toBe("A");
    expect(pickBestOffer([{ item_id: "A", price: 0 }])).toBeUndefined();
  });
});
