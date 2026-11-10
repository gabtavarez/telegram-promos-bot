import type { CategoryId } from "./botConfig.js";

/**
 * Estado do painel compartilhado com os coletores (que sao criados uma vez, na partida).
 * O DealsJob atualiza a cada leitura da configuracao.
 */
export const runtimeConfig: { priorityCategories: CategoryId[] } = { priorityCategories: [] };

/** Buscas extras por categoria em foco (lojas com busca por palavra, como a Shopee). */
export const PRIORITY_QUERIES: Partial<Record<CategoryId, string[]>> = {
  gpu: ["placa de video rtx 5060", "placa de video rtx 5070", "placa de video rx 9060 xt", "placa de video rtx 4060"],
  cpu: ["processador ryzen 5 7600", "processador ryzen 7 7800x3d", "processador ryzen 5 5600", "processador intel core i5 14400f"],
  monitor: ["monitor gamer 27 180hz", "monitor gamer 24 165hz", "monitor gamer 2k 27", "monitor ultrawide 34"],
  "placa-mae": ["placa mae b650", "placa mae b550", "placa mae b760"],
  ram: ["memoria ram ddr5 32gb", "memoria ram ddr4 16gb 3200"],
  ssd: ["ssd nvme 1tb gen4", "ssd nvme 2tb"],
  fonte: ["fonte 650w 80 plus bronze", "fonte 750w 80 plus gold"],
  gabinete: ["gabinete gamer aquario", "gabinete mid tower vidro"],
  cooler: ["water cooler 240mm", "air cooler cpu"],
  teclado: ["teclado mecanico hot swap", "teclado magnetico rapid trigger"],
  mouse: ["mouse gamer sem fio leve", "mouse gamer paw3395"],
  audio: ["headset gamer sem fio", "headset gamer 7.1"],
  cadeira: ["cadeira gamer", "cadeira ergonomica mesh"],
  notebook: ["notebook gamer rtx 4050", "notebook gamer rtx 4060"],
};
