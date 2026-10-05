import { parseBrlPrice } from "./price.js";

export interface PaymentDetails {
  pixPrice?: number;
  cardPrice?: number;
  installmentText?: string;
}

/**
 * Extrai somente condicoes explicitamente rotuladas pela loja. Um preco comum
 * nunca e transformado em preco Pix por inferencia.
 */
export function extractPaymentDetails(text?: string | null): PaymentDetails {
  if (!text) return {};
  const normalized = text.replace(/\s+/g, " ").trim();
  const money = "R\\$\\s*[\\d.]+(?:,\\d{2})?";

  const pixMatch = normalized.match(new RegExp(`(${money})\\s*(?:no|via)\\s+pix`, "i"))
    ?? normalized.match(new RegExp(`(?:no|via)\\s+pix.{0,30}?(${money})`, "i"));
  const cardMatch = normalized.match(new RegExp(`(${money})\\s*(?:no|via)\\s+(?:cart[aã]o|cr[eé]dito)`, "i"))
    ?? normalized.match(new RegExp(`(?:no|via)\\s+(?:cart[aã]o|cr[eé]dito).{0,30}?(${money})`, "i"));
  const installmentMatch = normalized.match(
    new RegExp(`(?:em\\s+at[eé]\\s+)?(\\d{1,2})x\\s*(?:de\\s*)?(${money})(?:\\s*sem\\s+juros)?`, "i"),
  );

  const pixPrice = parseBrlPrice(pixMatch?.[1]);
  let cardPrice = parseBrlPrice(cardMatch?.[1]);
  let installmentText: string | undefined;
  if (installmentMatch) {
    const installments = Number(installmentMatch[1]);
    const installmentValue = parseBrlPrice(installmentMatch[2]);
    if (installments > 0 && installmentValue) {
      installmentText = `em até ${installments}x de ${formatCurrency(installmentValue)}`;
    }
  }

  return { pixPrice, cardPrice, installmentText };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
