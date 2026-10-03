// Configuração estática de navegação (ícones + ordem de exibição das
// categorias no header/menu). Os dados reais de produtos e categorias
// vêm do banco via src/lib/data/catalog.ts — isto aqui é só vitrine de
// navegação, os slugs batem com as categorias de nível raiz criadas no
// seed (prisma/seed.ts).

export type NavCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
};

export const categories: NavCategory[] = [
  { id: "c1", name: "Eletrônicos", slug: "eletronicos", icon: "Smartphone" },
  { id: "c2", name: "Celulares", slug: "celulares", icon: "Smartphone" },
  { id: "c3", name: "Informática", slug: "informatica", icon: "Laptop" },
  { id: "c4", name: "Casa", slug: "casa", icon: "Sofa" },
  { id: "c5", name: "Moda", slug: "moda", icon: "Shirt" },
  { id: "c6", name: "Beleza", slug: "beleza", icon: "Sparkles" },
  { id: "c7", name: "Esportes", slug: "esportes", icon: "Dumbbell" },
  { id: "c8", name: "Automóveis", slug: "automoveis", icon: "Car" },
  { id: "c9", name: "Ferramentas", slug: "ferramentas", icon: "Wrench" },
  { id: "c10", name: "Games", slug: "games", icon: "Gamepad2" },
  { id: "c11", name: "Livros", slug: "livros", icon: "BookOpen" },
];

export const benefits = [
  {
    icon: "Truck",
    title: "Entrega rápida",
    description: "Receba em todo o Brasil com prazos claros antes de comprar.",
  },
  {
    icon: "ShieldCheck",
    title: "Compra protegida",
    description: "Reembolso garantido se o produto não chegar ou vier diferente.",
  },
  {
    icon: "BadgePercent",
    title: "Parcelamento sem juros",
    description: "Em até 12x nos cartões de crédito participantes.",
  },
  {
    icon: "Headset",
    title: "Suporte dedicado",
    description: "Atendimento humano para resolver qualquer problema com o pedido.",
  },
];
