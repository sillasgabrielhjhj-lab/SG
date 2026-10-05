/**
 * Catálogo das ilustrações de DEMONSTRAÇÃO (isomórfico, sem dependências).
 *
 * Define os tipos de produto ilustrados, os acabamentos de cor, as vistas e
 * os banners disponíveis, além dos caminhos públicos servidos pelos route
 * handlers em `src/app/demo-assets/**`. Use estes helpers no seed e nas
 * telas em vez de montar URLs à mão.
 */

export const DEMO_ART_KINDS = [
  "smartphone",
  "smartwatch",
  "earbuds",
  "laptop",
  "monitor",
  "keyboard",
  "mouse",
  "tablet",
  "console",
  "controller",
  "headset",
  "tv",
  "soundbar",
  "speaker",
  "headphones",
  "refrigerator",
  "washer",
  "microwave",
  "airfryer",
  "blender",
  "coffeemaker",
  "robot-vacuum",
  "office-chair",
  "lamp",
  "cookware",
  "sofa",
  "tshirt",
  "sneaker",
  "backpack",
  "wristwatch",
  "sunglasses",
  "perfume",
  "skincare",
  "hairdryer",
  "tire",
  "dashcam",
  "drill",
  "toolbox",
  "bicycle",
  "dumbbell",
  "yoga-mat",
  "football",
] as const;
export type DemoArtKind = (typeof DEMO_ART_KINDS)[number];

export const DEMO_ART_COLORS = [
  "black",
  "white",
  "silver",
  "graphite",
  "blue",
  "navy",
  "green",
  "pink",
  "red",
  "gold",
  "purple",
  "beige",
  "gray",
  "orange",
  "yellow",
] as const;
export type DemoArtColor = (typeof DEMO_ART_COLORS)[number];

/** "1" = vista principal, "2" = vista alternativa, "3" = detalhe/composição. */
export const DEMO_ART_VIEWS = ["1", "2", "3"] as const;
export type DemoArtView = (typeof DEMO_ART_VIEWS)[number];

export const DEMO_BANNER_NAMES = ["tech", "home", "fashion", "flash", "games", "official"] as const;
export type DemoBannerName = (typeof DEMO_BANNER_NAMES)[number];

/** Rótulos pt-BR para exibir a cor de uma variante. */
export const DEMO_ART_COLOR_LABELS: Readonly<Record<DemoArtColor, string>> = {
  black: "Preto",
  white: "Branco",
  silver: "Prata",
  graphite: "Grafite",
  blue: "Azul",
  navy: "Azul-marinho",
  green: "Verde",
  pink: "Rosa",
  red: "Vermelho",
  gold: "Dourado",
  purple: "Roxo",
  beige: "Bege",
  gray: "Cinza",
  orange: "Laranja",
  yellow: "Amarelo",
};

/**
 * Tom do fundo de cada banner, para o texto HTML sobreposto escolher o
 * contraste correto ("dark" ⇒ use texto claro; "light" ⇒ use texto escuro).
 * A metade esquerda de todos os banners é mantida limpa para título/CTA.
 */
export const DEMO_BANNER_TONES: Readonly<Record<DemoBannerName, "dark" | "light">> = {
  tech: "dark",
  home: "light",
  fashion: "light",
  flash: "light",
  games: "dark",
  official: "dark",
};

export const DEMO_ASSETS_BASE_PATH = "/demo-assets";
export const DEMO_ART_SIZE = 800;
export const DEMO_BANNER_WIDTH = 1600;
export const DEMO_BANNER_HEIGHT = 600;

const KIND_SET: ReadonlySet<string> = new Set(DEMO_ART_KINDS);
const COLOR_SET: ReadonlySet<string> = new Set(DEMO_ART_COLORS);
const VIEW_SET: ReadonlySet<string> = new Set(DEMO_ART_VIEWS);
const BANNER_SET: ReadonlySet<string> = new Set(DEMO_BANNER_NAMES);

export function isDemoArtKind(value: string): value is DemoArtKind {
  return KIND_SET.has(value);
}

export function isDemoArtColor(value: string): value is DemoArtColor {
  return COLOR_SET.has(value);
}

export function isDemoArtView(value: string): value is DemoArtView {
  return VIEW_SET.has(value);
}

export function isDemoBannerName(value: string): value is DemoBannerName {
  return BANNER_SET.has(value);
}

/** Caminho público (relativo à origem) da ilustração de um produto demo. */
export function demoProductImagePath(kind: DemoArtKind, color: DemoArtColor, view: DemoArtView = "1"): string {
  return `${DEMO_ASSETS_BASE_PATH}/p/${kind}/${color}/${view}.svg`;
}

/** Caminho público (relativo à origem) de um banner demo (1600×600, sem texto). */
export function demoBannerImagePath(name: DemoBannerName): string {
  return `${DEMO_ASSETS_BASE_PATH}/banner/${name}.svg`;
}

/** Os três caminhos (vistas 1, 2 e 3) de um produto demo, na ordem de exibição. */
export function demoProductGallery(kind: DemoArtKind, color: DemoArtColor): string[] {
  return DEMO_ART_VIEWS.map((view) => demoProductImagePath(kind, color, view));
}

export interface DemoProductParams {
  kind: DemoArtKind;
  color: DemoArtColor;
  view: DemoArtView;
}

/**
 * Valida os segmentos da URL `/demo-assets/p/[kind]/[color]/[view]`, em que
 * `view` chega no formato "1.svg". Retorna `null` se qualquer parte for inválida.
 */
export function parseDemoProductParams(raw: { kind: string; color: string; view: string }): DemoProductParams | null {
  const { kind, color } = raw;
  const view = stripSvgExtension(raw.view);
  if (view === null || !isDemoArtKind(kind) || !isDemoArtColor(color) || !isDemoArtView(view)) return null;
  return { kind, color, view };
}

/** Valida o segmento `[name]` de `/demo-assets/banner/[name]` ("tech.svg"). */
export function parseDemoBannerParam(raw: string): DemoBannerName | null {
  const name = stripSvgExtension(raw);
  return name !== null && isDemoBannerName(name) ? name : null;
}

function stripSvgExtension(segment: string): string | null {
  return segment.endsWith(".svg") ? segment.slice(0, -4) : null;
}
