import { detectPixKeyType, normalizePixKey } from "./brcode";

export interface PixConfig {
  key: string;
  description: string;
  /** Opcional. Se vazio, o site não exibe o nome e o código Pix usa um valor neutro. */
  receiverName: string;
  /** Opcional. Se vazia, o código Pix usa "BRASIL". */
  receiverCity: string;
}

export interface PixSetup {
  key: string;
  description: string;
  /** Conteúdo dos campos "nome" e "cidade" do BR Code (o padrão do Banco Central os exige). */
  payloadName: string;
  payloadCity: string;
  /** Só existe se o nome do recebedor foi informado; nesse caso o site o exibe para conferência. */
  receiver?: { name: string; city?: string };
}

/** Cidade usada no código Pix quando você não informa uma. */
export const DEFAULT_PAYLOAD_CITY = "BRASIL";

/**
 * Sem chave Pix configurada devolve `null`: o site mostra "doações por Pix em breve" e NUNCA gera um
 * QR Code de exemplo. Chave preenchida mas inválida interrompe o build com uma mensagem clara, para
 * não publicar um Pix que não funciona.
 *
 * O padrão do Banco Central exige nome e cidade dentro do código, mas o app do banco identifica o
 * recebedor pela chave; sem nome/cidade informados usamos o nome da campanha e "BRASIL".
 */
export function resolvePixSetup(config: PixConfig, fallbackName: string): PixSetup | null {
  const raw = config.key.trim();
  if (!raw) return null;
  const key = normalizePixKey(raw);
  if (!detectPixKeyType(key)) {
    throw new Error(
      `PIX_KEY inválida ("${raw}"). Use o e-mail, CPF, CNPJ, chave aleatória ou telefone no formato +55DDDNÚMERO (ex.: +5511999999999), exatamente como cadastrado no banco.`,
    );
  }
  const name = config.receiverName.trim();
  const city = config.receiverCity.trim();
  return {
    key,
    description: config.description,
    payloadName: name || fallbackName,
    payloadCity: city || DEFAULT_PAYLOAD_CITY,
    ...(name ? { receiver: { name, ...(city ? { city } : {}) } } : {}),
  };
}
