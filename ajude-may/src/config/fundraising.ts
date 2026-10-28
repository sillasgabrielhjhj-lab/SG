/**
 * ✏️ META DE ARRECADAÇÃO
 *
 * Único lugar para atualizar a meta. A porcentagem, o valor restante e a barra são calculados
 * automaticamente. Valores em reais, sem aspas, sem "R$" e sem ponto de milhar: 15000 = R$ 15.000,00
 * (centavos com ponto: 15000.5 = R$ 15.000,50).
 *
 * Enquanto `goal` e `raised` forem `null`, o site mostra apenas o objetivo da campanha e o botão de
 * doação, SEM nenhum número. Também é possível usar as variáveis de ambiente FUNDRAISING_GOAL,
 * FUNDRAISING_RAISED e FUNDRAISING_UPDATED_AT (têm prioridade sobre este arquivo).
 *
 * REGRA DE OURO: `raised` só deve mudar com base em doações EFETIVAMENTE CONFIRMADAS no extrato ou
 * no app do banco. Gerar o QR Code ou copiar o código Pix NUNCA altera o total.
 */
export const fundraising = {
  /** Meta total, em reais. `null` = ainda não definida. */
  goal: null as number | null,
  /** Valor efetivamente arrecadado, em reais. `null` = ainda não informado. */
  raised: null as number | null,
  /** Opcional: data da última conferência, no formato AAAA-MM-DD (ex.: "2026-11-05"). */
  updatedAt: "",
};
