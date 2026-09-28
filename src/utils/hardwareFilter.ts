const HARDWARE_TERMS = [
  /\b(gpu|vga)\b/i,
  /\b(rtx|gtx|radeon|geforce|rx\s?\d{3,4})\b/i,
  /\b(placa\s+de\s+video|placa\s+de\s+vídeo|video\s+card|graphics\s+card)\b/i,
  /\b(cpu|processador|ryzen|intel\s+core|core\s+i[3579]|xeon|athlon)\b/i,
  /\b(ssd|nvme|m\.2|sata\s?3)\b/i,
  /\b(mem[oó]ria\s+ram|ram\s+ddr[345]?|ddr[345]|sodimm|dimm)\b/i,
  /\b(placa-m[aã]e|placa\s+m[aã]e|motherboard|b450|b550|b650|x570|x670|a520|h510|h610|h710|b760|z690|z790)\b/i,
  /\b(psu|80\s?plus|fonte\s+(?:atx|gamer|pc|computador)|fonte\s+\d{3,4}w|atx\s+\d{3,4}w|\d{3,4}w\s+atx)\b/i,
  /\b(gabinete|case\s+gamer|mid\s+tower|full\s+tower|mini\s+tower)\b/i,
];

const BLOCKED_TERMS = [
  /\b(tablet|celular|smartphone|iphone|ipad|impressora|headset|fone|monitor|notebook|mouse|teclado|webcam|roteador)\b/i,
  /\b(mosquito|inseto|insetos|praga|pragas|fly\s+bug|lampada|l[aâ]mpada|led\s+luz|armadilha|assassino\s+de\s+insetos)\b/i,
  /\b(carregador|adaptador|fonte\s+usb|fonte\s+alimentacao\s+usb|fonte\s+alimenta[cç][aã]o\s+usb)\b/i,
  /\b(raspberry\s*pi|raspberry|rp2040|arduino|esp32|esp8266|microcontrolador(?:es)?|pico\s+w|pico\s+rp2040)\b/i,
];

export function isPcHardwareDeal(title: string): boolean {
  if (BLOCKED_TERMS.some((term) => term.test(title))) return false;
  return HARDWARE_TERMS.some((term) => term.test(title));
}
