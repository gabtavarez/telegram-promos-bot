import type { StoredOffer } from "./data";

/** Ofertas de exemplo para rodar o site sem Upstash (desenvolvimento local). */
export const DEMO_OFFERS: StoredOffer[] = [
  {
    "deal": {
      "id": "demo-0",
      "provider": "mercado-livre",
      "title": "Monitor Gamer LG UltraGear 27\" FHD 200Hz 1ms IPS - 27G523",
      "imageUrl": "/logo.png",
      "currentPrice": 799,
      "previousPrice": 949
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1000,
    "publishedAt": "2026-11-10T02:01:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-1",
      "provider": "kabum",
      "title": "Placa de Vídeo ASRock Radeon RX 7600 8GB Challenger OC GDDR6",
      "imageUrl": "/logo.png",
      "currentPrice": 1599.9,
      "previousPrice": 1999.9
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1001,
    "publishedAt": "2026-11-10T01:20:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-2",
      "provider": "kabum",
      "title": "SSD Kingston NV3 1TB M.2 NVMe 2280 PCIe 4.0",
      "imageUrl": "/logo.png",
      "currentPrice": 389.9,
      "previousPrice": 529.9,
      "couponCode": "KABUM10",
      "couponVerified": true
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1002,
    "publishedAt": "2026-11-10T00:39:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-3",
      "provider": "aliexpress",
      "title": "Teclado Mecânico AJAZZ AK820 Pro Tri-Mode Hot Swap Gasket RGB",
      "imageUrl": "/logo.png",
      "currentPrice": 219.5,
      "previousPrice": 329.9
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1003,
    "publishedAt": "2026-11-09T23:58:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-4",
      "provider": "mercado-livre",
      "title": "Mouse Gamer Sem Fio Logitech G502 X Plus RGB 25600 DPI",
      "imageUrl": "/logo.png",
      "currentPrice": 699,
      "previousPrice": 999
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1004,
    "publishedAt": "2026-11-09T23:17:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-5",
      "provider": "kabum",
      "title": "Processador AMD Ryzen 7 5700X 3.4GHz (4.6GHz Turbo) AM4",
      "imageUrl": "/logo.png",
      "currentPrice": 899.9,
      "previousPrice": 1199.9
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1005,
    "publishedAt": "2026-11-09T22:36:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-6",
      "provider": "mercado-livre",
      "title": "Fonte Corsair RM650e 650W 80 Plus Gold Full Modular ATX 3.1",
      "imageUrl": "/logo.png",
      "currentPrice": 499,
      "previousPrice": 629
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1006,
    "publishedAt": "2026-11-09T21:55:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-7",
      "provider": "shopee",
      "title": "Headset Gamer Redragon Zeus X RGB 7.1 USB",
      "imageUrl": "/logo.png",
      "currentPrice": 229.9,
      "previousPrice": 299.9,
      "couponCode": "SHOPEE15",
      "couponVerified": true
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1007,
    "publishedAt": "2026-11-09T21:14:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-8",
      "provider": "aliexpress",
      "title": "Memória RAM Kingston Fury Beast 16GB DDR5 6000MHz CL36",
      "imageUrl": "/logo.png",
      "currentPrice": 349.9,
      "previousPrice": 459.9
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1008,
    "publishedAt": "2026-11-09T20:33:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-9",
      "provider": "kabum",
      "title": "Water Cooler Gigabyte Gaming 360 ARGB 360mm AMD e Intel",
      "imageUrl": "/logo.png",
      "currentPrice": 389.9,
      "previousPrice": 549.9
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1009,
    "publishedAt": "2026-11-09T19:52:29Z",
    "status": "soldout"
  },
  {
    "deal": {
      "id": "demo-10",
      "provider": "mercado-livre",
      "title": "Cadeira Gamer ThunderX3 Eaze Mesh até 125kg Braço 2D",
      "imageUrl": "/logo.png",
      "currentPrice": 699,
      "previousPrice": 999
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1010,
    "publishedAt": "2026-11-09T19:11:29Z",
    "status": "active"
  },
  {
    "deal": {
      "id": "demo-11",
      "provider": "mercado-livre",
      "title": "Placa-Mãe Asus TUF Gaming B550M-Plus AM4 DDR4 mATX",
      "imageUrl": "/logo.png",
      "currentPrice": 749,
      "previousPrice": 899
    },
    "affiliateUrl": "https://example.com",
    "messageId": 1011,
    "publishedAt": "2026-11-09T18:30:29Z",
    "status": "active"
  }
];
