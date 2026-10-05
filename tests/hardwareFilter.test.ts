import { describe, expect, it } from "vitest";
import { getHardwareQualityScore, isPcHardwareDeal } from "../src/utils/hardwareFilter.js";

describe("hardware filter", () => {
  it("accepts PC hardware categories", () => {
    expect(isPcHardwareDeal("SSD NVMe Kingston 1TB M.2")).toBe(true);
    expect(isPcHardwareDeal("Placa Mae B550 DDR4 Ryzen")).toBe(true);
    expect(isPcHardwareDeal("Fonte Corsair 650W 80 Plus")).toBe(true);
    expect(isPcHardwareDeal("Mouse gamer Logitech 12000 DPI")).toBe(true);
    expect(getHardwareQualityScore("Gaming headset HyperX USB 7.1 surround")).toBeGreaterThanOrEqual(6);
    expect(getHardwareQualityScore("IEM JBL gamer low latency")).toBeGreaterThanOrEqual(6);
    expect(isPcHardwareDeal("Teclado mecanico TKL switch brown")).toBe(true);
    expect(isPcHardwareDeal("Teclado magnetico Hall Effect 68% RGB")).toBe(true);
    expect(isPcHardwareDeal("Teclado 75% sem fio RGB")).toBe(true);
    expect(isPcHardwareDeal("Teclado 100% ABNT2")).toBe(true);
    expect(isPcHardwareDeal("Monitor gamer ultrawide 165Hz")).toBe(true);
    expect(isPcHardwareDeal("Smart TV Samsung 50 polegadas Crystal UHD 4K")).toBe(true);
    expect(isPcHardwareDeal("Televisor LG OLED 55 polegadas 4K")).toBe(true);
    expect(isPcHardwareDeal("Notebook Vaio Ryzen 7 5825U 16GB RAM 512GB SSD Wi-Fi 6")).toBe(true);
    expect(isPcHardwareDeal("Braco articulado para monitor")).toBe(true);
    expect(isPcHardwareDeal("Fans ARGB 120mm para gabinete")).toBe(true);
    expect(isPcHardwareDeal("Luminaria de mesa ScreenBar para monitor")).toBe(true);
    expect(isPcHardwareDeal("Cadeira Ergonômica de Escritório Giratória com Encosto Mesh e Apoio Lombar")).toBe(true);
    expect(isPcHardwareDeal("Smartphone Samsung Galaxy S24 5G 256GB 8GB RAM")).toBe(true);
    expect(isPcHardwareDeal("Apple iPhone 16 128GB 5G")).toBe(true);
    expect(isPcHardwareDeal("Samsung Galaxy A56 5G 256GB")).toBe(true);
  });

  it("blocks Mancer products and complete computers", () => {
    expect(isPcHardwareDeal("Gabinete Gamer Mancer Narok Mid-Tower RGB")).toBe(false);
    expect(isPcHardwareDeal("PC Gamer Ryzen 5 5600G 16GB RAM SSD NVMe 1TB")).toBe(false);
    expect(isPcHardwareDeal("Computador completo Intel Core i5 16GB SSD 512GB")).toBe(false);
    expect(isPcHardwareDeal("Desktop montado Ryzen 7 5700G 32GB DDR4")).toBe(false);
  });

  it("keeps quality standalone cases", () => {
    expect(isPcHardwareDeal("Gabinete Gamer Corsair 4000D Airflow Mid-Tower ATX")).toBe(true);
  });

  it("rejects unrelated electronics", () => {
    expect(isPcHardwareDeal("Tablet Android 14 24GB RAM")).toBe(false);
    expect(isPcHardwareDeal("Impressora Canon Pixma")).toBe(false);
    expect(isPcHardwareDeal("Fone bluetooth para celular")).toBe(false);
    expect(isPcHardwareDeal("1 pc eletrico fly bug mosquito assassino de insetos led luz armadilha lampada controle pragas pequenas com fonte alimentacao usb e adaptador")).toBe(false);
    expect(isPcHardwareDeal("Placa Raspberry Pi Pico RP2040 PICO W Dual-Core 264KB ARM Microcontroladores de baixa potencia")).toBe(false);
    expect(isPcHardwareDeal("8 pcs ultra fino ic chip cpu lamina faca placa-mae manutencao cola uv limpador removedor telefone desmontar ferramentas de reparo")).toBe(false);
    expect(isPcHardwareDeal("Liquidificador portatil para suco e smoothie")).toBe(false);
    expect(isPcHardwareDeal("Adaptador SO-DIMM para DDR4 notebook")).toBe(false);
    expect(isPcHardwareDeal("Filtro de Poeira Magnetico com Rede de Malha para Gabinete de PC e Fonte de Alimentacao")).toBe(false);
    expect(isPcHardwareDeal("Testador de Indutancia W01 Testador de Bobinas de Placa-Mae Detector Rapido de Falhas")).toBe(false);
    expect(isPcHardwareDeal("Smart TV 32 polegadas HD")).toBe(false);
    expect(isPcHardwareDeal("TV TCL 55 polegadas Full HD")).toBe(false);
    expect(isPcHardwareDeal("Android TV Box 4K")).toBe(false);
    expect(isPcHardwareDeal("Suporte articulado para TV de 50 a 75 polegadas")).toBe(false);
    expect(isPcHardwareDeal("4010 12025 8010 30mm DC 5V 12V Cooling Fan Brushless Motor Case Quiet 2PIN")).toBe(false);
    expect(isPcHardwareDeal("Placa de video GT 710 2GB DDR3 HDMI")).toBe(false);
    expect(isPcHardwareDeal("Notebook Intel Celeron 4GB RAM 128GB eMMC")).toBe(false);
    expect(isPcHardwareDeal("Fonte ATX 300W Real Bivolt Chaveada")).toBe(false);
    expect(isPcHardwareDeal("Mouse sem fio escritorio silencioso")).toBe(false);
    expect(isPcHardwareDeal("Fone gamer RGB generico")).toBe(false);
    expect(isPcHardwareDeal("Samsung Galaxy A06 128GB 4GB RAM")).toBe(false);
    expect(isPcHardwareDeal("Apple iPhone 11 64GB")).toBe(false);
    expect(isPcHardwareDeal("Capa para iPhone 16 Pro Max")).toBe(false);
    expect(isPcHardwareDeal("Capa Para Ins Amor Silicone Macio TPU Samsung Galaxy A55 A54 A53 A52s A52 A35 A34 A16 A15 A14 5G 4G A06 A05 Telefone")).toBe(false);
    expect(isPcHardwareDeal("YBD Embalagem Para Samsung Galaxy A56 A36 A26 A34 A35 A54 A55 A24 A25 A37 A57 A27 5G Dourado Borboleta Urso Galvanoplast")).toBe(false);
    expect(isPcHardwareDeal("Hagibis 2230 M.2 NVMe SSD Gabinete USB 3.2 Gen 2 para PCI-E M.2 SSD Case 2242 SSD externo Disquete para iPhone 17 Pro Laptops")).toBe(false);
    expect(isPcHardwareDeal("Case externo para SSD M.2 NVMe USB-C 10Gbps")).toBe(false);
    expect(isPcHardwareDeal("Turzx 2.1 Polegada ips tela secundaria usb tipo-c 480x480 display redondo para refrigerador de agua pc cpu gpu ram hdd monitor com caso cnc")).toBe(false);
    expect(isPcHardwareDeal("METALFISH Flex 500/600W 80PLUS GOLD Fonte de alimentacao modular completa Flex-ATX 1U PSU para ITX Mini PC POS NAS GPU Dock")).toBe(false);
    expect(isPcHardwareDeal("Dissipador SSD M.2 2280 NVMe Delta-CN510 ARGB 5V 3 Pinos Aura Sync")).toBe(false);
  });

  it("scores curated products above weak products", () => {
    expect(getHardwareQualityScore("RTX 4060 Asus Dual 8GB GDDR6")).toBeGreaterThan(
      getHardwareQualityScore("Placa de video GT 710 2GB DDR3"),
    );
    expect(getHardwareQualityScore("SSD NVMe Kingston 1TB M.2")).toBeGreaterThan(0);
  });
});
