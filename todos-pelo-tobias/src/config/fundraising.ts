/**
 * ✏️ META DE ARRECADAÇÃO
 *
 * Este é o ÚNICO lugar que você edita para atualizar a barra de progresso. A porcentagem, o valor
 * restante e os textos do card são calculados automaticamente a partir destes números.
 *
 * Como preencher:
 * - Valores em reais (R$), sem aspas, sem "R$" e sem ponto de milhar: 22000 significa R$ 22.000,00.
 *   Para centavos use ponto: 22350.5 significa R$ 22.350,50.
 * - Depois de editar, publique de novo (na Vercel, basta salvar/commitar este arquivo no GitHub).
 *
 * REGRA DE OURO: `raised` só deve ser alterado com base em doações EFETIVAMENTE CONFIRMADAS
 * (conferidas no extrato ou no aplicativo do banco). Escolher um valor, gerar o QR Code ou copiar o
 * código Pix NUNCA altera o total: o site não tem como saber se o pagamento foi concluído.
 *
 * O site apresenta este número como "total informado pela organização da campanha"; ele não afirma
 * ter verificado os pagamentos no banco.
 */
export const fundraising = {
  /** false = esconde o card de meta. */
  enabled: true,
  /** Valor arrecadado até agora, em reais. */
  raised: 22000,
  /** Meta total, em reais. */
  goal: 50000,
  /** Opcional: data da última conferência, no formato AAAA-MM-DD (ex.: "2026-10-27"). Aparece no card. */
  updatedAt: "",
};
