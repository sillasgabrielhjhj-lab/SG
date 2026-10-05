import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { InfoPage } from "@/features/institutional/info-page";

export const metadata = buildMetadata({ title: "Sobre a Mercatto", description: "Conheça a Mercatto: marketplace brasileiro com produtos oficiais e lojas parceiras verificadas.", path: "/sobre" });

export default function AboutPage() {
  return (
    <InfoPage
      title="Sobre a Mercatto"
      intro={<p>A Mercatto é um marketplace brasileiro que reúne, em um só lugar, produtos vendidos e entregues pela própria Mercatto e ofertas de lojas parceiras verificadas.</p>}
      sections={[
        {
          id: "dois-modelos",
          title: "Dois jeitos de vender, uma experiência",
          body: (
            <>
              <p>
                <strong>Produtos oficiais Mercatto</strong> têm estoque próprio, preço e entrega controlados pela nossa equipe e são identificados pelo selo “Oficial Mercatto”.
              </p>
              <p>
                <strong>Lojas parceiras</strong> passam por análise cadastral antes de vender. Cada loja tem reputação pública, calculada a partir de avaliações de compras verificadas.
              </p>
            </>
          ),
        },
        {
          id: "compromissos",
          title: "Nossos compromissos",
          body: (
            <ul>
              <li>Preço final transparente: frete e descontos aparecem antes do pagamento.</li>
              <li>Pagamento protegido por PIX ou cartão, processado por parceiros de pagamento — não armazenamos dados de cartão.</li>
              <li>Direito de arrependimento de 7 dias para compras online, conforme o Código de Defesa do Consumidor.</li>
              <li>Avaliações apenas de quem comprou e recebeu o produto.</li>
            </ul>
          ),
        },
        { id: "venda", title: "Quer vender com a gente?", body: <p>Cadastre sua loja em <Link href="/vender">Venda na Mercatto</Link>. Após a aprovação, você publica produtos, gerencia estoque e acompanha pedidos pelo painel do vendedor.</p> },
      ]}
    />
  );
}
