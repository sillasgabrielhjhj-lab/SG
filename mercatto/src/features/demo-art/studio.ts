/**
 * Peças de estúdio compartilhadas: fundo, sombra de contato, materiais
 * (gradientes de acabamento), brilhos, telas com interface abstrata e
 * embalagem genérica (sem texto nem marcas).
 */
import { BRAND, STUDIO, darken, lighten, mix } from "./palette";
import { type Art, circle, d, ellipse, g, path, rect, roundRectPath } from "./svg";

/** Rampa de tons de um material (Finish satisfaz esta interface). */
export interface Tone {
  readonly hi: string;
  readonly base: string;
  readonly shade: string;
  readonly deep: string;
}

export function toneOf(color: string): Tone {
  return { hi: lighten(color, 0.38), base: color, shade: darken(color, 0.24), deep: darken(color, 0.5) };
}

export const RUBBER: Tone = { hi: STUDIO.rubberHi, base: STUDIO.rubber, shade: "#141518", deep: "#08090a" };
export const CHROME: Tone = { hi: STUDIO.chromeHi, base: STUDIO.chromeMid, shade: STUDIO.chromeLow, deep: "#454b52" };
export const WOOD: Tone = { hi: "#d9a876", base: "#b07a48", shade: "#8a5a31", deep: "#5c3a1e" };
export const LEATHER: Tone = { hi: "#b07a52", base: "#7a4a2a", shade: "#5a321b", deep: "#38200f" };
export const SNOW: Tone = { hi: "#ffffff", base: "#f4f5f6", shade: "#dadde1", deep: "#aeb4bb" };

export const UI = { jade: BRAND.jade600, sun: BRAND.sun500, coral: "#ff7a66", sky: "#59a6ff", violet: "#8e72f2" } as const;

// -----------------------------------------------------------------------------
// Fundo e sombra
// -----------------------------------------------------------------------------

export function backdrop(a: Art, w = 800, h = 800): string {
  const fill = a.radU(
    [
      [0, STUDIO.backdropCenter],
      [0.55, STUDIO.backdropMid],
      [1, STUDIO.backdropEdge],
    ],
    w / 2,
    h * 0.42,
    Math.max(w, h) * 0.78,
  );
  const floor = a.linU(
    [
      [0, "#ffffff", 0],
      [1, "#cfd7d6", 0.5],
    ],
    0,
    h * 0.68,
    0,
    h,
  );
  return rect(0, 0, w, h, 0, fill) + rect(0, h * 0.68, w, h * 0.32, 0, floor);
}

/** Sombra de contato suave (duas elipses radiais sobrepostas). */
export function shadow(a: Art, cx: number, cy: number, rx: number, ry: number, strength = 1): string {
  const soft = a.rad([
    [0, STUDIO.shadow, 0.26 * strength],
    [0.55, STUDIO.shadow, 0.1 * strength],
    [1, STUDIO.shadow, 0],
  ]);
  const core = a.rad([
    [0, STUDIO.shadow, 0.5 * strength],
    [1, STUDIO.shadow, 0],
  ]);
  return ellipse(cx, cy, rx, ry, soft) + ellipse(cx, cy + ry * 0.05, rx * 0.72, ry * 0.42, core);
}

// -----------------------------------------------------------------------------
// Materiais
// -----------------------------------------------------------------------------

/** Luz-chave do alto à esquerda: diagonal hi → deep. */
export const diag = (a: Art, t: Tone, x2 = 1, y2 = 1) =>
  a.lin(
    [
      [0, t.hi],
      [0.32, t.base],
      [0.8, t.shade],
      [1, t.deep],
    ],
    0,
    0,
    x2,
    y2,
  );

/** Vertical: topo iluminado → base sombreada. */
export const vert = (a: Art, t: Tone) =>
  a.lin([
    [0, t.hi],
    [0.22, t.base],
    [0.82, t.shade],
    [1, t.deep],
  ]);

/** Superfície quase plana com leve degradê. */
export const flat = (a: Art, t: Tone, x2 = 0.6, y2 = 1) =>
  a.lin(
    [
      [0, mix(t.hi, t.base, 0.45)],
      [1, mix(t.base, t.shade, 0.35)],
    ],
    0,
    0,
    x2,
    y2,
  );

