import { describe, expect, it } from "vitest";
import { isPcHardwareDeal } from "../src/utils/hardwareFilter.js";

describe("hardware filter", () => {
  it("accepts PC hardware categories", () => {
    expect(isPcHardwareDeal("SSD NVMe Kingston 1TB M.2")).toBe(true);
    expect(isPcHardwareDeal("Placa Mae B550 DDR4 Ryzen")).toBe(true);
    expect(isPcHardwareDeal("Fonte Corsair 650W 80 Plus")).toBe(true);
  });

  it("rejects unrelated electronics", () => {
    expect(isPcHardwareDeal("Tablet Android 14 24GB RAM")).toBe(false);
    expect(isPcHardwareDeal("Impressora Canon Pixma")).toBe(false);
    expect(isPcHardwareDeal("Headset gamer drivers 50mm")).toBe(false);
    expect(isPcHardwareDeal("1 pc eletrico fly bug mosquito assassino de insetos led luz armadilha lampada controle pragas pequenas com fonte alimentacao usb e adaptador")).toBe(false);
    expect(isPcHardwareDeal("Placa Raspberry Pi Pico RP2040 PICO W Dual-Core 264KB ARM Microcontroladores de baixa potencia")).toBe(false);
  });
});
