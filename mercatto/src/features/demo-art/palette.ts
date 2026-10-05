import type { DemoArtColor } from "./catalog";

/**
 * Acabamentos (finishes) realistas para as ilustrações. Cada cor tem uma
 * rampa de 4 tons calibrada para luz-chave vinda do alto à esquerda:
 * `hi` (realce especular), `base` (tom médio), `shade` (face em sombra) e
 * `deep` (oclusão / fendas). `ink` é a cor de contraste para detalhes sobre
 * a superfície e `neutral` indica acabamentos acromáticos.
 */
export interface Finish {
  readonly name: DemoArtColor;
  readonly hi: string;
  readonly base: string;
  readonly shade: string;
  readonly deep: string;
  readonly ink: string;
  readonly light: boolean;
  readonly neutral: boolean;
}

type Ramp = Omit<Finish, "name">;

const FINISHES: Readonly<Record<DemoArtColor, Ramp>> = {
  black: { hi: "#5b6068", base: "#2b2e33", shade: "#18191c", deep: "#0b0c0e", ink: "#e9ecef", light: false, neutral: true },
  white: { hi: "#ffffff", base: "#f3f4f5", shade: "#d6dade", deep: "#a9b0b7", ink: "#3c4148", light: true, neutral: true },
  silver: { hi: "#f6f7f9", base: "#d2d6db", shade: "#a3aab2", deep: "#6f7780", ink: "#2f343a", light: true, neutral: true },
  graphite: { hi: "#8a9099", base: "#525760", shade: "#373b42", deep: "#202328", ink: "#e6e8eb", light: false, neutral: true },
  blue: { hi: "#86b2f4", base: "#3471d6", shade: "#2052a6", deep: "#133670", ink: "#ffffff", light: false, neutral: false },
  navy: { hi: "#5a6fa3", base: "#24345f", shade: "#172342", deep: "#0c1428", ink: "#e8ecf6", light: false, neutral: false },
  green: { hi: "#8fcfab", base: "#3d8c64", shade: "#286a48", deep: "#17442d", ink: "#ffffff", light: false, neutral: false },
  pink: { hi: "#fde0e8", base: "#f1a9bf", shade: "#d9839e", deep: "#ad5a77", ink: "#5a2337", light: true, neutral: false },
  red: { hi: "#f68a80", base: "#d63b3b", shade: "#a82629", deep: "#71181a", ink: "#ffffff", light: false, neutral: false },
  gold: { hi: "#f7e6b5", base: "#d8b36a", shade: "#b18a43", deep: "#7f6129", ink: "#3f2f10", light: true, neutral: false },
  purple: { hi: "#bda8ee", base: "#7c5ac8", shade: "#5a3d9f", deep: "#3a276d", ink: "#ffffff", light: false, neutral: false },
  beige: { hi: "#faf2e4", base: "#e5d4b8", shade: "#c8b28f", deep: "#9c8665", ink: "#4a3b25", light: true, neutral: false },
  gray: { hi: "#d3d7db", base: "#9ba2a9", shade: "#757c84", deep: "#4f555c", ink: "#22262a", light: true, neutral: true },
  orange: { hi: "#fbbd7e", base: "#ef8a2d", shade: "#c8661b", deep: "#8e4511", ink: "#ffffff", light: false, neutral: false },
  yellow: { hi: "#fde89a", base: "#f4c93a", shade: "#d3a418", deep: "#9a740b", ink: "#3d2f05", light: true, neutral: false },
};

export function getFinish(color: DemoArtColor): Finish {
  return { name: color, ...FINISHES[color] };
}

/** Cor representativa (hex) de um acabamento — útil para "swatches" de variante. */
export function demoArtSwatch(color: DemoArtColor): string {
  return FINISHES[color].base;
}

// -----------------------------------------------------------------------------
// Utilitários de cor (hex #rrggbb)
// -----------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(r: number, g: number, b: number): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)).toString(16).slice(1)}`;
}

/** Interpola linearmente duas cores hex (t = 0 ⇒ a; t = 1 ⇒ b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export const lighten = (color: string, t: number) => mix(color, "#ffffff", t);
export const darken = (color: string, t: number) => mix(color, "#000000", t);

/** Neutros de estúdio compartilhados por todas as ilustrações. */
export const STUDIO = {
  backdropCenter: "#ffffff",
  backdropMid: "#f2f4f4",
  backdropEdge: "#e2e7e7",
  shadow: "#0f1a18",
  rubber: "#1d1f22",
  rubberHi: "#4a4e55",
  glass: "#0b0d10",
  chromeHi: "#fbfcfd",
  chromeMid: "#b9c0c7",
  chromeLow: "#6d757e",
} as const;

/** Paleta da marca Mercatto (banners). */
export const BRAND = {
  jade950: "#06362e",
  jade900: "#0a4a3f",
  jade800: "#0b5c4d",
  jade700: "#0e7563",
  jade600: "#13a585",
  jade400: "#4fcfae",
  jade200: "#b5ecdc",
  jade50: "#ecfaf5",
  sun500: "#f5b400",
  sun400: "#ffc93d",
  sun200: "#ffe7a3",
  sun50: "#fff8e5",
  ink: "#16232a",
  paper: "#f7f9f8",
} as const;
