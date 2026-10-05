import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { InfoPage } from "@/features/institutional/info-page";

export const metadata = buildMetadata({ title: "Trocas e devoluções", description: "Direito de arrependimento, produtos com defeito e reembolsos na Mercatto.", path: "/trocas-e-devolucoes" });

export default function ReturnsPage() {
  return (
    <InfoPage
      title="Trocas e devoluções"
      updatedAt="05/10/2026"
      legalDraft
      sections={[
        { id: "arrependimento", title: "Direito de arrependimento (7 dias)", body: <p>Compras feitas pela internet podem ser canceladas em até 7 dias corridos após o recebimento, sem necessidade de justificativa (art. 49 do Código de Defesa do Consumidor). O produto deve ser devolvido com seus acessórios. O reembolso é integral, incluindo o frete, na mesma forma de pagamento.</p> },
        { id: "defeito", title: "Produto com defeito", body: <p>Prazos para reclamar de vícios aparentes: 30 dias para produtos não duráveis e 90 dias para duráveis (art. 26 do CDC). O vendedor tem até 30 dias para resolver; não resolvido, você pode escolher troca, reembolso ou abatimento proporcional.</p> },
        { id: "como", title: "Como solicitar", body: <ol><li>Acesse <Link href="/minha-conta/pedidos">Meus pedidos</Link> e abra o pedido.</li><li>Clique em “Solicitar cancelamento” ou “Devolver produto” e informe o motivo.</li><li>O vendedor analisa e você é avisado por e-mail e notificação. Aprovado, o estorno é feito automaticamente.</li></ol> },
        { id: "antes-envio", title: "Cancelamento antes do envio", body: <p>Pedidos aguardando pagamento podem ser cancelados na hora. Pedidos pagos e ainda não enviados podem ter o cancelamento solicitado e, se aprovado, o valor é estornado integralmente.</p> },
        { id: "prazos", title: "Prazos de estorno", body: <ul><li>PIX: devolução na conta de origem em até [X] dias úteis.</li><li>Cartão: o estorno aparece na fatura conforme o ciclo do emissor (normalmente 1 a 2 faturas).</li></ul> },
      ]}
    />
  );
}
