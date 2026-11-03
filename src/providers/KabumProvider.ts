import { createGunzip, gunzipSync } from "node:zlib";
import { Readable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import axios, { type AxiosInstance } from "axios";
import type { Deal } from "../types/Deal.js";
import { isPcHardwareDeal } from "../utils/hardwareFilter.js";
import { calculateDiscount, parseBrlPrice } from "../utils/price.js";
import { extractPaymentDetails } from "../utils/payment.js";
import type { AffiliateProvider } from "./AffiliateProvider.js";

interface KabumConfig {
  publisherId: string;
  advertiserId: string;
  accessToken?: string;
  feedUrl?: string;
  locale: string;
}

interface AwinFeedProduct {
  id?: string | number;
  title?: string;
  link?: string;
  destination_link?: string;
  image_link?: string;
  price?: string | number;
  sale_price?: string | number;
  availability?: string;
  condition?: string;
  payment_text?: string;
  old_price?: string | number;
  saving?: string | number;
  savings_percent?: string | number;
  is_for_sale?: string;
  rating?: string | number;
  reviews?: string | number;
}

type AwinFeedRecord = Record<string, unknown> & {
  error?: number | string;
  message?: string;
};

interface KabumFeedStats {
  records: number;
  withRequiredFields: number;
  blockedUnavailable: number;
  blockedUsed: number;
  blockedFilter: number;
}

export class KabumProvider implements AffiliateProvider {
  readonly name = "Kabum";
  private readonly client: AxiosInstance;
  private feedSource = "automatico";
  private feedHeader: string[] = [];
  private lastError?: string;

  constructor(private readonly config: KabumConfig) {
    this.client = axios.create({
      baseURL: "https://api.awin.com",
      timeout: 30_000,
      maxContentLength: 50 * 1024 * 1024,
      headers: config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : undefined,
    });
  }

  async getDeals(): Promise<Deal[]> {
    try {
      const records = await this.fetchFeedRecords();
      const columns = this.feedHeader.length ? this.feedHeader : records[0] ? Object.keys(records[0]) : [];
      if (columns.length) {
        console.log(`Kabum/Awin (${this.feedSource}): colunas do feed: ${columns.join(", ")}`);
      }
      const stats: KabumFeedStats = {
        records: records.length,
        withRequiredFields: 0,
        blockedUnavailable: 0,
        blockedUsed: 0,
        blockedFilter: 0,
      };
      const trustedStock = stockColumnsTrusted(records);
      const deals = records.flatMap((record): Deal[] => {
        if (record.error) throw new Error(record.message ?? `Awin feed error ${record.error}`);

        const product = flattenProduct(record);
        const id = product.id;
        const title = normalizeText(product.title);
        const originalUrl = normalizeUrl(product.link);
        const imageUrl = normalizeUrl(product.image_link);
        const regularPrice = parseFeedPrice(product.price);
        const salePrice = parseFeedPrice(product.sale_price);
        const payment = extractPaymentDetails(product.payment_text);
        const listedPrice = salePrice && regularPrice && salePrice < regularPrice ? salePrice : regularPrice;
        const currentPrice = payment.pixPrice ?? listedPrice;
        const previousPrice = pickPreviousPrice(listedPrice, regularPrice, salePrice, product);

        if (!id || !title || !originalUrl || !imageUrl || !currentPrice) return [];
        stats.withRequiredFields += 1;
        if (isUnavailable(product.availability) || isOutOfStock(product, trustedStock)) {
          stats.blockedUnavailable += 1;
          return [];
        }
        if (isUsed(product.condition)) {
          stats.blockedUsed += 1;
          return [];
        }
        if (!isPcHardwareDeal(title)) {
          stats.blockedFilter += 1;
          return [];
        }

        return [{
          id: `kabum:${id}`,
          provider: "kabum",
          title,
          originalUrl,
          displayUrl: getDisplayUrl(product.destination_link ?? product.link),
          imageUrl,
          currentPrice,
          pixPrice: payment.pixPrice,
          cardPrice: payment.cardPrice ?? (
            payment.pixPrice && listedPrice && listedPrice > payment.pixPrice ? listedPrice : undefined
          ),
          installmentText: payment.installmentText,
          previousPrice,
          discountPercentage: calculateDiscount(currentPrice, previousPrice),
          rating: parseRating(product.rating),
          sales: parseCount(product.reviews),
        }];
      });

      const uniqueDeals = [...new Map(deals.map((deal) => [deal.id, deal])).values()];
      this.lastError = undefined;
      logPriceColumnCoverage(records);
      console.log(
        `Kabum/Awin (${this.feedSource}): ${stats.records} registro(s); ` +
          `${stats.withRequiredFields} com campos minimos; ` +
          `${stats.blockedUnavailable} indisponivel(is); ` +
          `${stats.blockedUsed} usado(s)/recondicionado(s); ` +
          `${stats.blockedFilter} bloqueado(s) pelo filtro; ` +
          `${uniqueDeals.length} aprovado(s).`,
      );
      return uniqueDeals;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `${error.response?.status ?? error.code ?? "HTTP_ERROR"}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
      console.error(`Falha na API de produtos da Kabum/Awin (${this.feedSource}): ${message}`);
      this.lastError = message;
      return [];
    }
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  private async fetchFeedRecords(): Promise<AwinFeedRecord[]> {
    if (this.config.feedUrl) {
      this.feedSource = "feed manual";
      try {
        // Streaming: o feed completo da KaBuM (milhares de itens x ~90 colunas) estoura a memoria
        // de 512 MB se for baixado e convertido de uma vez. Guardamos so as colunas usadas.
        const { data } = await this.client.get<Readable>(this.config.feedUrl, { responseType: "stream" });
        const { header, records } = await streamCsvFeed(data);
        this.feedHeader = header;
        return records;
      } catch (error) {
        if (!this.config.accessToken) throw error;
        const message = axios.isAxiosError(error)
          ? `${error.response?.status ?? error.code ?? "HTTP_ERROR"}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
        console.warn(`Feed manual da Kabum/Awin falhou; tentando feed automatico. Motivo: ${message}`);
      }
    }

    this.feedSource = "feed automatico";
    const path = `/publishers/${this.config.publisherId}/awinfeeds/download/${this.config.advertiserId}-retail-${this.config.locale}.jsonl`;
    const { data } = await this.client.get<string>(path, { responseType: "text" });
    return parseJsonLines(data);
  }
}

