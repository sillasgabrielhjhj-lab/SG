import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: `Como a ${siteConfig.name} trata os dados informados no site.`,
  alternates: { canonical: '/privacidade' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updatedAt="outubro de 2026">
      <p>
        Esta política explica, de forma simples, como a {siteConfig.name} trata os dados informados neste site, em
        conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>
      <h2>Quais dados coletamos</h2>
      <p>Para montar o seu pedido, o site pede apenas o necessário:</p>
      <ul>
        <li>nome e telefone, para confirmar o pedido;</li>
        <li>endereço, quando você escolhe entrega;</li>
        <li>forma de pagamento e observações do pedido.</li>
      </ul>
      <h2>Como os dados são usados</h2>
      <p>
        O site não envia esses dados para nenhum servidor próprio. Ao finalizar, eles são reunidos em uma mensagem que
        abre no seu WhatsApp, e só chegam até nós quando você toca em enviar. Usamos essas informações exclusivamente
        para preparar, entregar e cobrar o pedido.
      </p>
      <h2>Dados salvos no seu aparelho</h2>
      <p>
        A sacola e, se você autorizar, seus dados de contato e endereço ficam salvos no armazenamento local do seu
        navegador para agilizar o próximo pedido. Você pode apagá-los a qualquer momento limpando os dados do site no
        navegador ou desmarcando a opção “Lembrar meus dados”.
      </p>
      <h2>Serviços de terceiros</h2>
      <ul>
        <li>WhatsApp (Meta): recebe a mensagem do pedido que você decide enviar;</li>
        <li>ViaCEP: consultado apenas com o CEP digitado, para preencher o endereço;</li>
        <li>Google Maps: exibe o mapa da nossa localização;</li>
        <li>Unsplash: hospeda algumas imagens do site.</li>
      </ul>
      <h2>Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail{' '}
        <a className="font-semibold text-tomato-600 underline" href={`mailto:${siteConfig.contact.email}`}>
          {siteConfig.contact.email}
        </a>{' '}
        ou pelo nosso WhatsApp.
      </p>
    </LegalPage>
  );
}
