/**
 * Gerador das ilustrações vetoriais de DEMONSTRAÇÃO (isomórfico, sem
 * dependências). Produz SVGs autossuficientes — sem <script>, sem href
 * externo, sem texto de marcas — com ids prefixados por
 * `${kind}-${color}-${view}` para permitir vários SVGs inline na mesma página.
 */
import { bannerBody, BANNER_H, BANNER_W } from "./banner";
import {
  DEMO_ART_SIZE,
  type DemoArtColor,
  type DemoArtKind,
  type DemoArtView,
  type DemoBannerName,
  isDemoArtColor,
  isDemoArtKind,
  isDemoArtView,
  isDemoBannerName,
} from "./catalog";
import { KIND_DRAWERS } from "./kinds";
import { getFinish } from "./palette";
import { backdrop } from "./studio";
import { Art, svgDocument } from "./svg";

export interface RenderProductInput {
  readonly kind: DemoArtKind | (string & {});
  readonly color: DemoArtColor | (string & {});
  readonly view?: DemoArtView | (string & {});
}

/** SVG 800×800 de um produto demo em fundo de estúdio. Lança erro se algum parâmetro for inválido. */
export function renderProductSvg({ kind, color, view = "1" }: RenderProductInput): string {
  if (!isDemoArtKind(kind)) throw new Error(`demo-art: tipo de produto inválido: "${kind}"`);
  if (!isDemoArtColor(color)) throw new Error(`demo-art: cor inválida: "${color}"`);
  if (!isDemoArtView(view)) throw new Error(`demo-art: vista inválida: "${view}"`);
  const a = new Art(`${kind}-${color}-${view}`);
  const body = backdrop(a, DEMO_ART_SIZE, DEMO_ART_SIZE) + KIND_DRAWERS[kind](a, getFinish(color), view);
  return svgDocument(a, DEMO_ART_SIZE, DEMO_ART_SIZE, body);
}

/** Banner 1600×600 sem texto (metade esquerda livre para título/CTA). Lança erro se o nome for inválido. */
export function renderBannerSvg(name: DemoBannerName | (string & {})): string {
  if (!isDemoBannerName(name)) throw new Error(`demo-art: banner inválido: "${name}"`);
  const a = new Art(`banner-${name}`);
  return svgDocument(a, BANNER_W, BANNER_H, bannerBody(a, name));
}
