export type CategoryId = 'pizzas' | 'especiais' | 'doces' | 'bebidas' | 'sobremesas' | 'combos';

export type ProductTag = 'mais-pedido' | 'vegetariano' | 'picante' | 'novidade' | 'chef';

export interface Category {
  id: CategoryId;
  name: string;
  /** Frase curta exibida acima dos itens da categoria. */
  description: string;
}

/** Um tamanho com preço (ex.: Broto, Média, Grande ou Lata, 2 L). */
export interface SizeOption {
  id: string;
  name: string;
  /** Detalhe exibido abaixo do nome (ex.: "8 fatias · 35 cm"). */
  detail?: string;
  /** Preço em reais (ex.: 54.9). */
  price: number;
}

export interface OptionItem {
  id: string;
  name: string;
  /** Valor adicional em reais. Use 0 para opções sem custo. */
  price: number;
}

export interface OptionGroup {
  id: string;
  /** Título exibido no produto (ex.: "Borda recheada"). */
  title: string;
  /** single = escolhe 1 (rádio) · multiple = escolhe vários (checkbox). */
  type: 'single' | 'multiple';
  /** Se verdadeiro, o cliente precisa escolher antes de adicionar. */
  required?: boolean;
  /** Opção já marcada ao abrir o produto (apenas para `single`). */
  defaultOptionId?: string;
  /** Limite de escolhas (apenas para `multiple`). */
  max?: number;
  /** Lista fixa de opções. */
  options?: OptionItem[];
  /**
   * Gera as opções automaticamente a partir dos produtos de uma categoria,
   * sem custo adicional (ex.: escolher o sabor da pizza de um combo).
   */
  fromCategory?: CategoryId;
}

export interface Product {
  /** Identificador único, sem espaços (usado no carrinho). */
  id: string;
  name: string;
  /** Ingredientes ou descrição curta. */
  description: string;
  category: CategoryId;
  /** URL da foto (veja src/data/images.ts). Opcional: sem foto, exibimos um ícone elegante. */
  image?: string;
  /** Preço único em reais (para itens sem tamanhos). */
  price?: number;
  /** Tamanhos com preços (para pizzas, bebidas etc.). */
  sizes?: SizeOption[];
  /** IDs dos grupos de opções (veja src/data/options.ts). */
  optionGroups?: string[];
  tags?: ProductTag[];
  /** Aparece na seção "Os mais pedidos". */
  featured?: boolean;
  /** Permite pedir meio a meio com outro sabor do mesmo grupo. */
  halfAndHalf?: 'salgada' | 'doce';
  /** Ex.: "Serve 2 pessoas". */
  serves?: string;
  /** false = esgotado/indisponível (aparece no cardápio, mas não pode ser pedido). */
  available?: boolean;
}
