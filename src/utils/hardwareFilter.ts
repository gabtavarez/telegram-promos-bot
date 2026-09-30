const QUALITY_TV_TERM =
  /^(?=.*\b(?:smart\s*(?:tv|v)|tv|televis[aã]o|televisor)\b)(?=.*\b(?:4k|uhd|qled|oled|neo\s*qled|mini\s*led|crystal\s*uhd)\b)(?=.*\b(?:5\d|[6-9]\d|1\d{2})\s*(?:["”]|pol(?:egadas?)?)).*$/i;

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
  /\b(mouse\s+gamer|mousepad|teclado\s+(?:mec[aâ]nico|magn[eé]tico|hall\s*effect|60\s*%|68\s*%|75\s*%|100\s*%|tkl|gamer)|headset|fone\s+gamer|microfone\s+condenser)(?=\s|$|[,:;()\-])/i,
  /\b(monitor\s+(?:gamer|ultrawide|144hz|165hz|240hz|alta\s+taxa|alta\s+frequ[eê]ncia)|ultrawide|144hz|165hz|240hz)\b/i,

  // TVs boas para setup/sala gamer: smart, 4K/painel premium e tela grande
  QUALITY_TV_TERM,

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
  /\b(filtro\s+de\s+poeira|dust\s+filter|mesh\s+shield|tela\s+de\s+poeira)\b/i,
  /\b(testador\s+de\s+indut[aâ]ncia|inductance\s+tester|testador\s+de\s+bobinas?|detector\s+de\s+falhas?|ferramenta(?:s)?\s+de\s+manuten[cç][aã]o)\b/i,
  /\b(carregador|adaptador\s+so-?dimm|adaptador|fonte\s+usb|fonte\s+alimentacao\s+usb|fonte\s+alimenta[cç][aã]o\s+usb)\b/i,
  /\b(raspberry\s*pi|raspberry|rp2040|arduino|esp32|esp8266|microcontrolador(?:es)?|pico\s+w|pico\s+rp2040)\b/i,
  /\b(tv\s*box|controle\s+remoto\s+(?:para\s+)?tv|painel\s+para\s+tv|rack\s+para\s+tv)\b/i,
  /^(?=.*\bsuporte\b)(?=.*\btv\b).*$/i,
];

const LOW_QUALITY_TERMS = [
  /\b(gt\s?710|gt\s?730|gt\s?1030|rx\s?550|rx\s?580\s+2048sp)\b/i,
  /\b(celeron|pentium|atom|sempron|core\s+2\s+duo|i[357]\s*-\s*[2-7]\d{3})\b/i,
  /\b(ddr2|ddr3|2gb\s+ram|4gb\s+ram|emmc|hd\s+320gb|hd\s+500gb)\b/i,
  /\b(ssd\s+(?:16|32|64|120|128)gb|(?:16|32|64|120|128)gb\s+ssd)\b/i,
  /\b(fonte\s+real|fonte\s+gamer\s+real|bivolt\s+chaveada|fonte\s+atx\s+(?:200|230|250|300|350)w)\b/i,
  /\b(kit\s+x99|kit\s+x79|placa\s+x99|placa\s+x79|recondicionado|refurbished|usad[ao]|minera[cç][aã]o)\b/i,
  /\b(4010|4020|3010|30mm|40mm|50mm|60mm|70mm|2\s*pin|brushless\s+motor|3d\s*print)\b/i,
  /\b(fan\s+(?:dc|5v|12v|24v)|cooling\s+fan|ventoinha\s+(?:dc|5v|12v|24v))\b/i,
  /\b(mouse\s+(?:sem\s+fio\s+)?(?:office|escrit[oó]rio|silencioso)|teclado\s+membrana|kit\s+teclado\s+e\s+mouse)\b/i,
  /\b(fone\s+bluetooth|fone\s+de\s+ouvido\s+sem\s+fio|fone\s+de\s+celular)\b/i,
];

const TRUSTED_BRANDS = [
  /\b(asus|gigabyte|msi|asrock|biostar|galax|zotac|pny|sapphire|powercolor|xfx)\b/i,
  /\b(amd|nvidia|intel|ryzen|radeon|geforce)\b/i,
  /\b(kingston|corsair|crucial|samsung|western\s+digital|wd|sandisk|lexar|xpg|adata|teamgroup|team\s+group|seagate)\b/i,
  /\b(cooler\s+master|seasonic|super\s+flower|deepcool|nzxt|thermaltake|montech|lian\s+li|pichau|mancer|aigo)\b/i,
  /\b(logitech|razer|redragon|hyperx|havit|attack\s+shark|delux|ajazz|darmoshark|machenike|fifine|maono|edifier|jbl|anker|baseus)\b/i,
  /\b(lg|samsung|aoc|acer|dell|benq|tcl|philips|hisense)\b/i,
];

const QUALITY_SIGNALS = [
  /\b(rtx\s?30\d0|rtx\s?40\d0|rtx\s?50\d0|rx\s?6[6-9]\d0|rx\s?7[6-9]\d0|arc\s+(?:a750|a770|b580))\b/i,
  /\b(ryzen\s+[3579]|i[3579]\s*-\s*(?:1[1-9]|2\d)\d{3}|core\s+i[3579]|core\s+ultra)\b/i,
  /\b(b450|b550|b650|x570|x670|a520|h610|b660|b760|z690|z790|am4|am5|lga\s?1700)\b/i,
  /\b(ddr4|ddr5|(?:8|16|24|32|48|64|128)gb\s+ram|ram\s+(?:8|16|24|32|48|64|128)gb)\b/i,
  /\b(nvme|m\.2|pcie\s?[34]\.0|ssd\s+(?:240|250|256|480|500|512)gb|ssd\s+(?:1|2|4)tb|(?:1|2|4)tb\s+ssd)\b/i,
  /\b(80\s?plus|bronze|gold|platinum|(?:450|500|550|600|650|700|750|850|1000)w)\b/i,
  /\b(mesh|airflow|vidro\s+temperado|atx|micro\s*atx|mini\s*itx|aqu[aá]rio)\b/i,
  /\b(ips|va|oled|qled|4k|uhd|ultrawide|(?:75|100|120|144|165|180|240)hz|1ms)\b/i,
  /\b(mec[aâ]nico|magn[eé]tico|hall\s*effect|abnt2|switch|tkl)\b|(?:60|68|75|100)\s*%/i,
  /\b(dpi|paw\s?3395|hero|lightspeed|hot\s*swap|pwm|argb|120mm|140mm|heatpipe|screenbar|dock\s+station)\b/i,
  /\b(bra[cç]o\s+articulado|pegboard|painel\s+perfurado|suporte\s+para\s+(?:headset|notebook)|cabo(?:s)?\s+extensor(?:es)?\s+sleeved)\b/i,
];

export function isPcHardwareDeal(title: string): boolean {
  if (BLOCKED_TERMS.some((term) => term.test(title))) return false;
  return getHardwareQualityScore(title) >= 4;
}

export function getHardwareQualityScore(title: string): number {
  if (BLOCKED_TERMS.some((term) => term.test(title))) return -100;
  if (LOW_QUALITY_TERMS.some((term) => term.test(title))) return -50;

  const hardwareMatches = HARDWARE_TERMS.filter((term) => term.test(title)).length;
  if (hardwareMatches === 0) return 0;

  let score = Math.min(hardwareMatches * 2, 4);
  if (TRUSTED_BRANDS.some((term) => term.test(title))) score += 2;
  score += Math.min(QUALITY_SIGNALS.filter((term) => term.test(title)).length * 2, 6);

  if (isNotebook(title) && !isQualityNotebook(title)) return -20;
  if (isTv(title) && !QUALITY_TV_TERM.test(title)) return -20;

  return score;
}

function isNotebook(title: string): boolean {
  return /\b(notebook|laptop)\b/i.test(title);
}

function isQualityNotebook(title: string): boolean {
  return /(?=.*\b(?:ryzen\s+[3579]|i[3579]\s*-\s*(?:1[1-9]|2\d)\d{3}|core\s+i[3579]|core\s+ultra)\b)(?=.*\b(?:8|12|16|24|32|64)gb\s+ram\b)(?=.*\bssd\b).*$/i.test(title);
}

function isTv(title: string): boolean {
  return /\b(?:smart\s*(?:tv|v)|tv|televis[aã]o|televisor)\b/i.test(title);
}
