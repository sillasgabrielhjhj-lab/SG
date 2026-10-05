import Link from "next/link";
import { buildMetadata } from "@/features/seo/metadata";
import { Accordion } from "@/components/ui/accordion";

export const metadata = buildMetadata({ title: "Central de ajuda", description: "Respostas sobre compras, pagamentos PIX e cartão, entregas, trocas e devoluções na Mercatto.", path: "/ajuda" });

const FAQ: { group: string; items: [string, React.ReactNode][] }[] = [
  {
    group: "Compras",
    items: [
      ["Como sei se um produto é vendido pela Mercatto?", "Produtos com o selo “Oficial Mercatto” são vendidos e entregues pela Mercatto. Os demais são vendidos por lojas parceiras, cujo nome aparece na página do produto."],
      ["Posso comprar de lojas diferentes no mesmo carrinho?", "Sim. O pagamento é único, mas cada loja envia seu pedido separadamente, com frete e prazo próprios."],
      ["O estoque fica reservado enquanto pago?", "Sim. Ao finalizar a compra, os itens ficam reservados pelo tempo de validade do PIX. Se o pagamento não for concluído, a reserva é liberada automaticamente."],
    ],
  },
  {
    group: "Pagamento",
    items: [
      ["Quais formas de pagamento são aceitas?", "PIX (aprovação na hora) e cartão de crédito com parcelamento. As condições de parcelamento aparecem no produto e no checkout."],
      ["Vocês guardam os dados do meu cartão?", "Não. O cartão é processado diretamente pelo parceiro de pagamento; guardamos apenas a bandeira e os 4 últimos dígitos para sua referência."],
      ["Meu pagamento foi recusado. E agora?", "Você pode tentar novamente com outro cartão ou pagar via PIX pela página do pedido, enquanto a reserva estiver válida."],
    ],
  },
  {
    group: "Entrega",
    items: [
      ["Como acompanho meu pedido?", <>Em <Link href="/minha-conta/pedidos">Minha conta → Pedidos</Link> você vê a linha do tempo e o código de rastreio assim que o pedido é enviado.</>],
      ["Como é calculado o frete?", "Pelo CEP de destino, peso e dimensões dos produtos de cada loja. Você vê o valor e o prazo antes de pagar."],
    ],
  },
  {
    group: "Trocas e devoluções",
    items: [
      ["Posso desistir da compra?", <>Sim, em até 7 dias após o recebimento (direito de arrependimento). Solicite em <Link href="/minha-conta/pedidos">Meus pedidos</Link>. Veja a <Link href="/trocas-e-devolucoes">política completa</Link>.</>],
      ["Recebi um produto com defeito.", "Abra a solicitação pelo pedido. Produtos com defeito seguem os prazos do Código de Defesa do Consumidor (30 dias para não duráveis e 90 dias para duráveis)."],
    ],
  },
  {
    group: "Conta e segurança",
    items: [
      ["Esqueci minha senha.", <>Use <Link href="/recuperar-senha">Recuperar senha</Link>. Enviaremos um link válido por tempo limitado para o seu e-mail.</>],
      ["Recebi uma mensagem pedindo meus dados. É da Mercatto?", "A Mercatto nunca pede senha ou dados completos de cartão por e-mail, telefone ou mensagem. Na dúvida, acesse sua conta digitando o endereço do site."],
    ],
  },
  {
    group: "Vender na Mercatto",
    items: [["Como começo a vender?", <>Cadastre sua loja em <Link href="/vender">Venda na Mercatto</Link>. Após a aprovação, publique produtos pelo painel do vendedor.</>]],
  },
];

export default function HelpPage() {
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Central de ajuda</h1>
      <p className="mt-2 text-fg-muted">
        Não encontrou o que precisa? <Link href="/contato" className="font-semibold text-brand-700 underline">Fale com a gente</Link>.
      </p>
      <div className="mt-6 flex flex-col gap-6 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline">
        {FAQ.map((g) => (
          <section key={g.group} aria-label={g.group}>
            <h2 className="mb-2 text-lg font-bold">{g.group}</h2>
            <Accordion items={g.items.map(([q, a], i) => ({ id: `${g.group}-${i}`, title: q, content: <div className="text-sm leading-relaxed text-fg-muted">{a}</div> }))} />
          </section>
        ))}
      </div>
    </div>
  );
}