/** Colunas do feed que o bot usa; o resto (specs, imagens extras, custom_*) e descartado na leitura. */
const KEEP_COLUMNS = new Set([
  "aw_deep_link", "product_name", "aw_product_id", "merchant_product_id", "merchant_image_url", "aw_image_url",
  "large_image", "description", "product_short_description", "promotional_text", "search_price", "store_price",
  "display_price", "merchant_deep_link", "condition", "brand_name", "product_price_old", "rrp_price", "saving",
  "savings_percent", "in_stock", "stock_status", "is_for_sale", "average_rating", "rating", "reviews",
  "deep_link", "deeplink", "link", "product_url", "url", "title", "name", "price", "sale_price", "availability",
  "image_link", "image_url", "product_id", "id",
]);
const MAX_TEXT_LENGTH = 1_500;

export async function streamCsvFeed(stream: AsyncIterable<Buffer | string>): Promise<{ header: string[]; records: AwinFeedRecord[] }> {
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) return { header: [], records: [] };
  const head = Buffer.isBuffer(first.value) ? first.value : Buffer.from(first.value);
  async function* raw(): AsyncGenerator<Buffer> {
    yield head;
    for (;;) {
      const next = await iterator.next();
      if (next.done) return;
      yield Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
    }
  }
  const source: AsyncIterable<Buffer> = isGzip(head) ? Readable.from(raw()).pipe(createGunzip()) : raw();

  const decoder = new StringDecoder("utf8");
  const records: AwinFeedRecord[] = [];
  let header: string[] | undefined;
  let keep: Array<[number, string]> = [];
  let delimiter: string | undefined;
  let pending = "";
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let started = false;

  const pushRow = () => {
    row.push(field);
    field = "";
    if (!header) {
      header = row.map((column, index) => (index === 0 ? column.replace(/^\uFEFF/, "") : column)).map(normalizeColumn);
      keep = header.flatMap((column, index): Array<[number, string]> => (KEEP_COLUMNS.has(column) ? [[index, column]] : []));
    } else if (row.some((value) => value.trim())) {
      const record: AwinFeedRecord = {};
      for (const [index, column] of keep) {
        const value = row[index]?.trim() ?? "";
        record[column] = value.length > MAX_TEXT_LENGTH ? value.slice(0, MAX_TEXT_LENGTH) : value;
      }
      records.push(record);
    }
    row = [];
  };

  const consume = (text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === "\"") {
        if (quoted && text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else if (quoted && index === text.length - 1) {
          // Aspas no fim do bloco: decide no proximo bloco se e escape ("") ou fechamento.
          pending = "\"";
          return;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (char === delimiter && !quoted) {
        row.push(field);
        field = "";
        continue;
      }
      if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        pushRow();
        continue;
      }
      field += char;
    }
  };

  for await (const chunk of source) {
    let text = pending + decoder.write(chunk);
    pending = "";
    if (!started) {
      // Detecta o delimitador pela primeira linha.
      const newline = text.search(/\r?\n/);
      if (newline < 0) { pending = text; continue; }
      delimiter = detectCsvDelimiter(text.slice(0, newline));
      started = true;
    }
    consume(text);
  }
  const tail = pending + decoder.end();
  if (!started && tail) delimiter = detectCsvDelimiter(tail.split(/\r?\n/, 1)[0] ?? "");
  if (tail) { started = true; consume(tail); }
  if (pending === "\"") { quoted = !quoted; pending = ""; }
  if (field || row.length) pushRow();
  return { header: header ?? [], records };
}

