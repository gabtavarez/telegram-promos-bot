import { describe, expect, it } from "vitest";
import { getHardwareQualityScore, isPcHardwareDeal } from "../src/utils/hardwareFilter.js";

describe("hardware filter", () => {
  it("accepts PC hardware categories", () => {
    expect(isPcHardwareDeal("SSD NVMe Kingston 1TB M.2")).toBe(true);
    expect(isPcHardwareDeal("Placa Mae B550 DDR4 Ryzen")).toBe(true);
    expect(isPcHardwareDeal("Fonte Corsair 650W 80 Plus")).toBe(true);
    expect(isPcHardwareDeal("Mouse gamer Logitech 12000 DPI")).toBe(true);
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
  });

  it("scores curated products above weak products", () => {
    expect(getHardwareQualityScore("RTX 4060 Asus Dual 8GB GDDR6")).toBeGreaterThan(
      getHardwareQualityScore("Placa de video GT 710 2GB DDR3"),
    );
    expect(getHardwareQualityScore("SSD NVMe Kingston 1TB M.2")).toBeGreaterThan(0);
  });
});
