import { beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";

const httpMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

const axiosMocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  isAxiosError: vi.fn(),
}));

vi.mock("../src/utils/http.js", () => ({
  http: { get: httpMocks.get },
}));

vi.mock("axios", () => ({
  default: {
    create: axiosMocks.create,
    isAxiosError: axiosMocks.isAxiosError,
  },
  create: axiosMocks.create,
  isAxiosError: axiosMocks.isAxiosError,
}));

import { AmazonProvider } from "../src/providers/AmazonProvider.js";
import { AliExpressProvider, isAliExpressFocusProduct } from "../src/providers/aliexpress.provider.js";
import { KabumProvider } from "../src/providers/KabumProvider.js";
import { MercadoLivreProvider } from "../src/providers/MercadoLivreProvider.js";
import { MercadoLivreApiProvider } from "../src/providers/MercadoLivreApiProvider.js";
import type { MercadoLivreOAuth } from "../src/services/MercadoLivreOAuth.js";
import { ShopeeProvider } from "../src/providers/ShopeeProvider.js";

describe("provider delivery checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get, post: axiosMocks.post });
    axiosMocks.isAxiosError.mockReturnValue(false);
  });

  it("extracts only quality Amazon deals", async () => {
    httpMocks.get.mockResolvedValue({
      data: `
        <div data-asin="B0CHX12345">
          <a href="/dp/B0CHX12345?ref=abc"></a>
          <span class="a-size-base-plus">SSD NVMe Kingston 1TB M.2</span>
          <img src="https://example.com/ssd.jpg" />
          <span class="a-price"><span class="a-offscreen">R$ 399,90</span></span>
          <span class="a-text-price"><span class="a-offscreen">R$ 599,90</span></span>
          <span>Use o cupom: TECH20</span>
        </div>
        <div data-asin="B0BAD12345">
          <a href="/dp/B0BAD12345"></a>
          <span class="a-size-base-plus">Placa de video GT 710 2GB DDR3</span>
          <img src="https://example.com/gt710.jpg" />
          <span class="a-price"><span class="a-offscreen">R$ 199,90</span></span>
        </div>
      `,
    });

    const deals = await new AmazonProvider("https://amazon.example/deals").getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "amazon:B0CHX12345",
      provider: "amazon",
      currentPrice: 399.9,
      couponCode: "TECH20",
      couponVerified: true,
    });
    expect(deals[0]?.originalUrl).toBe("https://www.amazon.com.br/dp/B0CHX12345");
  });

  it("extracts only quality Mercado Livre deals", async () => {
    httpMocks.get.mockResolvedValue({
      data: `
        <div class="promotion-item">
          <a href="https://www.mercadolivre.com.br/ssd-nvme-kingston-1tb/p/MLB123456?tracking=x"></a>
          <p class="promotion-item__title">SSD NVMe Kingston 1TB M.2</p>
          <img src="https://example.com/ml-ssd.jpg" />
          <span class="andes-money-amount">
            <span class="andes-money-amount__fraction">349</span>
            <span class="andes-money-amount__cents">90</span>
          </span>
          <span class="andes-money-amount andes-money-amount--previous">
            <span class="andes-money-amount__fraction">499</span>
            <span class="andes-money-amount__cents">90</span>
          </span>
          <span>Cupom: SSD50</span>
        </div>
        <div class="promotion-item">
          <a href="https://www.mercadolivre.com.br/fone-generico/p/MLB654321"></a>
          <p class="promotion-item__title">Fone gamer RGB generico</p>
          <img src="https://example.com/fone.jpg" />
          <span class="andes-money-amount"><span class="andes-money-amount__fraction">39</span></span>
        </div>
      `,
    });

    const deals = await new MercadoLivreProvider("https://ml.example/ofertas").getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "mercado-livre:MLB123456",
      provider: "mercado-livre",
      currentPrice: 349.9,
      couponCode: "SSD50",
      couponVerified: true,
    });
  });

  it("usa o id real do anuncio Mercado Livre quando o card contem wid", async () => {
    httpMocks.get.mockResolvedValue({
      data: `
        <div class="promotion-item">
          <a href="https://www.mercadolivre.com.br/monitor-lg/p/MLB79391475?tracking=x#position=3&wid=MLB7685286148&sid=offers"></a>
          <p class="promotion-item__title">Monitor Gamer LG UltraGear 27 144Hz IPS</p>
          <img src="https://example.com/monitor.jpg" />
          <span class="andes-money-amount"><span class="andes-money-amount__fraction">678</span></span>
        </div>
      `,
    });

    const deals = await new MercadoLivreProvider("https://ml.example/ofertas").getDeals();

    expect(deals[0]?.id).toBe("mercado-livre:MLB7685286148");
    expect(deals[0]?.originalUrl).toBe("https://www.mercadolivre.com.br/monitor-lg/p/MLB79391475");
  });

  it("extrai Pix e parcelamento explicitos do Mercado Livre", async () => {
    httpMocks.get.mockResolvedValue({
      data: `
        <div class="promotion-item">
          <a href="https://www.mercadolivre.com.br/monitor-lg/p/MLB123"></a>
          <p class="promotion-item__title">Monitor Gamer LG UltraGear 27 180Hz IPS</p>
          <img src="https://example.com/monitor.jpg" />
          <span class="andes-money-amount"><span class="andes-money-amount__fraction">849</span></span>
          <span>R$ 779,00 no Pix ou em até 10x de R$ 84,90 sem juros</span>
        </div>`,
    });

    const [deal] = await new MercadoLivreProvider("https://ml.example/ofertas").getDeals();

    expect(deal).toMatchObject({
      currentPrice: 779,
      pixPrice: 779,
      cardPrice: 849,
      installmentText: "em até 10x de R$ 84,90",
    });
  });

  it("rejeita a pagina de verificacao de trafego do Mercado Livre", async () => {
    httpMocks.get.mockResolvedValue({
      data: `
        <html data-assets-prefix="https://http2.mlstatic.com/frontend-assets/suspicious-traffic-frontend/">
          <div class="account-verification-header">Para continuar, acesse sua conta</div>
          <a href="/registration?registrationType=negative_traffic">Entrar</a>
        </html>
      `,
    });

    await expect(new MercadoLivreProvider("https://ml.example/ofertas").getDeals())
      .rejects.toThrow("verificacao de trafego suspeito");
  });

  it("rejeita resposta do Mercado Livre sem cards reconhecidos", async () => {
    httpMocks.get.mockResolvedValue({ data: "<html><body>pagina inesperada</body></html>" });

    await expect(new MercadoLivreProvider("https://ml.example/ofertas").getDeals())
      .rejects.toThrow("sem cards de ofertas");
  });

  it("coleta ofertas pela API oficial autenticada do Mercado Livre", async () => {
    const oauth = { getAccessToken: vi.fn().mockResolvedValue("access-token") } as unknown as MercadoLivreOAuth;
    axiosMocks.get.mockResolvedValueOnce({
      data: { content: [{ id: "MLB123456", type: "ITEM", position: 1 }] },
    }).mockResolvedValueOnce({
      data: {
        id: "MLB123456",
        title: "Monitor Gamer LG UltraGear 24 IPS 180Hz",
        price: 779,
        original_price: 999,
        permalink: "https://www.mercadolivre.com.br/monitor/p/MLB123456",
        secure_thumbnail: "https://http2.mlstatic.com/monitor.jpg",
        available_quantity: 12,
        condition: "new",
        status: "active",
      },
    });

    const deals = await new MercadoLivreApiProvider(oauth, ["MLB99245"]).getDeals();

    expect(oauth.getAccessToken).toHaveBeenCalledOnce();
    expect(axiosMocks.get).toHaveBeenNthCalledWith(1, "/highlights/MLB/category/MLB99245", {
      headers: { Authorization: "Bearer access-token" },
    });
    expect(axiosMocks.get).toHaveBeenNthCalledWith(2, "/items/MLB123456", {
      headers: { Authorization: "Bearer access-token" },
    });
    expect(deals[0]).toMatchObject({
      id: "mercado-livre:MLB123456",
      currentPrice: 779,
      previousPrice: 999,
    });
  });

  it("rejeita resposta vazia da API oficial do Mercado Livre", async () => {
    const oauth = { getAccessToken: vi.fn().mockResolvedValue("access-token") } as unknown as MercadoLivreOAuth;
    axiosMocks.get.mockResolvedValue({ data: { content: [] } });

    await expect(new MercadoLivreApiProvider(oauth, ["MLB99245"]).getDeals())
      .rejects.toThrow("nao retornou produtos");
  });

  it("usa diretamente a oferta vencedora de um produto de catalogo do Mercado Livre", async () => {
    const oauth = { getAccessToken: vi.fn().mockResolvedValue("access-token") } as unknown as MercadoLivreOAuth;
    axiosMocks.get.mockResolvedValueOnce({
      data: { content: [{ id: "MLB24162817", type: "PRODUCT", position: 1 }] },
    }).mockResolvedValueOnce({
      data: {
        id: "MLB24162817",
        status: "active",
        name: "Processador AMD Ryzen 7 5700X3D AM4",
        permalink: "https://www.mercadolivre.com.br/processador-amd/p/MLB24162817",
        pictures: [{ url: "https://http2.mlstatic.com/ryzen.jpg" }],
        buy_box_winner: {
          item_id: "MLB987654321",
          price: 1299,
          original_price: 1499,
          available_quantity: 20,
          condition: "new",
        },
      },
    });

    const deals = await new MercadoLivreApiProvider(oauth, ["MLB1693"]).getDeals();

    expect(deals[0]).toMatchObject({
      id: "mercado-livre:MLB987654321",
      title: "Processador AMD Ryzen 7 5700X3D AM4",
      currentPrice: 1299,
      previousPrice: 1499,
    });
    expect(axiosMocks.get).toHaveBeenCalledTimes(2);
  });

  it("extracts only quality Kabum deals", async () => {
    axiosMocks.get.mockResolvedValue({
      data: [
        JSON.stringify({
          id: "123456",
          title: "Placa de Video Asus RTX 4060 Dual 8GB GDDR6",
          link: "https://www.kabum.com.br/produto/123456/placa-de-video-rtx-4060",
          image_link: "https://example.com/rtx4060.jpg",
          price: "2399.90 BRL",
          sale_price: "1899.90 BRL",
          availability: "in_stock",
          condition: "new",
        }),
        JSON.stringify({
          id: "999999",
          title: "4010 30mm DC 12V Cooling Fan Brushless Motor 2PIN",
          link: "https://www.kabum.com.br/produto/999999/fan-4010",
          image_link: "https://example.com/fan.jpg",
          price: "13.69 BRL",
          availability: "in_stock",
        }),
      ].join("\n"),
    });

    const deals = await new KabumProvider({
      publisherId: "3108044",
      advertiserId: "17729",
      accessToken: "awin-token",
      locale: "pt_BR",
    }).getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "kabum:123456",
      provider: "kabum",
      currentPrice: 1899.9,
    });
    expect(deals[0]?.originalUrl).toBe("https://www.kabum.com.br/produto/123456/placa-de-video-rtx-4060");
  });

  it("extracts only quality Kabum deals from the generated Awin CSV feed URL", async () => {
    axiosMocks.get.mockResolvedValue({
      data: Buffer.from([
        "aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,search_price,store_price,in_stock,condition",
        "\"https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&p=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F123456\",\"SSD NVMe Kingston 1TB M.2 PCIe 4.0\",123456,KABUM123,\"https://example.com/ssd.jpg\",349.90,349.90,1,new",
        "\"https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&p=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F999999\",\"Filtro de Poeira Magnetico para Gabinete\",999999,KABUM999,\"https://example.com/filter.jpg\",9.90,9.90,1,new",
      ].join("\n")),
    });

    const deals = await new KabumProvider({
      publisherId: "3108044",
      advertiserId: "17729",
      feedUrl: "https://productdata.awin.com/datafeed/download/apikey/secret",
      locale: "pt_BR",
    }).getDeals();

    expect(axiosMocks.get).toHaveBeenCalledWith(
      "https://productdata.awin.com/datafeed/download/apikey/secret",
      { responseType: "arraybuffer" },
    );
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "kabum:123456",
      provider: "kabum",
      originalUrl: "https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&p=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F123456",
      currentPrice: 349.9,
    });
  });

  it("extracts Kabum deals from semicolon-separated Awin CSV feeds", async () => {
    axiosMocks.get.mockResolvedValue({
      data: Buffer.from([
        "aw_deep_link;product_name;aw_product_id;merchant_image_url;search_price",
        "\"https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&p=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F456\";\"Processador AMD Ryzen 7 5700X3D AM4\";456;\"https://example.com/ryzen.jpg\";1161.00",
      ].join("\n")),
    });

    const deals = await new KabumProvider({
      publisherId: "3108044",
      advertiserId: "17729",
      feedUrl: "https://productdata.awin.com/datafeed/download/apikey/secret",
      locale: "pt_BR",
    }).getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "kabum:456",
      provider: "kabum",
      currentPrice: 1161,
    });
  });

  it("extracts Kabum deals from gzip-compressed Awin CSV feeds", async () => {
    axiosMocks.get.mockResolvedValue({
      data: gzipSync([
        "aw_deep_link,product_name,aw_product_id,merchant_image_url,search_price",
        "\"https://www.awin1.com/cread.php?awinmid=17729&awinaffid=3108044&p=https%3A%2F%2Fwww.kabum.com.br%2Fproduto%2F789\",\"Placa Mae Asus Prime B550M-A DDR4 AM4\",789,\"https://example.com/b550.jpg\",699.90",
      ].join("\n")),
    });

    const deals = await new KabumProvider({
      publisherId: "3108044",
      advertiserId: "17729",
      feedUrl: "https://productdata.awin.com/datafeed/download/apikey/secret",
      locale: "pt_BR",
    }).getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "kabum:789",
      provider: "kabum",
      currentPrice: 699.9,
    });
  });

  it("extracts only quality Shopee deals with tracked offer links", async () => {
    axiosMocks.post.mockResolvedValue({
      data: {
        data: {
          productOfferV2: {
            nodes: [
              {
                itemId: "555",
                shopId: "777",
                productName: "Processador AMD Ryzen 5 5600 AM4",
                priceMin: "699.90",
                imageUrl: "https://example.com/ryzen.jpg",
                offerLink: "https://s.shopee.com.br/abc123",
                priceDiscountRate: 30,
              },
              {
                itemId: "999",
                shopId: "777",
                productName: "Liquidificador para smoothie com lâmina",
                priceMin: "99.90",
                imageUrl: "https://example.com/blender.jpg",
                offerLink: "https://s.shopee.com.br/bad123",
                priceDiscountRate: 50,
              },
            ],
          },
        },
      },
    });

    const deals = await new ShopeeProvider({ appId: "app-id", appSecret: "secret" }).getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "shopee:777:555",
      provider: "shopee",
      originalUrl: "https://s.shopee.com.br/abc123",
      currentPrice: 699.9,
    });
    expect(deals[0]?.discountPercentage).toBeUndefined();
    expect(deals[0]?.previousPrice).toBeUndefined();
    expect(axiosMocks.post.mock.calls[0]?.[2]?.headers.Authorization).toMatch(
      /^SHA256 Credential=app-id, Timestamp=\d+, Signature=[a-f0-9]{64}$/,
    );
  });

  it("bloqueia preco-isca da Shopee quando as variacoes possuem grande diferenca", async () => {
    axiosMocks.post.mockResolvedValue({
      data: {
        data: {
          productOfferV2: {
            nodes: [{
              itemId: "555",
              shopId: "777",
              productName: "SSD NVMe Kingston 1TB M.2 PCIe 4.0",
              priceMin: "49.90",
              priceMax: "499.90",
              imageUrl: "https://example.com/ssd.jpg",
              offerLink: "https://s.shopee.com.br/abc123",
              priceDiscountRate: 50,
              ratingStar: 4.8,
            }],
          },
        },
      },
    });

    const deals = await new ShopeeProvider({ appId: "app-id", appSecret: "secret" }).getDeals();

    expect(deals).toEqual([]);
  });

  it("extracts only quality AliExpress deals with affiliate links", async () => {
    const queriedKeywords: string[] = [];
    axiosMocks.post.mockImplementation(async (_url, body: URLSearchParams) => {
      const method = body.get("method");
      if (method === "aliexpress.affiliate.product.query") {
        queriedKeywords.push(body.get("keywords") ?? "");
        return {
          data: {
            aliexpress_affiliate_product_query_response: {
              resp_result: {
                resp_code: 200,
                result: {
                  products: {
                    product: [
                      {
                        product_id: "1001",
                        product_title: "Memória RAM DDR5 Kingston Fury Beast 32GB 6000MHz Desktop",
                        product_detail_url: "https://www.aliexpress.com/item/1001.html",
                        product_main_image_url: "https://example.com/ali-ram.jpg",
                        target_sale_price: "299.90",
                        target_original_price: "499.90",
                        discount: "40%",
                      },
                      {
                        product_id: "1002",
                        product_title: "4010 30mm DC 12V Cooling Fan Brushless Motor 2PIN",
                        product_detail_url: "https://www.aliexpress.com/item/1002.html",
                        product_main_image_url: "https://example.com/ali-fan.jpg",
                        target_sale_price: "13.69",
                      },
                    ],
                  },
                },
              },
            },
          },
        };
      }

      return {
        data: {
          aliexpress_affiliate_link_generate_response: {
            resp_result: {
              resp_code: 200,
              result: {
                promotion_links: {
                  promotion_link: [{
                    source_value: "https://www.aliexpress.com/item/1001.html",
                    promotion_link: "https://s.click.aliexpress.com/e/_quality123",
                  }],
                },
              },
            },
          },
        },
      };
    });

    const deals = await new AliExpressProvider({
      appKey: "app-key",
      appSecret: "app-secret",
      trackingId: "tracking",
    }).getDeals();

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "aliexpress:1001",
      provider: "aliexpress",
      originalUrl: "https://s.click.aliexpress.com/e/_quality123",
      currentPrice: 299.9,
    });
    expect(queriedKeywords).not.toContain("SSD NVMe");
    expect(queriedKeywords).not.toContain("graphics card");
    expect(queriedKeywords.every((keyword) =>
      /keyboard|mouse|ram|headset|earphone|water cooler|pc fan|monitor arm/i.test(keyword),
    )).toBe(true);
  });

  it("limits AliExpress products to the requested categories", () => {
    expect([
      "Teclado mecânico Redragon switch brown",
      "Gaming mouse PAW3395 sem fio",
      "Memória RAM DDR5 Kingston 32GB",
      "Gaming headset HyperX USB",
      "Water Cooler Deepcool 360mm ARGB",
      "Kit 3 fans ARGB Cooler Master 120mm",
      "Monitor arm gas spring VESA 100 para mesa",
    ].every(isAliExpressFocusProduct)).toBe(true);

    expect(isAliExpressFocusProduct("SSD NVMe Kingston 1TB M.2 PCIe 4.0")).toBe(false);
    expect(isAliExpressFocusProduct("Placa de vídeo Radeon RX 7600 8GB")).toBe(false);
  });
});
