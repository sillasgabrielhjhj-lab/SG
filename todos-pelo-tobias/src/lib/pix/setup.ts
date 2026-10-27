export interface PixConfig {
  key: string;
  receiverName: string;
  receiverCity: string;
  description: string;
}

export type PixSetup =
  | {
      status: "ready";
      key: string;
      receiverName: string;
      receiverCity: string;
      description: string;
      /** true = nome/cidade fictícios, só no `npm run dev`. Nunca acontece em produção. */
      isPlaceholder: boolean;
    }
  | { status: "missing"; missing: ("receiverName" | "receiverCity")[] };

/**
 * Decide se o Pix pode ser gerado. Em produção, sem nome e cidade reais do recebedor o QR Code
 * NÃO é exibido (nunca inventamos dados do beneficiário). Em desenvolvimento usamos um texto
 * provisório visível, só para você ver o fluxo funcionando.
 */
export function resolvePixSetup(config: PixConfig, nodeEnv: string | undefined): PixSetup {
  const receiverName = config.receiverName.trim();
  const receiverCity = config.receiverCity.trim();
  const base = { key: config.key, description: config.description };

  if (receiverName && receiverCity) {
    return { status: "ready", ...base, receiverName, receiverCity, isPlaceholder: false };
  }
  if (nodeEnv === "development") {
    return {
      status: "ready",
      ...base,
      receiverName: receiverName || "NOME DO RECEBEDOR",
      receiverCity: receiverCity || "CIDADE",
      isPlaceholder: true,
    };
  }
  const missing: ("receiverName" | "receiverCity")[] = [];
  if (!receiverName) missing.push("receiverName");
  if (!receiverCity) missing.push("receiverCity");
  return { status: "missing", missing };
}