/** Cilindro com eixo vertical (sombreamento varia em x). */
export const cylX = (a: Art, t: Tone) =>
  a.lin(
    [
      [0, t.shade],
      [0.14, t.base],
      [0.34, t.hi],
      [0.58, t.base],
      [0.88, t.shade],
      [1, t.deep],
    ],
    0,
    0,
    1,
    0,
  );

/** Cilindro com eixo horizontal (sombreamento varia em y). */
export const cylY = (a: Art, t: Tone) =>
  a.lin([
    [0, t.shade],
    [0.16, t.base],
    [0.36, t.hi],
    [0.6, t.base],
    [0.9, t.shade],
    [1, t.deep],
  ]);

/** Esfera/cúpula com realce no alto à esquerda. */
export const dome = (a: Art, t: Tone) =>
  a.rad(
    [
      [0, t.hi],
      [0.35, t.base],
      [0.85, t.shade],
      [1, t.deep],
    ],
    0.38,
    0.32,
    0.75,
  );

/** Faixa de brilho (branco translúcido → transparente). */
export function sheen(a: Art, dd: string, opacity = 0.5, x2 = 0.6, y2 = 1): string {
  return path(
    dd,
    a.lin(
      [
        [0, "#ffffff", opacity],
        [1, "#ffffff", 0],
      ],
      0,
      0,
      x2,
      y2,
    ),
  );
}

/** Luz de recorte: contorno com degradê branco forte no alto/esquerda. */
export function rimLight(a: Art, dd: string, opacity = 0.7, width = 2): string {
  return path(dd, "none", {
    stroke: a.lin(
      [
        [0, "#ffffff", opacity],
        [0.45, "#ffffff", 0],
      ],
      0,
      0,
      1,
      1,
    ),
    "stroke-width": width,
  });
}

/** Sombra interna/oclusão: preto translúcido → transparente. */
export function occlusion(a: Art, dd: string, opacity = 0.35, x1 = 0, y1 = 1, x2 = 0, y2 = 0): string {
  return path(
    dd,
    a.lin(
      [
        [0, "#000000", opacity],
        [1, "#000000", 0],
      ],
      x1,
      y1,
      x2,
      y2,
    ),
  );
}

/** Contorno sutil para acabamentos claros não sumirem no fundo claro. */
export const edge = (t: Tone, opacity = 0.35) => ({ stroke: t.deep, "stroke-opacity": opacity, "stroke-width": 1.5 });

/**
 * Bloco 3/4 (eletrodomésticos): face frontal (x,y,w,h) + lateral direita e
 * topo deslocados por (dx, -dy). Retorna só as faces lateral e superior; a
 * frontal fica a cargo do chamador (para detalhes específicos).
 */
export function cuboidBack(a: Art, t: Tone, x: number, y: number, w: number, h: number, dx: number, dy: number, r = 10): string {
  const top = d`M${x + r} ${y}L${x + r + dx} ${y - dy}H${x + w + dx - r * 0.6}Q${x + w + dx} ${y - dy} ${x + w + dx} ${y - dy + r * 0.6}L${x + w} ${y + r}V${y}Z`;
  const side = d`M${x + w} ${y + r}L${x + w + dx} ${y - dy + r * 0.6}V${y + h - dy - r * 0.6}L${x + w} ${y + h - r}Z`;
  return (
    path(top, a.lin([
      [0, t.hi],
      [1, mix(t.hi, t.base, 0.6)],
    ], 0, 1, 1, 0)) +
    path(side, a.lin([
      [0, t.shade],
      [1, t.deep],
    ], 0, 0, 1, 0)) +
    path(d`M${x + r} ${y}L${x + r + dx} ${y - dy}`, "none", { stroke: "#ffffff", "stroke-opacity": 0.5, "stroke-width": 1.5 })
  );
}

// -----------------------------------------------------------------------------
// Telas com interface abstrata
// -----------------------------------------------------------------------------

export type ScreenKind = "phone" | "tablet" | "desktop" | "tv" | "watch" | "camera";

