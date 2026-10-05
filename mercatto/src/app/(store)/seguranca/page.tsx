import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { InfoPage } from "@/features/institutional/info-page";

export const metadata = buildMetadata({ title: "Segurança", description: "Como a Mercatto protege sua conta, seus pagamentos e seus dados.", path: "/seguranca" });

export default function SecurityInfoPage() {
  return (
    <InfoPage
      title="Segurança"
      intro={<p>Compra segura é prioridade. Veja como protegemos você — e como você pode se proteger.</p>}
      sections={[
        { id: "pagamentos", title: "Pagamentos", body: <ul><li>Dados de cartão são digitados em formulário seguro do parceiro de pagamento e nunca passam pelos nossos servidores.</li><li>Confirmações de pagamento chegam por canal assinado digitalmente e são verificadas antes de liberar o pedido.</li><li>O valor cobrado é sempre recalculado pelo servidor — preços não podem ser alterados pelo navegador.</li></ul> },
        { id: "conta", title: "Sua conta", body: <ul><li>Senhas armazenadas com hash forte (scrypt) — ninguém da Mercatto tem acesso a elas.</li><li>Bloqueio temporário após tentativas de login incorretas.</li><li>Em <Link href="/minha-conta/seguranca">Minha conta → Segurança</Link> você vê as sessões ativas e pode encerrá-las.</li></ul> },
        { id: "golpes", title: "Evite golpes", body: <ul><li>Não pedimos senha, código de verificação ou dados de cartão por e-mail, WhatsApp ou telefone.</li><li>Pague sempre dentro do site — nunca por PIX enviado por vendedor em conversa externa.</li><li>Desconfie de preços muito abaixo do mercado fora da loja oficial.</li></ul> },
        { id: "reportar", title: "Encontrou uma vulnerabilidade?", body: <p>Envie os detalhes para [E-MAIL DE SEGURANÇA]. Agradecemos a divulgação responsável.</p> },
      ]}
    />
  );
}
