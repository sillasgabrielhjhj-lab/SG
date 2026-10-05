import { buildMetadata } from "@/features/seo/metadata";
import { InfoPage } from "@/features/institutional/info-page";

export const metadata = buildMetadata({ title: "Política de cookies", description: "Cookies e armazenamento local usados pela Mercatto.", path: "/cookies" });

export default function CookiesPage() {
  return (
    <InfoPage
      title="Política de cookies"
      updatedAt="05/10/2026"
      legalDraft
      intro={<p>A Mercatto usa somente cookies e armazenamento local estritamente necessários ao funcionamento da loja. Não usamos cookies de publicidade ou rastreamento de terceiros.</p>}
      sections={[
        { id: "cookies", title: "Cookies", body: <ul><li><strong>Sessão</strong> (mrc_session / __Host-mrc_session): mantém você conectado. HttpOnly e seguro.</li><li><strong>Carrinho</strong>: identifica o carrinho de visitantes antes do login.</li><li><strong>CEP</strong> (mrc_cep): lembra o CEP informado para calcular frete.</li></ul> },
        { id: "local", title: "Armazenamento no navegador", body: <ul><li>Histórico de buscas e produtos vistos recentemente — ficam apenas no seu navegador e podem ser apagados a qualquer momento.</li></ul> },
        { id: "controle", title: "Como controlar", body: <p>Você pode apagar cookies e dados de sites nas configurações do navegador. Sem o cookie de sessão não é possível permanecer conectado.</p> },
      ]}
    />
  );
}