function wallpaper(a: Art, x: number, y: number, w: number, h: number, dark: boolean): string {
  const base = a.lin(
    dark
      ? [
          [0, "#0b1a24"],
          [1, "#0d2b33"],
        ]
      : [
          [0, "#e9f7f2"],
          [1, "#fdf3dc"],
        ],
    0,
    0,
    0.4,
    1,
  );
  const blob = (cx: number, cy: number, r: number, c: string, o: number) =>
    circle(
      cx,
      cy,
      r,
      a.rad([
        [0, c, o],
        [1, c, 0],
      ]),
    );
  return (
    rect(x, y, w, h, 0, base) +
    blob(x + w * 0.85, y + h * 0.12, Math.max(w, h) * 0.6, UI.jade, dark ? 0.75 : 0.45) +
    blob(x + w * 0.05, y + h * 0.75, Math.max(w, h) * 0.55, UI.violet, dark ? 0.55 : 0.3) +
    blob(x + w * 0.6, y + h * 0.95, Math.max(w, h) * 0.4, UI.sun, dark ? 0.35 : 0.3)
  );
}

function frosted(x: number, y: number, w: number, h: number, r: number, o = 0.14) {
  return rect(x, y, w, h, r, "#ffffff", { "fill-opacity": o, stroke: "#ffffff", "stroke-opacity": o * 1.4, "stroke-width": 1 });
}

function ring(cx: number, cy: number, r: number, sw: number, color: string, frac: number): string {
  const c = 2 * Math.PI * r;
  return (
    circle(cx, cy, r, "none", { stroke: color, "stroke-opacity": 0.22, "stroke-width": sw }) +
    circle(cx, cy, r, "none", {
      stroke: color,
      "stroke-width": sw,
      "stroke-linecap": "round",
      "stroke-dasharray": `${(c * frac).toFixed(1)} ${c.toFixed(1)}`,
      transform: `rotate(-90 ${cx.toFixed(1)} ${cy.toFixed(1)})`,
    })
  );
}

function appIcon(a: Art, x: number, y: number, s: number, c: string): string {
  return rect(
    x,
    y,
    s,
    s,
    s * 0.26,
    a.lin(
      [
        [0, lighten(c, 0.25)],
        [1, darken(c, 0.15)],
      ],
      0,
      0,
      1,
      1,
    ),
  );
}

function bars(x: number, y: number, w: number, h: number, values: readonly number[], color: string): string {
  const bw = w / values.length;
  return values.map((v, i) => rect(x + i * bw + bw * 0.18, y + h * (1 - v), bw * 0.64, h * v, Math.min(4, bw * 0.2), color)).join("");
}

function phoneUI(a: Art, x: number, y: number, w: number, h: number): string {
  const p = w * 0.07;
  const s = (w - p * 2 - p * 0.6 * 3) / 4;
  const icons = [UI.jade, UI.sun, UI.coral, UI.sky, UI.violet, "#3ccf91", "#ff9f43", "#e2e8f0"];
  let out = rect(x + p, y + h * 0.05, w * 0.16, h * 0.012, 3, "#ffffff", { "fill-opacity": 0.85 });
  out += rect(x + w - p - w * 0.14, y + h * 0.05, w * 0.14, h * 0.012, 3, "#ffffff", { "fill-opacity": 0.85 });
  // widget principal
  out += frosted(x + p, y + h * 0.1, w - p * 2, h * 0.2, w * 0.07);
  out += ring(x + p + w * 0.17, y + h * 0.2, w * 0.1, w * 0.035, UI.jade, 0.72);
  out += rect(x + p + w * 0.36, y + h * 0.15, w * 0.34, h * 0.018, 4, "#ffffff", { "fill-opacity": 0.9 });
  out += rect(x + p + w * 0.36, y + h * 0.185, w * 0.22, h * 0.014, 4, "#ffffff", { "fill-opacity": 0.5 });
  out += bars(x + p + w * 0.36, y + h * 0.215, w * 0.4, h * 0.06, [0.4, 0.7, 0.5, 0.9, 0.65, 0.8], UI.sun);
  // dois cards
  const cw = (w - p * 3) / 2;
  out += frosted(x + p, y + h * 0.33, cw, h * 0.12, w * 0.06);
  out += frosted(x + p * 2 + cw, y + h * 0.33, cw, h * 0.12, w * 0.06);
  out += circle(x + p + cw * 0.25, y + h * 0.39, w * 0.045, UI.sun);
  out += rect(x + p * 2 + cw * 1.15, y + h * 0.37, cw * 0.6, h * 0.014, 3, "#ffffff", { "fill-opacity": 0.8 });
  out += rect(x + p * 2 + cw * 1.15, y + h * 0.4, cw * 0.4, h * 0.012, 3, "#ffffff", { "fill-opacity": 0.45 });
  // grade de apps
  for (let i = 0; i < 8; i += 1) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    out += appIcon(a, x + p + col * (s + p * 0.6), y + h * 0.5 + row * (s + h * 0.03), s, icons[i] ?? UI.jade);
  }
  // dock
  out += frosted(x + p * 0.6, y + h * 0.84, w - p * 1.2, s + p * 1.1, w * 0.09, 0.18);
  for (let i = 0; i < 4; i += 1) out += appIcon(a, x + p + i * (s + p * 0.6), y + h * 0.84 + p * 0.55, s, icons[(i + 3) % 8] ?? UI.sky);
  return out;
}

