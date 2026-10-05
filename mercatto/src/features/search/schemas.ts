/**
 * Filtros de busca/listagem <-> URL (a URL é a fonte da verdade: links
 * compartilháveis, voltar/avançar do navegador e SEO). Valores inválidos são
 * ignorados com segurança.
 */
export const SORT_OPTIONS = [
  { value: "relevancia", label: "Mais relevantes" },
  { value: "menor_preco", label: "Menor preço" },
  { value: "maior_preco", label: "Maior preço" },
  { value: "mais_vendidos", label: "Mais vendidos" },
  { value: "melhor_avaliados", label: "Melhor avaliados" },
  { value: "novidades", label: "Novidades" },
  { value: "maior_desconto", label: "Maior desconto" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const CONDITION_MAP = { novo: "NEW", usado: "USED", recondicionado: "REFURBISHED" } as const;
export type ConditionParam = keyof typeof CONDITION_MAP;
export const CONDITION_LABELS: Record<"NEW" | "USED" | "REFURBISHED", string> = { NEW: "Novo", USED: "Usado", REFURBISHED: "Recondicionado" };

export type SearchFilters = {
  q?: string;
  category?: string;
  brands: string[];
  priceMin?: number; // centavos
  priceMax?: number; // centavos
  condition?: "NEW" | "USED" | "REFURBISHED";
  rating?: number;
  freeShipping: boolean;
  promotion: boolean;
  official: boolean;
  store?: string;
  available: boolean;
  sort: SortValue;
  page: number;
  attrs: Record<string, string[]>;
};

export const MAX_PAGE = 200;

type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(params: ParamsInput, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key).flatMap((v) => v.split(","));
  const v = params[key];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(","));
}
const getOne = (params: ParamsInput, key: string) => getAll(params, key)[0]?.trim() || undefined;
const slugLike = (v: string | undefined) => (v && /^[a-z0-9-]{1,120}$/.test(v) ? v : undefined);
const flag = (params: ParamsInput, key: string) => ["1", "true", "sim"].includes(getOne(params, key) ?? "");

function reaisToCents(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return undefined;
  return Math.round(n * 100);
}

export function parseSearchParams(params: ParamsInput): SearchFilters {
  const q = getOne(params, "q")?.slice(0, 80);
  const sortRaw = getOne(params, "ordenar");
  const sort = (SORT_OPTIONS.find((o) => o.value === sortRaw)?.value ?? (q ? "relevancia" : "mais_vendidos")) as SortValue;
  const pageNum = Number(getOne(params, "pagina") ?? 1);
  const conditionParam = getOne(params, "condicao") as ConditionParam | undefined;
  const rating = Number(getOne(params, "avaliacao"));
  let priceMin = reaisToCents(getOne(params, "preco_min"));
  let priceMax = reaisToCents(getOne(params, "preco_max"));
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];

  const attrs: Record<string, string[]> = {};
  const keys = params instanceof URLSearchParams ? [...new Set(params.keys())] : Object.keys(params);
  for (const key of keys) {
    if (!key.startsWith("attr_")) continue;
    const attrKey = key.slice(5);
    if (!/^[a-z0-9_-]{1,40}$/.test(attrKey)) continue;
    const values = getAll(params, key).map((v) => v.trim()).filter((v) => v && v.length <= 60).slice(0, 10);
    if (values.length) attrs[attrKey] = values;
  }

  return {
    q: q || undefined,
    category: slugLike(getOne(params, "categoria")),
    brands: getAll(params, "marca").map((b) => b.trim()).filter((b) => /^[a-z0-9-]{1,80}$/.test(b)).slice(0, 20),
    priceMin,
    priceMax,
    condition: conditionParam && conditionParam in CONDITION_MAP ? CONDITION_MAP[conditionParam] : undefined,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
    freeShipping: flag(params, "frete_gratis"),
    promotion: flag(params, "promocao"),
    official: flag(params, "oficial"),
    store: slugLike(getOne(params, "loja")),
    available: flag(params, "disponivel"),
    sort,
    page: Number.isInteger(pageNum) && pageNum >= 1 ? Math.min(pageNum, MAX_PAGE) : 1,
    attrs,
  };
}

const CONDITION_PARAM: Record<NonNullable<SearchFilters["condition"]>, ConditionParam> = { NEW: "novo", USED: "usado", REFURBISHED: "recondicionado" };

/** Serializa filtros para query string (omitindo padrões). */
export function serializeFilters(f: Partial<SearchFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("categoria", f.category);
  if (f.brands?.length) p.set("marca", f.brands.join(","));
  if (f.priceMin !== undefined) p.set("preco_min", String(f.priceMin / 100));
  if (f.priceMax !== undefined) p.set("preco_max", String(f.priceMax / 100));
  if (f.condition) p.set("condicao", CONDITION_PARAM[f.condition]);
  if (f.rating) p.set("avaliacao", String(f.rating));
  if (f.freeShipping) p.set("frete_gratis", "1");
  if (f.promotion) p.set("promocao", "1");
  if (f.official) p.set("oficial", "1");
  if (f.store) p.set("loja", f.store);
  if (f.available) p.set("disponivel", "1");
  for (const [k, v] of Object.entries(f.attrs ?? {})) if (v.length) p.set(`attr_${k}`, v.join(","));
  if (f.sort && f.sort !== (f.q ? "relevancia" : "mais_vendidos")) p.set("ordenar", f.sort);
  if (f.page && f.page > 1) p.set("pagina", String(f.page));
  return p;
}

/** Monta um link de listagem mantendo os filtros atuais e aplicando alterações (zera a página). */
export function buildSearchHref(basePath: string, current: SearchFilters, overrides: Partial<SearchFilters> = {}, keepPage = false): string {
  const next = { ...current, ...overrides, page: keepPage ? (overrides.page ?? current.page) : (overrides.page ?? 1) };
  const qs = serializeFilters(next).toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export type AppliedFilterChip = { key: string; label: string; href: string };
