import { crc16 } from "./crc16";

/**
 * Gerador de BR Code estático do Pix (EMV® QRCPS Merchant-Presented Mode), conforme o
 * "Manual de Padrões para Iniciação do Pix" do Banco Central. Roda 100% no navegador/servidor,
 * sem gateway e sem dependências: o mesmo texto vira QR Code e "Pix Copia e Cola".
 */

export type PixKeyType = "email" | "phone" | "cpf" | "cnpj" | "random";

export type PixErrorCode =
  | "invalid_key"
  | "invalid_name"
  | "invalid_city"
  | "invalid_amount"
  | "invalid_txid"
  | "field_too_long";

export class PixError extends Error {
  readonly code: PixErrorCode;

  constructor(code: PixErrorCode, message: string) {
    super(message);
    this.name = "PixError";
    this.code = code;
  }
}

export interface StaticPixInput {
  /** Chave Pix do recebedor: e-mail, telefone (+55…), CPF, CNPJ ou chave aleatória. */
  key: string;
  /** Nome do recebedor (até 25 caracteres; acentos e símbolos são removidos). */
  receiverName: string;
  /** Cidade do recebedor (até 15 caracteres; acentos e símbolos são removidos). */
  receiverCity: string;
  /** Valor em centavos. Omitido: o pagador digita o valor no app do banco. */
  amountCents?: number;
  /** Mensagem exibida ao pagador (opcional, até 40 caracteres). */
  description?: string;
  /** Identificador da transação (1–25 letras/números). Padrão "***" = sem identificador. */
  txid?: string;
}

const MAX_NAME = 25;
const MAX_CITY = 15;
const MAX_DESCRIPTION = 40;
/** O campo 54 aceita no máximo 13 caracteres: "9999999999.99". */
const MAX_AMOUNT_CENTS = 999_999_999_999;

const KEY_PATTERNS: Record<PixKeyType, RegExp> = {
  email: /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/,
  phone: /^\+55\d{10,11}$/,
  cpf: /^\d{11}$/,
  cnpj: /^\d{14}$/,
  random: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
};

/** E-mails e chaves aleatórias são case-insensitive no DICT; usamos minúsculas. */
export function normalizePixKey(key: string): string {
  const trimmed = key.trim();
  return trimmed.includes("@") || /^[0-9a-f-]{36}$/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

export function detectPixKeyType(key: string): PixKeyType | null {
  const normalized = normalizePixKey(key);
  for (const type of Object.keys(KEY_PATTERNS) as PixKeyType[]) {
    if (KEY_PATTERNS[type].test(normalized)) return type;
  }
  return null;
}

/** Remove acentos e símbolos, deixa em MAIÚSCULAS e corta no tamanho máximo do campo. */
export function sanitizeText(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
    .trim();
}

/** Centavos -> "50.00" (ponto decimal, sempre 2 casas), sem passar por ponto flutuante. */
export function formatPixAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 1 || cents > MAX_AMOUNT_CENTS) {
    throw new PixError("invalid_amount", "O valor do Pix deve ser maior que zero.");
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Monta um campo EMV: ID (2 dígitos) + tamanho (2 dígitos) + valor. */
function field(id: string, value: string): string {
  if (value.length > 99) {
    throw new PixError("field_too_long", `O campo ${id} do Pix excede 99 caracteres.`);
  }
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function buildStaticPix(input: StaticPixInput): string {
  const key = normalizePixKey(input.key);
  if (!detectPixKeyType(key)) {
    throw new PixError("invalid_key", "A chave Pix informada não é válida.");
  }

  const name = sanitizeText(input.receiverName, MAX_NAME);
  if (!name) throw new PixError("invalid_name", "Informe o nome do recebedor.");

  const city = sanitizeText(input.receiverCity, MAX_CITY);
  if (!city) throw new PixError("invalid_city", "Informe a cidade do recebedor.");

  const txid = input.txid ?? "***";
  if (txid !== "***" && !/^[A-Za-z0-9]{1,25}$/.test(txid)) {
    throw new PixError("invalid_txid", "O identificador da transação é inválido.");
  }

  const description = input.description ? sanitizeText(input.description, MAX_DESCRIPTION) : "";

  const merchantAccount =
    field("00", "br.gov.bcb.pix") + field("01", key) + (description ? field("02", description) : "");

  const payload =
    field("00", "01") + // versão do payload
    field("01", "11") + // QR estático (reutilizável)
    field("26", merchantAccount) + // conta do recebedor no Pix
    field("52", "0000") + // categoria do estabelecimento
    field("53", "986") + // moeda: BRL
    (input.amountCents === undefined ? "" : field("54", formatPixAmount(input.amountCents))) +
    field("58", "BR") +
    field("59", name) +
    field("60", city) +
    field("62", field("05", txid)) +
    "6304"; // ID + tamanho do CRC; os 4 dígitos do CRC são calculados sobre tudo até aqui

  return payload + crc16(payload);
}
