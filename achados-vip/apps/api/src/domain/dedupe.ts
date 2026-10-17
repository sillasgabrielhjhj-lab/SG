/**
 * Chave de "família" de produto para evitar publicar a mesma coisa duas vezes (puro).
 *
 * Decisão sobre variações: modelo, COR e CAPACIDADE (ex.: "128gb", "azul", "110v") NÃO são removidos,
 * pois costumam ter preço/estoque diferentes; juntar variações distintas suprimiria uma oferta legítima
 * (falso positivo é pior que repetir um produto). Removemos apenas ruído de marketing ("frete grátis",
 * "promoção", "original", "lacrado"...), stopwords PT, acentos, pontuação, e numeração explícita de cor
 * ("cor 03"). Ordem das palavras é ignorada (tokens ordenados e únicos).
 * Com catalogProductId a família é "cat:<id>" (tem prioridade sobre o título).
 */

export interface FamilyInput {
  title: string;
  catalogProductId?: string | null;
}

const MAX_KEY_LENGTH = 200;

/** Frases de marketing (já sem acento, minúsculas). Ordem: frases mais longas primeiro. */
const MARKETING_PHRASES = [
  'frete gratis',
  'frete gratuito',
  'envio imediato',
  'envio rapido',
  'entrega imediata',
  'entrega rapida',
  'pronta entrega',
  'nota fiscal',
  'melhor preco',
  'menor preco',
  'preco baixo',
  'cor n[o]?\\s*\\d+',
  'cor\\s*\\d+',
];

const MARKETING_WORDS = new Set(['promocao', 'promocional', 'oferta', 'ofertas', 'original', 'lacrado', 'lacrada', 'garantia', 'imperdivel', 'liquidacao', 'queima', 'nf']);

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'com', 'para', 'pra', 'por', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'c', 'p',
]);

const MARKETING_RE = new RegExp(`(?<![a-z0-9])(?:${MARKETING_PHRASES.join('|')})(?![a-z0-9])`, 'g');

/** Une número e unidade ("128 gb" => "128gb") para que as grafias coincidam. */
const UNIT_RE = /(\d)\s+(gb|tb|mb|kg|ml|mah|hz|pol|cm|mm|w|v|g|l)(?![a-z0-9])/g;

function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2') // 1.000 => 1000
    .replace(/(\d),(\d)/g, '$1.$2') // 6,5 => 6.5
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' '); // pontos que não estão entre dígitos
}

/** Chave estável da família; '' se não houver informação (nunca agrupe chaves vazias). */
export function familyKey(input: FamilyInput): string {
  const catalog = input.catalogProductId?.trim();
  if (catalog) return `cat:${catalog}`;
  const text = normalizeTitle(input.title ?? '').replace(MARKETING_RE, ' ').replace(UNIT_RE, '$1$2');
  const tokens = new Set(text.split(/\s+/).filter((t) => t && !STOPWORDS.has(t) && !MARKETING_WORDS.has(t)));
  return [...tokens].sort().join('-').slice(0, MAX_KEY_LENGTH);
}

/** Mesma família? Chaves vazias nunca são consideradas iguais. */
export function isSameFamily(a: FamilyInput, b: FamilyInput): boolean {
  const ka = familyKey(a);
  return ka !== '' && ka === familyKey(b);
}
