import { describe, expect, it } from "vitest";
import { isPcHardwareDeal } from "../src/utils/hardwareFilter.js";

describe("hardware filter", () => {
  it("accepts PC hardware categories", () => {
    expect(isPcHardwareDeal("SSD NVMe Kingston 1TB M.2")).toBe(true);
    expect(isPcHardwareDeal("Placa Mae B550 DDR4 Ryzen")).toBe(true);
    expect(isPcHardwareDeal("Fonte Corsair 650W 80 Plus")).toBe(true);
    expect(isPcHardwareDeal("Mouse gamer Logitech 12000 DPI")).toBe(true);
    expect(isPcHardwareDeal("Teclado mecanico TKL switch brown")).toBe(true);
    expect(isPcHardwareDeal("Monitor gamer ultrawide 165Hz")).toBe(true);
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
  });
});
