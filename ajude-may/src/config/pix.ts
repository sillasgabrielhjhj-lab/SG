import "server-only";
import { resolvePixSetup } from "@/lib/pix/setup";
import { campaign } from "./campaign";

/**
 * ✏️ PIX OFICIAL DA CAMPANHA DA MAY
 *
 * Preencha entre as aspas OU cadastre variáveis de ambiente com estes mesmos nomes na Vercel
 * (Settings › Environment Variables). A variável de ambiente, quando existe, tem prioridade.
 *
 * - PIX_KEY: a chave Pix oficial (e-mail, CPF, CNPJ, chave aleatória ou telefone +55DDDNÚMERO).
 *   Enquanto estiver vazia, a página /doar mostra "doações por Pix em breve" e não gera QR Code.
 * - PIX_RECEIVER_NAME / PIX_RECEIVER_CITY: nome e cidade do titular da chave, como no banco.
 *   Opcionais, mas recomendados: o nome aparece no site para o doador conferir antes de pagar.
 *
 * Este arquivo só roda no servidor (as variáveis não têm o prefixo NEXT_PUBLIC_).
 */
export const PIX_KEY = process.env.PIX_KEY || "";
export const PIX_RECEIVER_NAME = process.env.PIX_RECEIVER_NAME || "";
export const PIX_RECEIVER_CITY = process.env.PIX_RECEIVER_CITY || "";

/** `null` enquanto a chave não for configurada. */
export const pixSetup = resolvePixSetup(
  {
    key: PIX_KEY,
    receiverName: PIX_RECEIVER_NAME,
    receiverCity: PIX_RECEIVER_CITY,
    description: campaign.shortName,
  },
  campaign.shortName,
);
