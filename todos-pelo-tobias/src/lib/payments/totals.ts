import type { CampaignTotals } from "./types";

/**
 * Ponto de integração para exibir valores arrecadados. Hoje devolve `null` (nada é exibido), pois
 * o Pix estático não informa pagamentos. Ao integrar uma API Pix, consulte o saldo/webhook aqui e
 * devolva apenas valores realmente recebidos; a interface já exibe o total quando existir.
 */
export async function getCampaignTotals(): Promise<CampaignTotals | null> {
  return null;
}
