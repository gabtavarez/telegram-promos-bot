import { normalizeText } from "./categories.js";

/**
 * Marcas com presenca real no varejo brasileiro e historico de qualidade/garantia razoavel.
 * Quem nao esta aqui e tratado como "marca desconhecida" (nao e banido; so passa por regras mais duras).
 */
const KNOWN_BRANDS: Array<[brand: string, pattern: RegExp]> = [
  ["Asus", /\basus\b|\brog\b|\btuf\b/],
  ["Gigabyte", /\bgigabyte\b|\baorus\b/],
  ["MSI", /\bmsi\b/],
  ["ASRock", /\basrock\b/],
  ["Zotac", /\bzotac\b/],
  ["PNY", /\bpny\b/],
  ["Sapphire", /\bsapphire\b/],
  ["PowerColor", /\bpowercolor\b/],
  ["XFX", /\bxfx\b/],
  ["Galax", /\bgalax\b/],
  ["Biostar", /\bbiostar\b/],
  ["Intel", /\bintel\b/],
  ["AMD", /\bamd\b|\bryzen\b|\bradeon\b/],
  ["Nvidia", /\bnvidia\b|\bgeforce\b/],
  ["Kingston", /\bkingston\b|\bfury\b/],
  ["Corsair", /\bcorsair\b/],
  ["Crucial", /\bcrucial\b/],
  ["Samsung", /\bsamsung\b/],
  ["WD", /\bwestern\s+digital\b|\bwd\b|\bwd_black\b/],
  ["SanDisk", /\bsandisk\b/],
  ["Lexar", /\blexar\b/],
  ["XPG", /\bxpg\b|\badata\b/],
  ["TeamGroup", /\bteam\s?group\b|\bt-force\b/],
  ["Seagate", /\bseagate\b/],
  ["Netac", /\bnetac\b/],
  ["Cooler Master", /\bcooler\s+master\b/],
  ["Seasonic", /\bseasonic\b/],
  ["Super Flower", /\bsuper\s+flower\b/],
  ["DeepCool", /\bdeepcool\b/],
  ["NZXT", /\bnzxt\b/],
  ["Thermaltake", /\bthermaltake\b/],
  ["Thermalright", /\bthermalright\b/],
  ["Montech", /\bmontech\b/],
  ["Lian Li", /\blian\s?li\b/],
  ["Phanteks", /\bphanteks\b/],
  ["Jonsbo", /\bjonsbo\b/],
  ["ID-Cooling", /\bid-?cooling\b/],
  ["Arctic", /\barctic\b/],
  ["Noctua", /\bnoctua\b/],
  ["Gamemax", /\bgamemax\b/],
  ["Pichau", /\bpichau\b/],
  ["Redragon", /\bredragon\b/],
  ["Logitech", /\blogitech\b/],
  ["Razer", /\brazer\b/],
  ["HyperX", /\bhyperx\b/],
  ["SteelSeries", /\bsteelseries\b/],
  ["Havit", /\bhavit\b/],
  ["Attack Shark", /\battack\s?shark\b|\batk\b/],
  ["Ajazz", /\bajazz\b/],
  ["Aula", /\baula\b/],
  ["Akko", /\bakko\b|\bmonsgeek\b/],
  ["Keychron", /\bkeychron\b/],
  ["Machenike", /\bmachenike\b/],
  ["Royal Kludge", /\broyal\s+kludge\b|\brk\s?\d{2}\b/],
  ["Darmoshark", /\bdarmoshark\b/],
  ["Glorious", /\bglorious\b/],
  ["Wooting", /\bwooting\b/],
  ["Zowie", /\bzowie\b/],
  ["Fifine", /\bfifine\b/],
  ["Maono", /\bmaono\b/],
  ["Edifier", /\bedifier\b/],
  ["JBL", /\bjbl\b/],
  ["Anker", /\banker\b/],
  ["Baseus", /\bbaseus\b/],
  ["Xiaomi", /\bxiaomi\b/],
  ["Dunu", /\bdunu\b/],
  ["KZ", /\bkz\b/],
  ["LG", /\blg\b/],
  ["AOC", /\baoc\b/],
  ["Acer", /\bacer\b/],
  ["Dell", /\bdell\b/],
  ["BenQ", /\bbenq\b/],
  ["Philips", /\bphilips\b/],
  ["TCL", /\btcl\b/],
  ["Hisense", /\bhisense\b/],
  ["Lenovo", /\blenovo\b/],
  ["HP", /\bhp\b/],
  ["Apple", /\bapple\b|\biphone\b|\bmacbook\b/],
  ["Gamdias", /\bgamdias\b/],
  ["ThunderX3", /\bthunderx3\b/],
  ["DT3", /\bdt3\b/],
  ["Husky", /\bhusky\b/],
  ["Elg", /\belg\b/],
  ["Fortrek", /\bfortrek\b/],
  ["Rise Mode", /\brise\s+mode\b/],
  ["Evolut", /\bevolut\b/],
  ["Dazz", /\bdazz\b/],
  ["Multilaser", /\bmultilaser\b/],
  ["Sades", /\bsades\b/],
  ["Onikuma", /\bonikuma\b/],
  ["Fantech", /\bfantech\b/],
  ["Hikvision", /\bhikvision\b/],
];

export interface BrandInfo {
  /** Nome canonico quando a marca e conhecida. */
  brand?: string;
  known: boolean;
}

export function detectBrand(title: string): BrandInfo {
  const t = normalizeText(title);
  const hit = KNOWN_BRANDS.find(([, pattern]) => pattern.test(t));
  return hit ? { brand: hit[0], known: true } : { known: false };
}

/** Compara a marca detectada com uma lista livre digitada pelo usuario no painel. */
export function brandMatches(title: string, list: string[]): boolean {
  if (list.length === 0) return false;
  const t = normalizeText(title);
  return list.some((entry) => {
    const word = normalizeText(entry);
    return word.length > 0 && new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(word)}(?:$|[^a-z0-9])`).test(t);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
