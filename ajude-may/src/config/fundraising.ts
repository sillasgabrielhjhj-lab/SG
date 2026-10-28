/**
 * ✏️ META DE ARRECADAÇÃO — único lugar para atualizar os valores.
 *
 * A porcentagem, o valor restante, a barra de progresso e as mensagens são calculados sozinhos, na
 * página inicial e na página de doação. Valores em reais, sem aspas, sem "R$" e sem ponto de milhar:
 * 16000 = R$ 16.000,00 (centavos com ponto: 16000.5 = R$ 16.000,50). `null` = ainda não informado.
 * Alternativa: variáveis FUNDRAISING_RAISED, FUNDRAISING_GOAL e FUNDRAISING_UPDATED_AT na Vercel.
 *
 * REGRA DE OURO: `valorArrecadado` só muda com doações EFETIVAMENTE CONFIRMADAS no extrato ou no
 * app do banco. Gerar o QR Code ou copiar o código Pix NUNCA altera o total. Para uma integração
 * bancária futura, veja getFundraising() em src/lib/fundraising/index.ts.
 */
export const fundraising = {
  /** Valor efetivamente arrecadado, em reais. */
  valorArrecadado: 16000 as number | null,
  /** Meta total, em reais. */
  metaArrecadacao: 30000 as number | null,
  /** Opcional: data da última conferência, no formato AAAA-MM-DD (ex.: "2026-11-05"). */
  atualizadoEm: "",
};