function desktopUI(a: Art, x: number, y: number, w: number, h: number, sidebar: boolean): string {
  let out = "";
  const top = h * 0.07;
  out += rect(x, y, w, top, 0, "#ffffff", { "fill-opacity": 0.1 });
  out += circle(x + top * 0.6, y + top / 2, top * 0.17, "#ff6b5b");
  out += circle(x + top * 1.1, y + top / 2, top * 0.17, "#f5b400");
  out += circle(x + top * 1.6, y + top / 2, top * 0.17, "#2ecc8f");
  out += rect(x + w * 0.35, y + top * 0.28, w * 0.3, top * 0.44, top * 0.22, "#ffffff", { "fill-opacity": 0.14 });
  const sx = sidebar ? w * 0.2 : 0;
  if (sidebar) {
    out += rect(x, y + top, sx, h - top, 0, "#ffffff", { "fill-opacity": 0.07 });
    for (let i = 0; i < 6; i += 1) {
      out += rect(x + w * 0.025, y + top + h * 0.06 + i * h * 0.085, sx * 0.72, h * 0.035, h * 0.012, "#ffffff", {
        "fill-opacity": i === 1 ? 0.35 : 0.13,
      });
    }
  }
  const mx = x + sx + w * 0.03;
  const mw = w - sx - w * 0.06;
  // gráfico de área
  out += frosted(mx, y + top + h * 0.05, mw * 0.64, h * 0.42, h * 0.03, 0.1);
  const cx0 = mx + mw * 0.03;
  const cw = mw * 0.58;
  const cy0 = y + top + h * 0.42;
  const pts = [0.3, 0.42, 0.36, 0.58, 0.5, 0.72, 0.64, 0.86];
  let line = `M${cx0.toFixed(1)} ${(cy0 - pts[0]! * h * 0.3).toFixed(1)}`;
  pts.forEach((v, i) => {
    line += ` L${(cx0 + (cw * i) / (pts.length - 1)).toFixed(1)} ${(cy0 - v * h * 0.3).toFixed(1)}`;
  });
  const area = `${line} L${(cx0 + cw).toFixed(1)} ${cy0.toFixed(1)} L${cx0.toFixed(1)} ${cy0.toFixed(1)}Z`;
  out += path(
    area,
    a.lin([
      [0, UI.jade, 0.7],
      [1, UI.jade, 0.05],
    ]),
  );
  out += path(line, "none", { stroke: "#7ef0cf", "stroke-width": Math.max(1.5, h * 0.008), "stroke-linejoin": "round" });
  // cards à direita
  const rx = mx + mw * 0.67;
  const rw = mw * 0.33;
  out += frosted(rx, y + top + h * 0.05, rw, h * 0.2, h * 0.03, 0.12);
  out += ring(rx + rw * 0.3, y + top + h * 0.15, h * 0.055, h * 0.022, UI.sun, 0.66);
  out += rect(rx + rw * 0.55, y + top + h * 0.12, rw * 0.35, h * 0.022, 3, "#ffffff", { "fill-opacity": 0.75 });
  out += rect(rx + rw * 0.55, y + top + h * 0.16, rw * 0.24, h * 0.018, 3, "#ffffff", { "fill-opacity": 0.4 });
  out += frosted(rx, y + top + h * 0.27, rw, h * 0.2, h * 0.03, 0.12);
  out += bars(rx + rw * 0.08, y + top + h * 0.3, rw * 0.84, h * 0.14, [0.5, 0.8, 0.6, 1, 0.7], UI.violet);
  // linha de cards inferior
  const bw = (mw - w * 0.04) / 3;
  const cols = [UI.coral, UI.sky, UI.sun];
  for (let i = 0; i < 3; i += 1) {
    const bx = mx + i * (bw + w * 0.02);
    out += frosted(bx, y + top + h * 0.52, bw, h * 0.3, h * 0.03, 0.1);
    out += rect(bx + bw * 0.08, y + top + h * 0.56, bw * 0.84, h * 0.13, h * 0.02, a.lin([
      [0, cols[i] ?? UI.sky, 0.95],
      [1, darken(cols[i] ?? UI.sky, 0.3), 0.9],
    ], 0, 0, 1, 1));
    out += rect(bx + bw * 0.08, y + top + h * 0.72, bw * 0.6, h * 0.022, 3, "#ffffff", { "fill-opacity": 0.7 });
    out += rect(bx + bw * 0.08, y + top + h * 0.76, bw * 0.4, h * 0.018, 3, "#ffffff", { "fill-opacity": 0.35 });
  }
  return out;
}

