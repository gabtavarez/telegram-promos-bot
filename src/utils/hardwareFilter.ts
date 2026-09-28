const HARDWARE_TERMS = [
  // Hardware principal
  /\b(gpu|vga)\b/i,
  /\b(rtx|gtx|radeon|geforce|rx\s?\d{3,4})\b/i,
  /\b(placa\s+de\s+video|placa\s+de\s+vídeo|video\s+card|graphics\s+card)\b/i,
  /\b(cpu|processador|ryzen|intel\s+core|core\s+i[3579]|xeon|athlon)\b/i,
  /\b(ssd|nvme|m\.2|ssd\s+sata|sata\s?3|hd\s+externo|hdd\s+externo)\b/i,
  /\b(mem[oó]ria\s+ram|ram\s+ddr[345]?|ddr[345]|ddr5|ddr4|sodimm|dimm)\b/i,
  /\b(placa-m[aã]e|placa\s+m[aã]e|motherboard|b450|b550|b650|x570|x670|a520|h510|h610|h710|b760|z690|z790)\b/i,
  /\b(psu|80\s?plus|fonte\s+(?:atx|sfx|flex-atx|flex\s+atx|gamer|pc|computador)|fonte\s+\d{3,4}w|atx\s+\d{3,4}w|\d{3,4}w\s+atx|sfx\s+\d{3,4}w)\b/i,
  /\b(gabinete|case\s+gamer|mid\s+tower|full\s+tower|mini\s+tower|aqu[aá]rio|sff|mini-itx|mini\s+itx)\b/i,

  // Perifericos
  /\b(mouse\s+gamer|mousepad|teclado\s+(?:mec[aâ]nico|60%|tkl|gamer)|headset|fone\s+gamer|microfone\s+condenser)\b/i,
  /\b(monitor\s+(?:gamer|ultrawide|144hz|165hz|240hz|alta\s+taxa|alta\s+frequ[eê]ncia)|ultrawide|144hz|165hz|240hz)\b/i,

  // Organizacao e estetica de setup
  /\b(bra[cç]o\s+articulado|suporte\s+articulado\s+para\s+monitor|pegboard|painel\s+perfurado)\b/i,
  /\b(suporte\s+para\s+(?:headset|notebook)|cabo(?:s)?\s+extensor(?:es)?\s+sleeved|sleeved\s+(?:24-?pin|8-?pin|argb))\b/i,
  /\b(fan(?:s)?\s+argb|water\s*cooler|air\s*cooler|pasta\s+t[eé]rmica)\b/i,
  /\b(hub\s+usb|dock\s+station|organizador(?:es)?\s+de\s+cabos|lumin[aá]ria\s+de\s+mesa|barra\s+de\s+luz\s+para\s+monitor|screenbar)\b/i,
];

const BLOCKED_TERMS = [
  /\b(tablet|celular|smartphone|iphone|ipad|impressora|webcam|roteador)\b/i,
  /\b(liquidificador|suco|smoothie|mosquito|inseto|insetos|praga|pragas|fly\s+bug|lampada|l[aâ]mpada|led\s+luz|armadilha|assassino\s+de\s+insetos)\b/i,
  /\b(l[aâ]mina|reparo\s+de\s+celular|cola\s+uv|solda|ferro\s+de\s+solda|ferramenta(?:s)?\s+de\s+reparo|telefone\s+desmontar)\b/i,
  /\b(carregador|adaptador\s+so-?dimm|adaptador|fonte\s+usb|fonte\s+alimentacao\s+usb|fonte\s+alimenta[cç][aã]o\s+usb)\b/i,
  /\b(raspberry\s*pi|raspberry|rp2040|arduino|esp32|esp8266|microcontrolador(?:es)?|pico\s+w|pico\s+rp2040)\b/i,
];

export function isPcHardwareDeal(title: string): boolean {
  if (BLOCKED_TERMS.some((term) => term.test(title))) return false;
  return HARDWARE_TERMS.some((term) => term.test(title));
}
