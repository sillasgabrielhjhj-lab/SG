import { Alert } from "@/components/ui/alert";

/**
 * Pagamentos indisponíveis por configuração do gateway. O cliente vê só uma
 * mensagem genérica; o administrador vê o motivo para corrigir na Vercel.
 */
export function PaymentsUnavailable({ isAdmin, reason }: { isAdmin: boolean; reason: string }) {
  return (
    <Alert tone="danger" title="Pagamentos indisponíveis no momento">
      Não foi possível iniciar o pagamento agora. Seus itens continuam no carrinho — tente novamente em instantes.
      {isAdmin ? (
        <span className="mt-2 block text-xs">
          <strong>Para o administrador:</strong> {reason} Corrija em Vercel → Settings → Environment Variables e faça Redeploy.
        </span>
      ) : null}
    </Alert>
  );
}