function decodeFeedData(data: ArrayBuffer | Buffer | string): string {
  if (typeof data === "string") return data;
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = isGzip(buffer) ? gunzipSync(buffer) : buffer;
  return content.toString("utf8");
}

function isGzip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function parseJsonLines(data: string): AwinFeedRecord[] {
  return data
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AwinFeedRecord);
}

function flattenProduct(record: AwinFeedRecord): AwinFeedProduct {
  const sections = Object.values(record).filter(isRecord);
  const flat = Object.assign({}, ...sections, record) as Record<string, unknown>;
  return {
    id: pickValue(flat, "aw_product_id", "merchant_product_id", "product_id", "id"),
    title: pickValue(flat, "product_name", "title", "name", "nome"),
    link: pickValue(flat, "aw_deep_link", "deep_link", "deeplink", "link", "merchant_deep_link", "product_url", "url"),
    destination_link: pickValue(flat, "merchant_deep_link", "product_url", "url", "deep_link"),
    image_link: pickValue(flat, "merchant_image_url", "aw_image_url", "image_link", "image_url", "large_image", "picture_url"),
    price: pickValue(flat, "search_price", "display_price", "store_price", "price", "product_price", "sale_price"),
    sale_price: pickValue(flat, "store_price", "sale_price"),
    availability: pickValue(flat, "in_stock", "stock_status", "availability"),
    condition: pickValue(flat, "condition"),
    old_price: pickValue(flat, "product_price_old", "rrp_price", "old_price", "price_old"),
    saving: pickValue(flat, "saving"),
    savings_percent: pickValue(flat, "savings_percent"),
    is_for_sale: pickValue(flat, "is_for_sale"),
    rating: pickValue(flat, "average_rating", "rating"),
    reviews: pickValue(flat, "reviews"),
    payment_text: [
      pickValue(flat, "display_price"),
      pickValue(flat, "promotional_text"),
      pickValue(flat, "description"),
      pickValue(flat, "product_short_description"),
    ].filter((value): value is string => value !== undefined).join(" "),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFeedPrice(value?: string | number): number | undefined {
  return value === undefined ? undefined : parseBrlPrice(String(value));
}

function parseCsvFeed(data: string): AwinFeedRecord[] {
  const cleaned = data.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(cleaned);
  const rows = parseCsvRows(cleaned, delimiter);
  const [header, ...records] = rows;
  if (!header) return [];

  return records
    .filter((row) => row.some((value) => value.trim()))
    .map((row) =>
      Object.fromEntries(header.map((column, index) => [normalizeColumn(column), row[index]?.trim() ?? ""])) as AwinFeedRecord,
    );
}

function detectCsvDelimiter(data: string): string {
  const firstLine = data.split(/\r?\n/, 1)[0] ?? "";
  const delimiters = [",", ";", "|", "\t"];
  return delimiters.reduce((best, delimiter) =>
    countOccurrences(firstLine, delimiter) > countOccurrences(firstLine, best) ? delimiter : best,
  ",");
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function parseCsvRows(data: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < data.length; index += 1) {
    const char = data[index];
    const next = data[index + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function pickValue(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function normalizeColumn(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeText(value?: string): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getDisplayUrl(value?: string): string | undefined {
  const url = normalizeUrl(value);
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const destination = parsed.searchParams.get("ued") ?? parsed.searchParams.get("p");
    const cleanUrl = destination ? new URL(destination) : parsed;
    cleanUrl.search = "";
    cleanUrl.hash = "";
    return cleanUrl.toString();
  } catch {
    return undefined;
  }
}

/**
 * Preco "de" verificado pela loja: coluna de preco antigo/sugerido do feed, ou preco cheio vs. promocional.
 * Ignora valores absurdos (mais de 4x o atual) e diferencas menores que 3%, comuns em feed desatualizado.
 */
export function pickPreviousPrice(
  current: number | undefined,
  regular: number | undefined,
  sale: number | undefined,
  product: Pick<AwinFeedProduct, "old_price" | "saving" | "savings_percent">,
): number | undefined {
  if (!current) return undefined;
  const fromSaving = (() => {
    const saving = parseFeedPrice(product.saving);
    if (saving && saving > 0) return current + saving;
    const percent = Number(String(product.savings_percent ?? "").replace(",", ".").replace("%", ""));
    if (Number.isFinite(percent) && percent > 0 && percent < 90) return current / (1 - percent / 100);
    return undefined;
  })();
  const candidates = [
    parseFeedPrice(product.old_price),
    sale && regular && sale < regular ? regular : undefined,
    fromSaving,
  ].filter((value): value is number => value !== undefined && value > current * 1.03 && value <= current * 4);
  if (!candidates.length) return undefined;
  return Math.round(Math.max(...candidates) * 100) / 100;
}

const NO_VALUE = /^(0|false|no|n|nao|não)$/i;
const YES_VALUE = /^(1|true|yes|y|sim)$/i;

/**
 * So confia nas colunas de estoque quando o feed realmente as usa (ha ao menos um item marcado como
 * em estoque); feeds que deixam tudo "0" por padrao nao derrubam o catalogo inteiro.
 */
export function stockColumnsTrusted(records: AwinFeedRecord[]): { inStock: boolean; forSale: boolean } {
  const has = (column: string) => records.some((record) => YES_VALUE.test(String(record[column] ?? "").trim()));
  return { inStock: has("in_stock"), forSale: has("is_for_sale") };
}

function isOutOfStock(product: AwinFeedProduct, trusted: { inStock: boolean; forSale: boolean }): boolean {
  if (trusted.inStock && NO_VALUE.test(String(product.availability ?? "").trim())) return true;
  return trusted.forSale && NO_VALUE.test(String(product.is_for_sale ?? "").trim());
}

function parseRating(value?: string | number): number | undefined {
  const rating = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(rating) || rating <= 0) return undefined;
  // Alguns feeds usam escala 0-10 ou 0-100.
  const normalized = rating > 10 ? rating / 20 : rating > 5 ? rating / 2 : rating;
  return Math.round(normalized * 10) / 10;
}

function parseCount(value?: string | number): number | undefined {
  const count = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

function logPriceColumnCoverage(records: AwinFeedRecord[]): void {
  const columns = ["product_price_old", "rrp_price", "saving", "savings_percent", "store_price", "in_stock", "stock_quantity", "brand_name", "average_rating", "reviews"];
  const coverage = columns
    .filter((column) => records[0] && column in records[0])
    .map((column) => `${column}=${records.filter((record) => String(record[column] ?? "").trim() && String(record[column]).trim() !== "0").length}`);
  if (coverage.length) console.log(`Kabum/Awin: colunas preenchidas: ${coverage.join(", ")}`);
}

function isUnavailable(value?: string): boolean {
  return Boolean(value && /out[_\s-]*of[_\s-]*stock|indispon[ií]vel/i.test(value));
}

function isUsed(value?: string): boolean {
  return Boolean(value && /used|refurbished|recondicionado|usado/i.test(value));
}
