import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { InfoPage } from "@/features/institutional/info-page";

export const metadata = buildMetadata({ title: "Política de privacidade", description: "Como a Mercatto coleta, usa e protege seus dados pessoais, conforme a LGPD.", path: "/privacidade" });

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Política de privacidade"
      updatedAt="05/10/2026"
      legalDraft
      intro={<p>Esta política explica como [RAZÃO SOCIAL] (CNPJ [CNPJ]), controladora dos dados, trata informações pessoais na Mercatto, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>}
      sections={[
        { id: "dados", title: "1. Dados que coletamos", body: <ul><li><strong>Cadastro:</strong> nome, e-mail, senha (armazenada apenas como hash), CPF, telefone e data de nascimento (opcional).</li><li><strong>Compras:</strong> endereços de entrega, itens, valores e histórico de pedidos.</li><li><strong>Pagamento:</strong> processado pelo parceiro de pagamento; guardamos somente status, bandeira e 4 últimos dígitos do cartão.</li><li><strong>Uso:</strong> IP e navegador das sessões ativas (segurança), buscas e produtos vistos (agregados, para métricas).</li></ul> },
        { id: "finalidades", title: "2. Finalidades e bases legais", body: <ul><li>Executar o contrato de compra e venda (entrega, atendimento, notas) — art. 7º, V.</li><li>Cumprir obrigações legais e fiscais — art. 7º, II.</li><li>Prevenir fraudes e proteger sua conta — legítimo interesse, art. 7º, IX.</li><li>Enviar ofertas por e-mail — somente com seu consentimento, revogável a qualquer momento — art. 7º, I.</li></ul> },
        { id: "compartilhamento", title: "3. Compartilhamento", body: <p>Compartilhamos apenas o necessário com: a loja parceira responsável pelo seu pedido (nome, endereço e telefone para entrega), o parceiro de pagamento, transportadoras e provedores de infraestrutura (hospedagem, e-mail). Não vendemos dados pessoais.</p> },
        { id: "retencao", title: "4. Retenção", body: <p>Mantemos os dados enquanto a conta estiver ativa e pelos prazos legais aplicáveis (ex.: registros fiscais e de acesso). [PRAZOS ESPECÍFICOS A DEFINIR PELO JURÍDICO.]</p> },
        { id: "direitos", title: "5. Seus direitos (art. 18)", body: <p>Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação de dados tratados com consentimento, informação sobre compartilhamentos e revogação do consentimento. Parte disso pode ser feita diretamente em “Minha conta”; os demais pedidos pelo canal do encarregado.</p> },
        { id: "seguranca", title: "6. Segurança", body: <p>Usamos conexão criptografada (HTTPS), senhas com hash forte, sessões revogáveis, controle de acesso por perfil e registro de auditoria. Veja também <Link href="/seguranca">Segurança</Link>.</p> },
        { id: "encarregado", title: "7. Encarregado (DPO)", body: <p>[NOME DO ENCARREGADO] — [E-MAIL DO ENCARREGADO].</p> },
        { id: "cookies", title: "8. Cookies", body: <p>Usamos apenas cookies necessários ao funcionamento. Detalhes na <Link href="/cookies">Política de cookies</Link>.</p> },
      ]}
    />
  );
}
