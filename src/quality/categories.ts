import type { CategoryId } from "../config/botConfig.js";

export const CATEGORY_LABELS: Record<CategoryId | "outros", string> = {
  gpu: "Placa de vídeo",
  cpu: "Processador",
  "placa-mae": "Placa-mãe",
  ram: "Memória RAM",
  ssd: "Armazenamento",
  fonte: "Fonte",
  gabinete: "Gabinete",
  cooler: "Refrigeração",
  monitor: "Monitor",
  teclado: "Teclado",
  mouse: "Mouse",
  audio: "Áudio",
  cadeira: "Cadeira",
  setup: "Setup e acessórios",
  celular: "Celular",
  notebook: "Notebook",
  tv: "TV",
  outros: "Outros",
};

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Classifica o titulo em uma categoria; produtos completos (notebook/celular/TV) vem antes dos componentes. */
export function detectCategory(title: string): CategoryId | "outros" {
  const t = normalizeText(title);
  if (/\b(?:notebook|laptop|ultrabook|macbook)\b/.test(t)) return "notebook";
  if (/\b(?:smartphone|celular|iphone|galaxy\s+[samz]\d)/.test(t)) return "celular";
  if (/\b(?:smart\s*(?:tv|v)|televisor|televisao)\b|\btv\s+\d{2}/.test(t)) return "tv";
  if (/\b(?:monitor\s+arm|braco\s+articulado|suporte\s+(?:articulado|de\s+mesa|para\s+(?:monitor|headset|notebook))|pegboard|screenbar|hub\s+usb|dock\s+station|mousepad|organizador)\b/.test(t)) return "setup";
  if (/\b(?:water\s*cooler|watercooler|aio|liquid\s+(?:cpu\s+)?cooler|refrigeracao\s+liquida|air\s*cooler|cpu\s+cooler|cooler\s+(?:torre|cpu)|fans?\s+argb|ventoinha|pasta\s+termica)\b/.test(t)) return "cooler";
  if (/\b(?:rtx|gtx|radeon|geforce|gpu|placa\s+de\s+video|rx\s?\d{3,4})\b/.test(t)) return "gpu";
  if (/\b(?:processador|ryzen|intel\s+core|core\s+i[3579]|core\s+ultra)\b/.test(t)) return "cpu";
  if (/\b(?:memoria\s+ram|ram\s+ddr|udimm|sodimm|dimm)\b/.test(t)) return "ram";
  if (/\b(?:placa[- ]?mae|motherboard|b[4-8]\d0|x[3-7]\d0|a[3-6]\d0|h[5-7]10)\b/.test(t)) return "placa-mae";
  if (/\bddr[345]\b/.test(t)) return "ram";
  if (/\b(?:ssd|nvme|m\.2|hd\s+externo|hdd)\b/.test(t)) return "ssd";
  if (/\b(?:fonte\s+(?:atx|sfx|gamer|pc|\d{3,4}w)|psu|80\s?plus)\b/.test(t)) return "fonte";
  if (/\b(?:gabinete|mid\s+tower|full\s+tower|mini\s+tower|aquario|pc\s+case)\b/.test(t)) return "gabinete";
  if (/\b(?:monitor|ultrawide)\b/.test(t)) return "monitor";
  if (/\b(?:teclado|keyboard)\b/.test(t)) return "teclado";
  if (/\bmouse\b/.test(t)) return "mouse";
  if (/\b(?:headset|fone|iem|earphone|headphone|microfone)\b/.test(t)) return "audio";
  if (/\bcadeira\b/.test(t)) return "cadeira";
  return "outros";
}
