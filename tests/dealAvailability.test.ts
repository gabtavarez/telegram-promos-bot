import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "../src/types/Deal.js";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  isAxiosError: vi.fn(),
}));

vi.mock("../src/utils/http.js", () => ({
  http: { get: mocks.get },
}));

vi.mock("axios", () => ({
  default: { isAxiosError: mocks.isAxiosError },
}));

import { isDealAvailable } from "../src/services/DealAvailabilityChecker.js";

const kabumDeal: Deal = {
  id: "kabum:1",
  provider: "kabum",
  title: "Pasta termica Corsair",
  originalUrl: "https://www.awin1.com/pclick.php?p=1&a=2&m=3",
  imageUrl: "https://example.com/image.jpg",
  currentPrice: 129.99,
};

describe("isDealAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAxiosError.mockReturnValue(false);
  });

  it("bloqueia produto da Kabum marcado como esgotado", async () => {
    mocks.get.mockResolvedValue({ data: "<h2>Produto Esgotado</h2><button>Avise-me quando chegar</button>" });

    await expect(isDealAvailable(kabumDeal)).resolves.toBe(false);
  });

  it("aceita produto da Kabum sem marcador de indisponibilidade", async () => {
    mocks.get.mockResolvedValue({ data: "<button>Comprar agora</button>" });

    await expect(isDealAvailable(kabumDeal)).resolves.toBe(true);
  });

  it("nao consulta a pagina de outros provedores", async () => {
    await expect(isDealAvailable({ ...kabumDeal, provider: "shopee" })).resolves.toBe(true);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("bloqueia a oferta se a verificacao da Kabum falhar", async () => {
    mocks.get.mockRejectedValue(new Error("timeout"));

    await expect(isDealAvailable(kabumDeal)).resolves.toBe(false);
  });
});
