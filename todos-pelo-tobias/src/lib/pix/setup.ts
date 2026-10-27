export interface PixConfig {
  key: string;
  description: string;
  /** Opcional. Se vazio, o site não exibe "Recebedor" e o código Pix usa um valor neutro. */
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
 * Funciona só com a chave Pix. O padrão do Banco Central exige nome e cidade dentro do código, mas
 * o app do banco identifica o recebedor pela chave; por isso, sem nome/cidade informados, usamos o
 * nome da campanha e "BRASIL" (valores neutros, que não afirmam nada sobre o beneficiário) e a tela
 * não exibe "Recebedor".
 */
export function resolvePixSetup(config: PixConfig, fallbackName: string): PixSetup {
  const name = config.receiverName.trim();
  const city = config.receiverCity.trim();
  return {
    key: config.key,
    description: config.description,
    payloadName: name || fallbackName,
    payloadCity: city || DEFAULT_PAYLOAD_CITY,
    ...(name ? { receiver: { name, ...(city ? { city } : {}) } } : {}),
  };
}
