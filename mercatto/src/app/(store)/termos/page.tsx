import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { InfoPage } from "@/features/institutional/info-page";

export const metadata = buildMetadata({ title: "Termos de uso", description: "Termos e condições de uso do marketplace Mercatto.", path: "/termos" });

export default function TermsPage() {
  return (
    <InfoPage
      title="Termos de uso"
      updatedAt="05/10/2026"
      legalDraft
      intro={<p>Estes termos regulam o uso da plataforma Mercatto, operada por [RAZÃO SOCIAL], inscrita no CNPJ [CNPJ], com sede em [ENDEREÇO]. Ao usar a plataforma você concorda com eles.</p>}
      sections={[
        { id: "plataforma", title: "1. A plataforma", body: <p>A Mercatto oferece (i) venda direta de produtos próprios (“Oficial Mercatto”) e (ii) um ambiente em que lojas parceiras anunciam e vendem seus produtos. Nas vendas de lojas parceiras, a loja é a fornecedora do produto; a Mercatto intermedeia o pagamento e o atendimento.</p> },
        { id: "conta", title: "2. Conta de usuário", body: <><p>Você é responsável pela veracidade dos dados informados e pela guarda da sua senha. Contas podem ser suspensas em caso de fraude, uso indevido ou violação destes termos.</p><p>É necessário ter 18 anos ou mais (ou estar assistido pelo responsável legal) para comprar.</p></> },
        { id: "compras", title: "3. Compras, preços e pagamento", body: <ul><li>Preços, frete e prazos são exibidos antes da confirmação e recalculados no momento da compra.</li><li>O estoque fica reservado pelo prazo de pagamento informado; após esse prazo, o pedido é cancelado automaticamente.</li><li>Erros evidentes de preço podem levar ao cancelamento do pedido, com reembolso integral.</li></ul> },
        { id: "entrega", title: "4. Entrega", body: <p>Os prazos começam a contar após a aprovação do pagamento. Cada loja envia seus próprios itens; o código de rastreio fica disponível em “Meus pedidos”.</p> },
        { id: "cancelamento", title: "5. Cancelamento, trocas e devoluções", body: <p>Seguem a <Link href="/trocas-e-devolucoes">Política de trocas e devoluções</Link> e o Código de Defesa do Consumidor, incluindo o direito de arrependimento de 7 dias.</p> },
        { id: "vendedores", title: "6. Regras para vendedores", body: <ul><li>Anunciar apenas produtos lícitos, originais e com descrição fiel.</li><li>Usar “preço anterior” somente quando o produto foi efetivamente vendido por aquele valor.</li><li>Cumprir prazos de envio e responder perguntas de clientes sem divulgar contatos externos.</li><li>Lojas podem ser suspensas por descumprimento, com pausa dos anúncios.</li></ul> },
        { id: "conteudo", title: "7. Avaliações e conteúdo", body: <p>Avaliações são permitidas somente a compradores de pedidos entregues e podem ser moderadas para remover ofensas, dados pessoais ou conteúdo enganoso. Dados de demonstração, quando existirem, são identificados como DEMO.</p> },
        { id: "responsabilidade", title: "8. Responsabilidades", body: <p>[CLÁUSULAS DE RESPONSABILIDADE A SEREM DEFINIDAS PELO JURÍDICO, observando o Código de Defesa do Consumidor e o Marco Civil da Internet.]</p> },
        { id: "foro", title: "9. Lei aplicável e foro", body: <p>Aplica-se a legislação brasileira. Fica eleito o foro do domicílio do consumidor.</p> },
      ]}
    />
  );
}
