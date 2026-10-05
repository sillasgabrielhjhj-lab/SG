/**
 * Banners de DEMONSTRAÇÃO (1600×600, sem texto): fundo nas cores da marca,
 * formas geométricas e produtos ilustrados agrupados à direita. A metade
 * esquerda fica limpa para receber título/CTA em HTML (ver DEMO_BANNER_TONES).
 */
import type { DemoArtColor, DemoArtKind, DemoArtView, DemoBannerName } from "./catalog";
import { KIND_DRAWERS } from "./kinds";
import { BRAND, getFinish } from "./palette";
import { type Art, circle, d, g, path, place, rect } from "./svg";

const W = 1600;
const H = 600;

interface Placement {
  readonly kind: DemoArtKind;
  readonly color: DemoArtColor;
  readonly view?: DemoArtView;
  /** Centro do produto no banner e escala relativa ao quadro 800×800. */
  readonly x: number;
  readonly y: number;
  readonly s: number;
}

function product(a: Art, p: Placement): string {
  const draw = KIND_DRAWERS[p.kind];
  return place(g(draw(a, getFinish(p.color), p.view ?? "1"), { transform: "translate(-400 -400)" }), p.x, p.y, p.s);
}

function glow(a: Art, cx: number, cy: number, r: number, color: string, opacity: number): string {
  return circle(
    cx,
    cy,
    r,
    a.rad([
      [0, color, opacity],
      [1, color, 0],
    ]),
  );
}

function dots(a: Art, x: number, y: number, w: number, h: number, color: string, opacity: number): string {
  return rect(x, y, w, h, 0, a.pattern(22, 22, circle(3, 3, 2.2, color, { "fill-opacity": opacity })));
}

function stripes(a: Art, x: number, y: number, w: number, h: number, color: string, opacity: number): string {
  return rect(x, y, w, h, 0, a.pattern(36, 36, rect(0, 0, 14, 36, 0, color, { "fill-opacity": opacity }), "rotate(-30)"));
}

function background(a: Art, stops: readonly (readonly [number, string])[]): string {
  return rect(0, 0, W, H, 0, a.lin(stops, 0, 0, 1, 0.3));
}