function tvUI(a: Art, x: number, y: number, w: number, h: number): string {
  const sky = a.lin([
    [0, "#1b2a4a"],
    [0.45, "#e0766a"],
    [0.75, "#f7c46c"],
    [1, "#f2dca2"],
  ]);
  let out = rect(x, y, w, h, 0, sky);
  out += circle(x + w * 0.66, y + h * 0.52, h * 0.12, "#fff3c9", { "fill-opacity": 0.95 });
  out += circle(x + w * 0.66, y + h * 0.52, h * 0.26, a.rad([
    [0, "#ffe7a3", 0.6],
    [1, "#ffe7a3", 0],
  ]));
  const ridge = (base: number, amp: number, color: string, phase: number) => {
    let dd = `M${x.toFixed(1)} ${(y + h).toFixed(1)}`;
    for (let i = 0; i <= 12; i += 1) {
      const px = x + (w * i) / 12;
      const py = y + h * (base - amp * Math.abs(Math.sin(i * 0.9 + phase)));
      dd += ` L${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    return path(`${dd} L${(x + w).toFixed(1)} ${(y + h).toFixed(1)}Z`, color);
  };
  out += ridge(0.66, 0.12, "#7d5a7a", 0.4);
  out += ridge(0.76, 0.1, "#4c3a5c", 1.7);
  out += ridge(0.88, 0.07, "#22203a", 2.6);
  // trilho de miniaturas (app de streaming abstrato)
  out += rect(x, y + h * 0.72, w, h * 0.28, 0, a.lin([
    [0, "#0b0d12", 0],
    [1, "#0b0d12", 0.85],
  ]));
  const tw = w * 0.17;
  const cols = [UI.jade, UI.coral, UI.violet, UI.sky, UI.sun];
  for (let i = 0; i < 5; i += 1) {
    out += rect(x + w * 0.04 + i * (tw + w * 0.02), y + h * 0.8, tw, h * 0.14, h * 0.015, a.lin([
      [0, lighten(cols[i] ?? UI.sky, 0.2)],
      [1, darken(cols[i] ?? UI.sky, 0.35)],
    ], 0, 0, 1, 1), i === 0 ? { stroke: "#ffffff", "stroke-width": Math.max(2, h * 0.008) } : {});
  }
  out += rect(x + w * 0.04, y + h * 0.12, w * 0.28, h * 0.05, h * 0.01, "#ffffff", { "fill-opacity": 0.9 });
  out += rect(x + w * 0.04, y + h * 0.2, w * 0.2, h * 0.025, h * 0.01, "#ffffff", { "fill-opacity": 0.6 });
  out += rect(x + w * 0.04, y + h * 0.27, w * 0.1, h * 0.06, h * 0.03, UI.sun);
  return out;
}

function watchUI(a: Art, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h * 0.47;
  const r = Math.min(w, h) * 0.3;
  let out = rect(x, y, w, h, 0, "#050607");
  out += ring(cx, cy, r, r * 0.17, "#ff4f6d", 0.78);
  out += ring(cx, cy, r * 0.76, r * 0.17, "#a6f04a", 0.6);
  out += ring(cx, cy, r * 0.52, r * 0.17, "#3fd6f2", 0.88);
  out += rect(x + w * 0.12, y + h * 0.83, w * 0.26, h * 0.035, 3, "#ffffff", { "fill-opacity": 0.85 });
  out += rect(x + w * 0.62, y + h * 0.83, w * 0.26, h * 0.035, 3, UI.jade);
  out += rect(x + w * 0.35, y + h * 0.07, w * 0.3, h * 0.04, 3, "#ffffff", { "fill-opacity": 0.9 });
  void a;
  return out;
}

function cameraUI(a: Art, x: number, y: number, w: number, h: number): string {
  // estrada vista por uma dashcam
  let out = rect(x, y, w, h * 0.55, 0, a.lin([
    [0, "#8fc2ea"],
    [1, "#dcecf5"],
  ]));
  out += rect(x, y + h * 0.55, w, h * 0.45, 0, "#3a4047");
  out += path(d`M${x + w * 0.42} ${y + h * 0.55}L${x + w * 0.58} ${y + h * 0.55}L${x + w * 0.95} ${y + h}L${x + w * 0.05} ${y + h}Z`, "#565d66");
  out += path(d`M${x + w * 0.495} ${y + h * 0.6}L${x + w * 0.505} ${y + h * 0.6}L${x + w * 0.52} ${y + h * 0.72}L${x + w * 0.48} ${y + h * 0.72}Z`, "#f4f1e6");
  out += path(d`M${x + w * 0.488} ${y + h * 0.8}L${x + w * 0.512} ${y + h * 0.8}L${x + w * 0.53} ${y + h * 0.97}L${x + w * 0.47} ${y + h * 0.97}Z`, "#f4f1e6");
  out += path(d`M${x} ${y + h * 0.55}L${x + w * 0.2} ${y + h * 0.42}L${x + w * 0.34} ${y + h * 0.55}Z`, "#4f7a5a");
  out += path(d`M${x + w * 0.62} ${y + h * 0.55}L${x + w * 0.82} ${y + h * 0.38}L${x + w} ${y + h * 0.5}V${y + h * 0.55}Z`, "#5d8a68");
  out += circle(x + w * 0.08, y + h * 0.1, h * 0.035, "#ff4f4f");
  out += rect(x + w * 0.6, y + h * 0.06, w * 0.34, h * 0.07, 3, "#000000", { "fill-opacity": 0.35 });
  return out;
}

/** Tela com interface abstrata elegante, recortada no retângulo arredondado. */
export function screen(a: Art, x: number, y: number, w: number, h: number, r: number, kind: ScreenKind): string {
  const clip = a.clip(path(roundRectPath(x, y, w, h, r), "#000"));
  let content: string;
  switch (kind) {
    case "phone":
      content = wallpaper(a, x, y, w, h, true) + phoneUI(a, x, y, w, h);
      break;
    case "tablet":
      content = wallpaper(a, x, y, w, h, true) + desktopUI(a, x, y, w, h, true);
      break;
    case "desktop":
      content = wallpaper(a, x, y, w, h, true) + desktopUI(a, x, y, w, h, true);
      break;
    case "tv":
      content = tvUI(a, x, y, w, h);
      break;
    case "watch":
      content = watchUI(a, x, y, w, h);
      break;
    case "camera":
      content = cameraUI(a, x, y, w, h);
      break;
  }
  const glare = path(
    d`M${x} ${y}H${x + w * 0.62}L${x + w * 0.28} ${y + h}H${x}Z`,
    a.lin(
      [
        [0, "#ffffff", 0.16],
        [1, "#ffffff", 0.02],
      ],
      0,
      0,
      1,
      1,
    ),
  );
  return g(content + glare, { "clip-path": clip });
}

/** Vidro escuro de tela desligada / lente. */
export const darkGlass = (a: Art) =>
  a.lin(
    [
      [0, "#2a2f36"],
      [0.5, "#0d0f12"],
      [1, "#050607"],
    ],
    0,
    0,
    1,
    1,
  );

/** Lente de câmera (círculos concêntricos com reflexo). */
export function lens(a: Art, cx: number, cy: number, r: number, ring: Tone = CHROME): string {
  return (
    circle(cx, cy, r, diag(a, ring)) +
    circle(cx, cy, r * 0.82, "#08090b") +
    circle(cx, cy, r * 0.62, a.rad([
      [0, "#3a5b8c"],
      [0.5, "#16213a"],
      [1, "#05070b"],
    ], 0.42, 0.4, 0.6)) +
    circle(cx, cy, r * 0.28, "#020304") +
    ellipse(cx - r * 0.22, cy - r * 0.24, r * 0.16, r * 0.1, "#ffffff", { "fill-opacity": 0.75, transform: `rotate(-35 ${(cx - r * 0.22).toFixed(1)} ${(cy - r * 0.24).toFixed(1)})` }) +
    circle(cx + r * 0.25, cy + r * 0.22, r * 0.05, "#9fd0ff", { "fill-opacity": 0.6 })
  );
}

// -----------------------------------------------------------------------------
// Embalagem genérica (caixa 3/4, sem texto)
// -----------------------------------------------------------------------------

export function packageBox(a: Art, t: Tone, x: number, y: number, w: number, h: number, depth: number): string {
  const dx = depth * 0.9;
  const dy = depth * 0.5;
  const front = a.lin([
    [0, "#ffffff"],
    [1, "#eceff1"],
  ], 0, 0, 0.4, 1);
  let out = shadow(a, x + w / 2 + dx * 0.5, y + h + 4, w * 0.75 + dx, 26);
  out += path(d`M${x} ${y}L${x + dx} ${y - dy}H${x + w + dx}L${x + w} ${y}Z`, a.lin([
    [0, "#ffffff"],
    [1, "#f1f3f4"],
  ]), { stroke: "#c9cfd4", "stroke-width": 1 });
  out += path(d`M${x + w} ${y}L${x + w + dx} ${y - dy}V${y + h - dy}L${x + w} ${y + h}Z`, a.lin([
    [0, "#d8dde1"],
    [1, "#b9c0c6"],
  ]));
  out += rect(x, y, w, h, 0, front, { stroke: "#cdd3d8", "stroke-width": 1 });
  // faixa colorida + painel na lateral
  out += rect(x, y + h * 0.7, w, h * 0.3, 0, diag(a, t, 1, 0.4));
  out += path(d`M${x + w} ${y + h * 0.7}L${x + w + dx} ${y + h * 0.7 - dy}V${y + h - dy}L${x + w} ${y + h}Z`, t.deep);
  out += path(d`M${x + w * 0.1} ${y + h * 0.7}L${x + w * 0.3} ${y + h * 0.7}L${x + w * 0.18} ${y + h}H${x - 0.01}L${x} ${y + h * 0.88}Z`, "#ffffff", {
    "fill-opacity": 0.18,
  });
  // selo geométrico abstrato
  out += circle(x + w * 0.16, y + h * 0.12, Math.min(w, h) * 0.045, BRAND.jade600);
  out += rect(x + w * 0.24, y + h * 0.105, w * 0.22, h * 0.03, 2, "#c8ced3");
  out += sheen(a, d`M${x} ${y}H${x + w * 0.5}L${x + w * 0.2} ${y + h * 0.7}H${x}Z`, 0.35);
  return out;
}
