/**
 * Núcleo mínimo para montar SVG como string (isomórfico, sem dependências).
 *
 * `Art` acumula as <defs> (gradientes, clipPaths, filtros) de UMA imagem e
 * gera ids únicos com o prefixo informado — vários SVGs inline podem coexistir
 * na mesma página sem colisão de ids.
 */

export type Attrs = Readonly<Record<string, string | number | undefined>>;
/** [offset 0..1, cor hex, opacidade opcional]. */
export type Stop = readonly [number, string, number?];

/** Formata número com no máximo 1 casa decimal (SVG enxuto). */
export function fmt(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? "0" : String(v);
}

/** Template tag que formata os números interpolados: d`M${x} ${y}h${w}`. */
export function d(strings: TemplateStringsArray, ...values: readonly number[]): string {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i += 1) out += fmt(values[i] ?? 0) + (strings[i + 1] ?? "");
  return out;
}

function attrs(a: Attrs): string {
  let out = "";
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined) continue;
    out += ` ${k}="${typeof v === "number" ? fmt(v) : v}"`;
  }
  return out;
}

export function el(tag: string, a: Attrs, children?: string): string {
  return children === undefined ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${children}</${tag}>`;
}

export const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra: Attrs = {}) =>
  el("rect", { x, y, width: w, height: h, rx: rx || undefined, fill, ...extra });
export const circle = (cx: number, cy: number, r: number, fill: string, extra: Attrs = {}) =>
  el("circle", { cx, cy, r, fill, ...extra });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra: Attrs = {}) =>
  el("ellipse", { cx, cy, rx, ry, fill, ...extra });
export const path = (dd: string, fill: string, extra: Attrs = {}) => el("path", { d: dd, fill, ...extra });
export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width: number, extra: Attrs = {}) =>
  el("line", { x1, y1, x2, y2, stroke, "stroke-width": width, "stroke-linecap": "round", ...extra });
export const g = (children: string | readonly string[], extra: Attrs = {}) =>
  el("g", extra, typeof children === "string" ? children : children.join(""));
/** Grupo transformado: translate(x,y) scale(s) rotate(r). */
export const place = (children: string, x: number, y: number, s = 1, r = 0, extra: Attrs = {}) =>
  g(children, { transform: `translate(${fmt(x)} ${fmt(y)})${s !== 1 ? ` scale(${s})` : ""}${r ? ` rotate(${fmt(r)})` : ""}`, ...extra });
/** Contorno sem preenchimento. */
export const stroke = (color: string, width: number, extra: Attrs = {}): Attrs => ({
  fill: "none",
  stroke: color,
  "stroke-width": width,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  ...extra,
});

/** Retângulo arredondado como path (útil para clip e recortes). */
export function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return d`M${x + rr} ${y}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(w - 2 * rr)}a${rr} ${rr} 0 0 1 ${-rr} ${-rr}v${-(h - 2 * rr)}a${rr} ${rr} 0 0 1 ${rr} ${-rr}z`;
}

function stopsMarkup(stops: readonly Stop[]): string {
  return stops
    .map(([o, c, op]) => `<stop offset="${fmt(o * 100)}%" stop-color="${c}"${op !== undefined && op !== 1 ? ` stop-opacity="${op}"` : ""}/>`)
    .join("");
}

export class Art {
  private count = 0;
  private readonly defs: string[] = [];

  constructor(readonly prefix: string) {}

  /** Novo id único dentro desta imagem. */
  uid(): string {
    this.count += 1;
    return `${this.prefix}-${this.count.toString(36)}`;
  }

  /** Gradiente linear em coordenadas do objeto (0..1). Padrão: de cima para baixo. */
  lin(stops: readonly Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
    const id = this.uid();
    this.defs.push(`<linearGradient id="${id}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}">${stopsMarkup(stops)}</linearGradient>`);
    return `url(#${id})`;
  }

  /** Gradiente linear em coordenadas absolutas (userSpaceOnUse). */
  linU(stops: readonly Stop[], x1: number, y1: number, x2: number, y2: number): string {
    const id = this.uid();
    this.defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}">${stopsMarkup(stops)}</linearGradient>`,
    );
    return `url(#${id})`;
  }

  /** Gradiente radial em coordenadas do objeto (0..1). */
  rad(stops: readonly Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy): string {
    const id = this.uid();
    const focus = fx !== cx || fy !== cy ? ` fx="${fmt(fx)}" fy="${fmt(fy)}"` : "";
    this.defs.push(`<radialGradient id="${id}" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"${focus}>${stopsMarkup(stops)}</radialGradient>`);
    return `url(#${id})`;
  }

  /** Gradiente radial em coordenadas absolutas. */
  radU(stops: readonly Stop[], cx: number, cy: number, r: number, fx = cx, fy = cy): string {
    const id = this.uid();
    const focus = fx !== cx || fy !== cy ? ` fx="${fmt(fx)}" fy="${fmt(fy)}"` : "";
    this.defs.push(
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"${focus}>${stopsMarkup(stops)}</radialGradient>`,
    );
    return `url(#${id})`;
  }

  /** Registra um clipPath e retorna `url(#id)`. */
  clip(shapes: string): string {
    const id = this.uid();
    this.defs.push(`<clipPath id="${id}">${shapes}</clipPath>`);
    return `url(#${id})`;
  }

  /** Padrão repetido (tecido, grade de alto-falante...) em coordenadas absolutas. */
  pattern(w: number, h: number, content: string, transform?: string): string {
    const id = this.uid();
    const tf = transform ? ` patternTransform="${transform}"` : "";
    this.defs.push(`<pattern id="${id}" width="${fmt(w)}" height="${fmt(h)}" patternUnits="userSpaceOnUse"${tf}>${content}</pattern>`);
    return `url(#${id})`;
  }

  /** Desfoque gaussiano (para sombras/brilhos suaves). */
  blur(std: number): string {
    const id = this.uid();
    this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${fmt(std)}"/></filter>`);
    return `url(#${id})`;
  }

  /** Registra um elemento reutilizável (via <use href="#id">) e retorna o id. */
  symbol(markup: (id: string) => string): string {
    const id = this.uid();
    this.defs.push(markup(id));
    return id;
  }

  defsMarkup(): string {
    return this.defs.length ? `<defs>${this.defs.join("")}</defs>` : "";
  }
}

/** Gerador pseudoaleatório determinístico (LCG) — mesma semente ⇒ mesmo desenho. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function reuse(id: string, x: number, y: number, extra: Attrs = {}): string {
  return el("use", { href: `#${id}`, x, y, ...extra });
}

export function svgDocument(a: Art, width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${a.defsMarkup()}${body}</svg>`;
}