const BANNERS: Readonly<Record<DemoBannerName, (a: Art) => string>> = {
  tech: (a) =>
    background(a, [
      [0, BRAND.jade950],
      [0.55, BRAND.jade900],
      [1, BRAND.jade800],
    ]) +
    glow(a, 1180, 300, 520, BRAND.jade600, 0.55) +
    circle(1190, 310, 250, "none", { stroke: BRAND.jade400, "stroke-opacity": 0.35, "stroke-width": 2 }) +
    circle(1190, 310, 330, "none", { stroke: BRAND.jade400, "stroke-opacity": 0.15, "stroke-width": 2, "stroke-dasharray": "4 10" }) +
    circle(1190, 310, 200, BRAND.jade700, { "fill-opacity": 0.55 }) +
    dots(a, 1400, 40, 180, 130, BRAND.jade200, 0.35) +
    circle(1460, 470, 26, BRAND.sun500) +
    circle(930, 120, 10, BRAND.sun400) +
    product(a, { kind: "laptop", color: "silver", x: 1160, y: 330, s: 0.62 }) +
    product(a, { kind: "smartphone", color: "graphite", x: 1430, y: 340, s: 0.48 }) +
    product(a, { kind: "smartwatch", color: "black", x: 935, y: 380, s: 0.34 }) +
    product(a, { kind: "earbuds", color: "white", x: 1300, y: 500, s: 0.32 }),

  home: (a) =>
    background(a, [
      [0, BRAND.paper],
      [0.6, BRAND.jade50],
      [1, "#dff4ec"],
    ]) +
    path(d`M960 600V300Q960 110 1150 110H1290Q1480 110 1480 300V600Z`, BRAND.sun200, { "fill-opacity": 0.85 }) +
    circle(1500, 120, 90, BRAND.jade200, { "fill-opacity": 0.8 }) +
    dots(a, 860, 420, 140, 140, BRAND.jade600, 0.25) +
    rect(0, 540, W, 60, 0, a.lin([
      [0, "#ffffff", 0],
      [1, BRAND.jade200, 0.35],
    ])) +
    product(a, { kind: "refrigerator", color: "silver", x: 1180, y: 300, s: 0.62 }) +
    product(a, { kind: "coffeemaker", color: "red", x: 1430, y: 395, s: 0.4 }) +
    product(a, { kind: "airfryer", color: "black", x: 980, y: 410, s: 0.38 }) +
    product(a, { kind: "blender", color: "white", x: 1530, y: 420, s: 0.32 }),

  fashion: (a) =>
    background(a, [
      [0, BRAND.sun50],
      [1, "#fde9d2"],
    ]) +
    circle(1230, 300, 260, BRAND.jade200, { "fill-opacity": 0.7 }) +
    rect(1330, 70, 230, 230, 40, BRAND.sun200, { transform: "rotate(18 1445 185)" }) +
    circle(960, 120, 46, "none", { stroke: BRAND.jade600, "stroke-width": 3, "stroke-opacity": 0.6 }) +
    dots(a, 1440, 420, 140, 140, BRAND.jade800, 0.22) +
    product(a, { kind: "backpack", color: "navy", x: 1060, y: 300, s: 0.48 }) +
    product(a, { kind: "sneaker", color: "red", x: 1290, y: 360, s: 0.62 }) +
    product(a, { kind: "sunglasses", color: "black", x: 1460, y: 210, s: 0.36 }) +
    product(a, { kind: "wristwatch", color: "gold", x: 1490, y: 440, s: 0.3 }),

  flash: (a) =>
    background(a, [
      [0, BRAND.sun200],
      [0.45, BRAND.sun400],
      [1, BRAND.sun500],
    ]) +
    stripes(a, 860, 0, 740, H, "#ffffff", 0.18) +
    circle(1210, 310, 240, BRAND.jade800) +
    circle(1210, 310, 240, "none", { stroke: "#ffffff", "stroke-opacity": 0.6, "stroke-width": 4, "stroke-dasharray": "2 12" }) +
    path("M1010 40L930 250H990L950 400L1080 190H1015L1060 40Z", BRAND.jade900, { "fill-opacity": 0.9 }) +
    path("M1520 420L1480 520H1510L1490 590L1555 490H1522L1545 420Z", "#ffffff", { "fill-opacity": 0.75 }) +
    product(a, { kind: "headphones", color: "white", x: 1200, y: 300, s: 0.5 }) +
    product(a, { kind: "smartphone", color: "blue", x: 1420, y: 330, s: 0.44 }) +
    product(a, { kind: "speaker", color: "orange", x: 1010, y: 400, s: 0.36 }),

  games: (a) => {
    let grid = "";
    for (let i = 0; i <= 14; i += 1) grid += d`M${1200 + (i - 7) * 26} 330L${1200 + (i - 7) * 130} 640`;
    for (let i = 0; i < 6; i += 1) grid += d`M820 ${360 + i * i * 9}H1600`;
    return (
      background(a, [
        [0, BRAND.ink],
        [0.6, "#13222d"],
        [1, BRAND.jade950],
      ]) +
      glow(a, 1200, 300, 460, "#7c5ac8", 0.45) +
      glow(a, 1380, 420, 300, BRAND.jade600, 0.4) +
      path(grid, "none", { stroke: BRAND.jade400, "stroke-opacity": 0.22, "stroke-width": 1.5 }) +
      path("M1000 110L1040 70L1080 110L1040 150Z", "none", { stroke: BRAND.sun400, "stroke-width": 3 }) +
      circle(1520, 110, 22, "none", { stroke: "#ff7a66", "stroke-width": 3 }) +
      path("M1460 520h40M1480 500v40", "none", { stroke: BRAND.jade400, "stroke-width": 3 }) +
      product(a, { kind: "console", color: "white", x: 1200, y: 300, s: 0.6 }) +
      product(a, { kind: "headset", color: "black", x: 1440, y: 300, s: 0.46 }) +
      product(a, { kind: "controller", color: "red", x: 1110, y: 470, s: 0.4 })
    );
  },

  official: (a) =>
    background(a, [
      [0, BRAND.jade950],
      [0.5, BRAND.jade900],
      [1, BRAND.jade800],
    ]) +
    glow(a, 1220, 280, 480, BRAND.jade600, 0.4) +
    path(d`M880 600A360 360 0 0 1 1600 600`, "none", { stroke: BRAND.sun500, "stroke-width": 3, "stroke-opacity": 0.7 }) +
    path(d`M940 600A300 300 0 0 1 1540 600`, "none", { stroke: BRAND.sun400, "stroke-width": 1.5, "stroke-opacity": 0.4 }) +
    circle(1500, 110, 54, "none", { stroke: BRAND.sun400, "stroke-width": 4 }) +
    path("M1478 110L1494 126L1524 94", "none", { stroke: BRAND.sun400, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }) +
    dots(a, 860, 60, 160, 120, BRAND.sun200, 0.25) +
    product(a, { kind: "tv", color: "black", x: 1180, y: 270, s: 0.6 }) +
    product(a, { kind: "soundbar", color: "graphite", x: 1180, y: 470, s: 0.5 }) +
    product(a, { kind: "smartphone", color: "gold", x: 1450, y: 380, s: 0.4 }) +
    product(a, { kind: "perfume", color: "purple", x: 960, y: 420, s: 0.34 }),
};

export function bannerBody(a: Art, name: DemoBannerName): string {
  return BANNERS[name](a);
}

export { W as BANNER_W, H as BANNER_H };
