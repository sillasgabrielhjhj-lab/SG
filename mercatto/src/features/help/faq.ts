export type FaqItem = { q: string; a: string; link?: { href: string; label: string } };
export type FaqGroup = { id: string; title: string; items: FaqItem[] };

/** Perguntas da Central de ajuda — respostas fiéis ao funcionamento real da plataforma. */
export const FAQ: FaqGroup[] = [
  {
    id: "compras",
    title: "Minha compra",
    items: [
      { q: "Como comprar na Mercatto?", a: "Escolha o produto e a variação, adicione ao carrinho e siga para o checkout: informe o endereço, escolha a entrega, pague com PIX ou cartão e revise o pedido. Você acompanha tudo em Meus pedidos.", link: { href: "/minha-conta/pedidos", label: "Meus pedidos" } },
      { q: "Como sei se um produto é vendido pela Mercatto?", a: "Produtos com o selo “Oficial Mercatto” são vendidos e entregues pela Mercatto. Os demais são vendidos por lojas parceiras, cujo nome aparece na página do produto." },
      { q: "Posso comprar de lojas diferentes no mesmo carrinho?", a: "Sim. O pagamento é único, mas cada loja envia seu pedido separadamente, com frete e prazo próprios." },
      { q: "O estoque fica reservado enquanto pago?", a: "Sim. Ao finalizar a compra, os itens ficam reservados pelo tempo de validade do PIX. Se o pagamento não for concluído, a reserva é liberada automaticamente." },
    ],
  },
  {
    id: "pagamento",
    title: "Pagamento",
    items: [
      { q: "Quais formas de pagamento são aceitas?", a: "PIX e cartão de crédito, conforme disponível no checkout. As condições de parcelamento aparecem no produto e no checkout antes de você pagar." },
      { q: "Vocês guardam os dados do meu cartão?", a: "Não. O cartão é processado diretamente pelo parceiro de pagamento; guardamos apenas a bandeira e os 4 últimos dígitos para sua referência." },
      { q: "Meu pagamento foi recusado. E agora?", a: "Você pode tentar novamente com outro cartão ou pagar via PIX pela página do pedido, enquanto a reserva estiver válida." },
    ],
  },
  {
    id: "entrega",
    title: "Entrega",
    items: [
      { q: "Como acompanho meu pedido?", a: "Em Meus pedidos você vê a linha do tempo do pedido e o código de rastreio assim que ele é enviado.", link: { href: "/minha-conta/pedidos", label: "Meus pedidos" } },
      { q: "Como é calculado o frete?", a: "Pelo CEP de destino, peso e dimensões dos produtos de cada loja. Você vê o valor e o prazo antes de pagar." },
    ],
  },
  {
    id: "trocas",
    title: "Trocas e devoluções",
    items: [
      { q: "Posso desistir da compra?", a: "Sim, em até 7 dias após o recebimento (direito de arrependimento). Solicite pelo pedido em Meus pedidos.", link: { href: "/trocas-e-devolucoes", label: "Política de trocas e devoluções" } },
      { q: "Recebi um produto com defeito.", a: "Abra a solicitação pelo pedido. Produtos com defeito seguem os prazos do Código de Defesa do Consumidor (30 dias para não duráveis e 90 dias para duráveis)." },
      { q: "Quando recebo o reembolso?", a: "Depois que a devolução é aprovada, o reembolso é feito pelo mesmo meio de pagamento. O prazo para aparecer no cartão depende do emissor." },
    ],
  },
  {
    id: "garantia",
    title: "Garantia",
    items: [
      { q: "Qual é a garantia do produto?", a: "Quando o vendedor informa uma garantia, ela aparece na página do produto. Além disso, todo produto tem a garantia legal do Código de Defesa do Consumidor." },
      { q: "Como aciono a garantia?", a: "Abra uma solicitação pelo pedido em Meus pedidos, descrevendo o problema. Guarde a nota fiscal e a embalagem, se possível.", link: { href: "/minha-conta/pedidos", label: "Meus pedidos" } },
    ],
  },
  {
    id: "cupons",
    title: "Cupons",
    items: [
      { q: "Como uso um cupom?", a: "Digite o código no carrinho, em “Tem um cupom?”. O desconto é calculado na hora e confirmado no checkout. Vale um cupom por pedido." },
      { q: "Por que meu cupom não foi aceito?", a: "Cada cupom tem regras próprias: validade, produtos participantes, valor mínimo, limite por cliente ou uso só na primeira compra. A mensagem no carrinho explica o motivo." },
    ],
  },
  {
    id: "conta",
    title: "Conta",
    items: [
      { q: "Esqueci minha senha.", a: "Use Recuperar senha. Enviaremos um link válido por tempo limitado para o seu e-mail.", link: { href: "/recuperar-senha", label: "Recuperar senha" } },
      { q: "Onde vejo meus favoritos?", a: "Em Minha conta → Favoritos. Toque no coração de qualquer produto para salvá-lo.", link: { href: "/minha-conta/favoritos", label: "Meus favoritos" } },
    ],
  },
  {
    id: "seguranca",
    title: "Segurança",
    items: [
      { q: "Recebi uma mensagem pedindo meus dados. É da Mercatto?", a: "A Mercatto nunca pede senha ou dados completos de cartão por e-mail, telefone ou mensagem. Na dúvida, acesse sua conta digitando o endereço do site no navegador.", link: { href: "/seguranca", label: "Compra segura" } },
    ],
  },
  {
    id: "vendedores",
    title: "Vendedores",
    items: [{ q: "Como começo a vender?", a: "Cadastre sua loja em Venda na Mercatto. Após a aprovação, publique produtos pelo painel do vendedor.", link: { href: "/vender", label: "Venda na Mercatto" } }],
  },
];
