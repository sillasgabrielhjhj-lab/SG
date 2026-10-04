import { z } from "zod";
import { onlyDigits } from "@/lib/format";
import { optionalField, optionalText } from "@/lib/validators/common";

export const UFS = [
  { code: "AC", name: "Acre", region: "N" },
  { code: "AL", name: "Alagoas", region: "NE" },
  { code: "AP", name: "Amapá", region: "N" },
  { code: "AM", name: "Amazonas", region: "N" },
  { code: "BA", name: "Bahia", region: "NE" },
  { code: "CE", name: "Ceará", region: "NE" },
  { code: "DF", name: "Distrito Federal", region: "CO" },
  { code: "ES", name: "Espírito Santo", region: "SE" },
  { code: "GO", name: "Goiás", region: "CO" },
  { code: "MA", name: "Maranhão", region: "NE" },
  { code: "MT", name: "Mato Grosso", region: "CO" },
  { code: "MS", name: "Mato Grosso do Sul", region: "CO" },
  { code: "MG", name: "Minas Gerais", region: "SE" },
  { code: "PA", name: "Pará", region: "N" },
  { code: "PB", name: "Paraíba", region: "NE" },
  { code: "PR", name: "Paraná", region: "S" },
  { code: "PE", name: "Pernambuco", region: "NE" },
  { code: "PI", name: "Piauí", region: "NE" },
  { code: "RJ", name: "Rio de Janeiro", region: "SE" },
  { code: "RN", name: "Rio Grande do Norte", region: "NE" },
  { code: "RS", name: "Rio Grande do Sul", region: "S" },
  { code: "RO", name: "Rondônia", region: "N" },
  { code: "RR", name: "Roraima", region: "N" },
  { code: "SC", name: "Santa Catarina", region: "S" },
  { code: "SP", name: "São Paulo", region: "SE" },
  { code: "SE", name: "Sergipe", region: "NE" },
  { code: "TO", name: "Tocantins", region: "N" },
] as const;

export type UF = (typeof UFS)[number]["code"];
export type BrRegion = (typeof UFS)[number]["region"];
export const UF_CODES = UFS.map((u) => u.code) as [UF, ...UF[]];

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(cnpj[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export const isValidCep = (value: string) => /^\d{8}$/.test(onlyDigits(value)) && onlyDigits(value) !== "00000000";

/** Celular (11 dígitos, 9 após DDD) ou fixo (10 dígitos). DDD 11-99. */
export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

export function regionOfUf(uf: string): BrRegion | null {
  return UFS.find((u) => u.code === uf)?.region ?? null;
}

// ---------------------------------------------------------------------------
// Schemas Zod reutilizáveis (normalizam para apenas dígitos)
// ---------------------------------------------------------------------------

export const cpfSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine(isValidCpf, "CPF inválido");

export const cnpjSchema = z.string().trim().transform(onlyDigits).refine(isValidCnpj, "CNPJ inválido");

export const cpfOrCnpjSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((v) => (v.length === 11 ? isValidCpf(v) : isValidCnpj(v)), "CPF/CNPJ inválido");

export const cepSchema = z.string().trim().transform(onlyDigits).refine(isValidCep, "CEP inválido");

export const phoneSchema = z.string().trim().transform(onlyDigits).refine(isValidPhone, "Telefone inválido");

export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v): v is UF => (UF_CODES as string[]).includes(v), "UF inválida");

export const addressSchema = z.object({
  label: optionalText(40),
  recipientName: z.string().trim().min(3, "Informe o nome do destinatário").max(120),
  phone: optionalField(phoneSchema),
  cep: cepSchema,
  street: z.string().trim().min(2, "Informe o logradouro").max(160),
  number: z.string().trim().min(1, "Informe o número (ou S/N)").max(20),
  complement: optionalText(80),
  district: z.string().trim().min(2, "Informe o bairro").max(100),
  city: z.string().trim().min(2, "Informe a cidade").max(100),
  state: ufSchema,
  reference: optionalText(120),
});

export type AddressInput = z.infer<typeof addressSchema>;
