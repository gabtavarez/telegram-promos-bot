export interface Category {
  slug: string;
  label: string;
  group: "Componentes" | "Periféricos" | "Setup";
  pattern: RegExp;
}

// A ordem importa: a primeira regra que bate define a categoria (mesma lógica do bot/painel).
export const CATEGORIES: Category[] = [
  { slug: "notebooks", label: "Notebooks", group: "Setup", pattern: /\b(notebook|laptop|ultrabook|macbook)\b/ },
  { slug: "acessorios", label: "Acessórios de setup", group: "Setup", pattern: /\b(monitor\s+arm|braco\s+articulado|suporte\s+(articulado|de\s+mesa|para\s+(monitor|headset|notebook))|pegboard|screenbar|mousepad|dock\s+station)\b/ },
  { slug: "refrigeracao", label: "Refrigeração", group: "Componentes", pattern: /\b(water\s*cooler|watercooler|aio|liquid\s+cooler|refrigeracao\s+liquida|air\s*cooler|cpu\s+cooler|fans?\s+argb|ventoinha)\b/ },
  { slug: "placas-de-video", label: "Placas de vídeo", group: "Componentes", pattern: /\b(rtx|gtx|radeon|geforce|gpu|placa\s+de\s+video|rx\s?\d{3,4})\b/ },
  { slug: "processadores", label: "Processadores", group: "Componentes", pattern: /\b(processador|ryzen|intel\s+core|core\s+i[3579]|core\s+ultra)\b/ },
  { slug: "memorias", label: "Memórias RAM", group: "Componentes", pattern: /\b(memoria\s+ram|ram\s+ddr|udimm|sodimm|dimm|ddr[345])\b/ },
  { slug: "placas-mae", label: "Placas-mãe", group: "Componentes", pattern: /\b(placa[- ]?mae|motherboard)\b/ },
  { slug: "armazenamento", label: "SSD e armazenamento", group: "Componentes", pattern: /\b(ssd|nvme|m\.2|hd\s+externo)\b/ },
  { slug: "fontes", label: "Fontes", group: "Componentes", pattern: /\b(fonte\s+(atx|sfx|gamer|pc|\d{3,4}w)|psu|80\s?plus)\b|\bfonte\b.*\b\d{3,4}\s?w\b/ },
  { slug: "gabinetes", label: "Gabinetes", group: "Componentes", pattern: /\b(gabinete|mid\s+tower|aquario)\b/ },
  { slug: "monitores", label: "Monitores", group: "Periféricos", pattern: /\b(monitor|ultrawide)\b/ },
  { slug: "teclados", label: "Teclados", group: "Periféricos", pattern: /\b(teclado|keyboard)\b/ },
  { slug: "mouses", label: "Mouses", group: "Periféricos", pattern: /\bmouse\b/ },
  { slug: "audio", label: "Headsets e áudio", group: "Periféricos", pattern: /\b(headset|fone|fones|iem|earphone|microfone|auscultadores)\b/ },
  { slug: "cadeiras", label: "Cadeiras", group: "Setup", pattern: /\bcadeira\b/ },
  { slug: "controles", label: "Controles e consoles", group: "Periféricos", pattern: /\b(controle|gamepad|joystick|console|playstation|xbox|nintendo)\b/ },
];

export const OTHER: Pick<Category, "slug" | "label"> = { slug: "outros", label: "Outros" };

export function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function categoryOf(title: string): Pick<Category, "slug" | "label"> {
  const t = normalize(title);
  return CATEGORIES.find((category) => category.pattern.test(t)) ?? OTHER;
}

export function categoryBySlug(slug: string | undefined): Pick<Category, "slug" | "label"> | undefined {
  if (!slug) return undefined;
  return CATEGORIES.find((category) => category.slug === slug) ?? (slug === OTHER.slug ? OTHER : undefined);
}
