import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { pickPreviousPrice, stockColumnsTrusted, streamCsvFeed } from "../src/providers/KabumProvider.js";

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

describe("leitura em streaming do feed", () => {
  const csv = [
    "﻿aw_deep_link,product_name,description,custom_1,search_price,product_price_old",
    'https://a/1,"SSD Kingston, 1TB NVMe","Texto com ""aspas"" e\nquebra",lixo,499.90,699.90',
    "https://a/2,Mouse Logitech G203,curto,lixo,99.90,",
    "",
  ].join("\r\n");

  async function* chunks(data: Buffer, size: number) {
    for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size);
  }

  it("le CSV em qualquer tamanho de bloco e descarta colunas nao usadas", async () => {
    for (const size of [1, 2, 3, 7, 64, 10_000]) {
      const { header, records } = await streamCsvFeed(chunks(Buffer.from(csv), size));
      expect(header).toContain("custom_1");
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        aw_deep_link: "https://a/1",
        product_name: "SSD Kingston, 1TB NVMe",
        description: 'Texto com "aspas" e\nquebra',
        search_price: "499.90",
        product_price_old: "699.90",
      });
      expect(records[1]!.custom_1).toBeUndefined();
    }
  });

  it("descompacta gzip", async () => {
    const { records } = await streamCsvFeed(chunks(gzipSync(Buffer.from(csv)), 5));
    expect(records.map((record) => record.product_name)).toEqual(["SSD Kingston, 1TB NVMe", "Mouse Logitech G203"]);
  });
});
