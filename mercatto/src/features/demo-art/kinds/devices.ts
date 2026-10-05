/** Smartphone, tablet, laptop, monitor, TV e smartwatch. */
import { type Finish, mix } from "../palette";
import { SNOW, cylX, cylY, diag, edge, flat, lens, rimLight, screen, shadow, sheen } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, roundRectPath, reuse } from "../svg";
import { drawKeyboard, drawMouse } from "./peripherals";
import { drawSoundbar } from "./audio";
import type { DrawKind } from "./types";

// -----------------------------------------------------------------------------
// Smartphone
// -----------------------------------------------------------------------------

function phoneFront(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  const r = w * 0.17;
  let out = path(roundRectPath(x + 9, y + 5, w, h, r), a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0));
  out += rect(x - 4, y + h * 0.19, 7, h * 0.05, 3, f.shade);
  out += rect(x - 4, y + h * 0.27, 7, h * 0.09, 3, f.shade);
  out += rect(x - 4, y + h * 0.38, 7, h * 0.09, 3, f.shade);
  out += rect(x + w + 6, y + h * 0.27, 7, h * 0.13, 3, f.deep);
  out += path(roundRectPath(x, y, w, h, r), diag(a, f), edge(f, f.light ? 0.55 : 0.2));
  out += rimLight(a, roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5), 0.8);
  out += path(roundRectPath(x + 5, y + 5, w - 10, h - 10, r - 5), "#06070a");
  out += screen(a, x + 13, y + 13, w - 26, h - 26, r - 13, "phone");
  out += rect(x + w / 2 - w * 0.15, y + 27, w * 0.3, h * 0.044, h * 0.022, "#000000");
  out += circle(x + w / 2 + w * 0.09, y + 27 + h * 0.022, h * 0.008, "#1d2c48");
  return out;
}

function phoneBack(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  const r = w * 0.17;
  let out = path(roundRectPath(x - 9, y + 5, w, h, r), a.lin([
    [0, f.deep],
    [1, f.shade],
  ], 0, 0, 1, 0));
  out += rect(x + w - 3, y + h * 0.27, 7, h * 0.09, 3, f.shade);
  out += rect(x + w - 3, y + h * 0.38, 7, h * 0.09, 3, f.shade);
  out += rect(x - 13, y + h * 0.27, 7, h * 0.13, 3, f.deep);
  out += path(roundRectPath(x, y, w, h, r), diag(a, f), edge(f, f.light ? 0.55 : 0.2));
  out += path(roundRectPath(x + 5, y + 5, w - 10, h - 10, r - 5), a.lin([
    [0, mix(f.hi, f.base, 0.35)],
    [0.55, f.base],
    [1, mix(f.base, f.shade, 0.7)],
  ], 0, 0, 1, 1));
  const m = w * 0.46;
  const mx = x + w * 0.07;
  const my = y + w * 0.07;
  out += rect(mx + 4, my + 6, m, m, m * 0.27, f.deep, { "fill-opacity": 0.35 });
  out += rect(mx, my, m, m, m * 0.27, a.lin([
    [0, f.hi],
    [0.6, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, 0.4));
  out += lens(a, mx + m * 0.29, my + m * 0.29, m * 0.2, f);
  out += lens(a, mx + m * 0.29, my + m * 0.71, m * 0.2, f);
  out += lens(a, mx + m * 0.71, my + m * 0.5, m * 0.2, f);
  out += circle(mx + m * 0.73, my + m * 0.17, m * 0.07, a.rad([
    [0, "#fffbe8"],
    [1, "#d8c98f"],
  ]));
  out += circle(mx + m * 0.73, my + m * 0.83, m * 0.03, f.deep);
  out += sheen(a, d`M${x + w * 0.55} ${y + 5}H${x + w * 0.85}L${x + w * 0.2} ${y + h - 5}H${x + 5}V${y + h * 0.75}Z`, 0.22, 1, 1);
  out += rimLight(a, roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5), 0.7);
  return out;
}

export const drawSmartphone: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 404, 712, 200, 24) + phoneFront(a, f, 255, 95, 290, 600);
  if (view === "2") return shadow(a, 396, 712, 200, 24) + phoneBack(a, f, 255, 95, 290, 600);
  return (
    shadow(a, 400, 705, 300, 30) +
    place(phoneBack(a, f, -145, -300, 290, 600), 305, 385, 0.8, -9) +
    place(phoneFront(a, f, -145, -300, 290, 600), 490, 415, 0.8, 7)
  );
};

// -----------------------------------------------------------------------------
// Tablet
// -----------------------------------------------------------------------------

function tabletFront(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  const r = Math.min(w, h) * 0.07;
  let out = path(roundRectPath(x + 4, y + 9, w, h, r), a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  out += path(roundRectPath(x, y, w, h, r), diag(a, f), edge(f, f.light ? 0.55 : 0.2));
  out += rimLight(a, roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5), 0.8);
  out += path(roundRectPath(x + 4, y + 4, w - 8, h - 8, r - 4), "#06070a");
  const b = Math.min(w, h) * 0.045;
  out += screen(a, x + b, y + b, w - b * 2, h - b * 2, r - b, "tablet");
  out += circle(w > h ? x + w / 2 : x + b / 2 + 2, w > h ? y + b / 2 + 2 : y + h / 2, 3, "#1b2638");
  return out;
}

function tabletBack(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  const r = Math.min(w, h) * 0.07;
  let out = path(roundRectPath(x - 8, y + 6, w, h, r), a.lin([
    [0, f.deep],
    [1, f.shade],
  ], 0, 0, 1, 0));
  out += path(roundRectPath(x, y, w, h, r), a.lin([
    [0, f.hi],
    [0.3, mix(f.hi, f.base, 0.5)],
    [0.75, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, f.light ? 0.55 : 0.2));
  out += rimLight(a, roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5), 0.8);
  const m = w * 0.15;
  out += rect(x + 24, y + 24, m, m * 1.25, m * 0.32, a.lin([
    [0, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, 0.5));
  out += lens(a, x + 24 + m / 2, y + 24 + m * 0.42, m * 0.3, f);
  out += circle(x + 24 + m / 2, y + 24 + m * 0.98, m * 0.09, "#efe6c4");
  for (let i = -1; i <= 1; i += 1) out += circle(x + w / 2 + i * 14, y + h - 10, 3.2, f.deep);
  out += sheen(a, d`M${x + w * 0.45} ${y}H${x + w * 0.75}L${x + w * 0.2} ${y + h}H${x}V${y + h * 0.82}Z`, 0.2, 1, 1);
  return out;
}

function stylus(a: Art, len: number): string {
  return (
    path(d`M0 -9L-38 -2Q-44 0 -38 2L0 9Z`, a.lin([
      [0, "#f5f6f7"],
      [1, "#b9bfc5"],
    ])) +
    path(d`M-36 -2.4L-46 0L-36 2.4Z`, "#5b6168") +
    rect(0, -9, len, 18, 9, cylY(a, SNOW), edge(SNOW, 0.5)) +
    rect(len * 0.08, -9, len * 0.6, 3, 1.5, "#ffffff", { "fill-opacity": 0.8 }) +
    rect(len - 26, -9, 2, 18, 0, "#c9ced3")
  );
}

export const drawTablet: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 400, 625, 330, 26) + tabletFront(a, f, 95, 185, 610, 425);
  if (view === "2") return shadow(a, 395, 715, 250, 26) + tabletBack(a, f, 205, 105, 390, 580);
  return (
    shadow(a, 380, 700, 280, 28) +
    place(tabletFront(a, f, -190, -280, 380, 560), 360, 390, 1, -6) +
    shadow(a, 560, 698, 150, 10, 0.9) +
    place(stylus(a, 300), 445, 680, 1, -18)
  );
};

// -----------------------------------------------------------------------------
// Laptop
// -----------------------------------------------------------------------------

function laptopOpen(a: Art, f: Finish): string {
  const L0 = 178;
  const R0 = 622;
  const y0 = 470;
  const L1 = 104;
  const R1 = 696;
  const y1 = 560;
  const pt = (u: number, v: number) => {
    const xl = L0 + v * (L1 - L0);
    const xr = R0 + v * (R1 - R0);
    return d`${xl + u * (xr - xl)} ${y0 + v * (y1 - y0)}`;
  };
  const quad = (u0: number, v0: number, u1: number, v1: number) => `M${pt(u0, v0)}L${pt(u1, v0)}L${pt(u1, v1)}L${pt(u0, v1)}Z`;
  let out = shadow(a, 400, 578, 330, 26);
  out += rect(L0, 148, R0 - L0, 326, 18, diag(a, f), edge(f, f.light ? 0.5 : 0.2));
  out += rect(L0 + 6, 154, R0 - L0 - 12, 314, 13, "#07080a");
  out += screen(a, L0 + 16, 166, R0 - L0 - 32, 280, 5, "desktop");
  out += circle(400, 160, 2.5, "#22314a");
  out += rect(L0 + 14, 466, R0 - L0 - 28, 8, 4, f.deep);
  out += path(quad(0, 0, 1, 1), a.lin([
    [0, f.base],
    [1, mix(f.hi, f.base, 0.25)],
  ]), edge(f, f.light ? 0.5 : 0.15));
  out += path(quad(0.09, 0.07, 0.91, 0.57), f.shade, { "fill-opacity": 0.45 });
  let keys = "";
  const rows = 5;
  const cols = 14;
  for (let r = 0; r < rows; r += 1) {
    const v0 = 0.1 + r * 0.092;
    const v1 = v0 + 0.074;
    if (r === rows - 1) {
      const span = (c0: number, c1: number) => {
        const u0 = 0.11 + c0 * (0.78 / cols);
        const u1 = 0.11 + c1 * (0.78 / cols) - 0.006;
        keys += quad(u0, v0, u1, v1);
      };
      span(0, 1);
      span(1, 2);
      span(2, 3);
      span(3, 4);
      span(4, 10);
      span(10, 11);
      span(11, 12);
      span(12, 14);
      continue;
    }
    for (let c = 0; c < cols; c += 1) {
      const u0 = 0.11 + c * (0.78 / cols);
      keys += quad(u0, v0, u0 + 0.78 / cols - 0.006, v1);
    }
  }
  out += path(keys, "#1a1c1f");
  out += path(quad(0.34, 0.63, 0.66, 0.94), mix(f.base, f.shade, 0.25), { stroke: f.shade, "stroke-width": 1 });
  out += path(d`M${L1} ${y1}H${R1}Q${R1 + 8} ${y1} ${R1 + 4} ${y1 + 7}L${R1 - 2} ${y1 + 12}Q${R1 - 5} ${y1 + 15} ${R1 - 12} ${y1 + 15}H${L1 + 12}Q${L1 + 5} ${y1 + 15} ${L1 + 2} ${y1 + 12}L${L1 - 4} ${y1 + 7}Q${L1 - 8} ${y1} ${L1} ${y1}Z`, a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  out += rect(365, y1 + 1, 70, 5, 2.5, f.deep);
  return out;
}

function laptopClosed(a: Art, f: Finish): string {
  let out = shadow(a, 400, 548, 340, 28);
  out += rect(112, 530, 576, 14, 7, a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  out += rect(118, 528, 564, 3, 1.5, "#0c0d0f", { "fill-opacity": 0.7 });
  out += rect(108, 516, 584, 14, 7, a.lin([
    [0, f.base],
    [1, f.shade],
  ]));
  out += rect(370, 528, 60, 6, 3, f.deep);
  const top = "M236 322H564Q585 322 594 338L684 500Q694 520 672 520H128Q106 520 116 500L206 338Q215 322 236 322Z";
  out += path(top, a.lin([
    [0, mix(f.base, f.shade, 0.25)],
    [0.55, f.base],
    [1, mix(f.hi, f.base, 0.35)],
  ], 0, 0, 0.3, 1), edge(f, f.light ? 0.55 : 0.15));
  out += sheen(a, "M330 322H420L262 520H150Z", 0.32, 0.3, 1);
  out += sheen(a, "M450 322H480L330 520H300Z", 0.18, 0.3, 1);
  out += rimLight(a, top, 0.6);
  return out;
}

function laptopDetail(a: Art, f: Finish): string {
  const deck = roundRectPath(70, 120, 900, 900, 46);
  let out = path(roundRectPath(84, 150, 900, 900, 46), "#0f1a18", { "fill-opacity": 0.18, filter: a.blur(22) });
  out += path(deck, a.lin([
    [0, mix(f.hi, f.base, 0.4)],
    [1, f.base],
  ], 0, 0, 0.5, 1), edge(f, f.light ? 0.5 : 0.2));
  out += rect(130, 120, 800, 30, 0, a.lin([
    [0, f.deep],
    [1, f.shade],
  ]));
  out += rect(110, 175, 900, 470, 22, f.shade, { "fill-opacity": 0.4 });
  const key = a.symbol(
    (id) =>
      `<g id="${id}">${rect(0, 0, 66, 62, 11, "#141518")}${rect(2, 1, 62, 56, 10, a.lin([
        [0, "#34373d"],
        [1, "#1d1f23"],
      ]))}${rect(9, 6, 48, 3, 1.5, "#ffffff", { "fill-opacity": 0.12 })}</g>`,
  );
  let keys = "";
  for (let r = 0; r < 6; r += 1) {
    const y = 190 + r * 74;
    const offset = [0, 0, 26, 40, 56, 0][r] ?? 0;
    for (let c = 0; c < 11; c += 1) {
      const x = 126 + offset + c * 76;
      if (r === 5 && c >= 4 && c <= 8) continue;
      keys += reuse(key, x, y);
    }
  }
  out += keys;
  out += rect(126 + 4 * 76, 190 + 5 * 74, 5 * 76 - 10, 62, 11, "#141518") + rect(128 + 4 * 76, 191 + 5 * 74, 5 * 76 - 14, 56, 10, "#2a2d32");
  out += rect(300, 690, 470, 260, 24, mix(f.base, f.shade, 0.18), { stroke: f.shade, "stroke-width": 2 });
  out += sheen(a, "M70 120H520L250 800H70Z", 0.25, 0.5, 1);
  return out;
}

export const drawLaptop: DrawKind = (a, f, view) => {
  if (view === "1") return laptopOpen(a, f);
  if (view === "2") return laptopClosed(a, f);
  return laptopDetail(a, f);
};

// -----------------------------------------------------------------------------
// Monitor
// -----------------------------------------------------------------------------

function monitorStand(a: Art, f: Finish, neckTop: number): string {
  let out = ellipse(400, 630, 160, 20, f.deep);
  out += ellipse(400, 622, 160, 20, a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.shade],
  ], 0, 0, 1, 0.4), edge(f, f.light ? 0.5 : 0.15));
  out += rect(370, neckTop, 60, 625 - neckTop, 10, cylX(a, f));
  return out;
}

function monitorFront(a: Art, f: Finish): string {
  let out = shadow(a, 400, 640, 220, 24) + monitorStand(a, f, 440);
  out += rect(96, 136, 608, 360, 12, diag(a, f), edge(f, f.light ? 0.5 : 0.2));
  out += rect(102, 142, 596, 322, 8, "#07080a");
  out += screen(a, 108, 148, 584, 310, 3, "desktop");
  out += circle(400, 480, 3, f.light ? "#7d858d" : "#c9ced3", { "fill-opacity": 0.6 });
  out += rimLight(a, roundRectPath(97, 137, 606, 358, 11), 0.7);
  return out;
}

function monitorBack(a: Art, f: Finish): string {
  let out = shadow(a, 400, 640, 220, 24);
  out += rect(96, 136, 608, 360, 14, flat(a, f), edge(f, f.light ? 0.55 : 0.2));
  out += rect(240, 190, 320, 250, 46, diag(a, f), edge(f, 0.3));
  let vents = "";
  for (let i = 0; i < 9; i += 1) vents += d`M${300 + i * 25} 212v34`;
  out += path(vents, "none", { stroke: f.deep, "stroke-opacity": 0.55, "stroke-width": 8, "stroke-linecap": "round" });
  out += monitorStand(a, f, 290);
  out += rect(386, 520, 28, 52, 12, f.deep, { "fill-opacity": 0.85 });
  out += rect(360, 300, 80, 70, 10, f.shade, { "fill-opacity": 0.5 });
  out += sheen(a, "M96 136H340L180 496H96Z", 0.18, 0.5, 1);
  return out;
}

export const drawMonitor: DrawKind = (a, f, view) => {
  if (view === "1") return monitorFront(a, f);
  if (view === "2") return monitorBack(a, f);
  return place(monitorFront(a, f), 112, 20, 0.72) + place(drawKeyboard(a, f, "1"), 150, 430, 0.5) + place(drawMouse(a, f, "1"), 545, 525, 0.3);
};

// -----------------------------------------------------------------------------
// TV
// -----------------------------------------------------------------------------

function tvPanel(a: Art, f: Finish): string {
  return (
    rect(0, 0, 680, 396, 7, diag(a, f), edge(f, f.light ? 0.5 : 0.2)) +
    rect(4, 4, 672, 388, 4, "#050607") +
    screen(a, 8, 8, 664, 380, 2, "tv") +
    rect(330, 394, 20, 5, 2, f.shade)
  );
}

function tvFoot(a: Art, f: Finish, x: number, y: number): string {
  return path(d`M${x - 6} ${y}L${x - 30} ${y + 62}H${x + 24}L${x + 8} ${y}Z`, a.lin([
    [0, f.base],
    [1, f.shade],
  ], 0, 0, 1, 0));
}

function tvFront(a: Art, f: Finish): string {
  let out = shadow(a, 400, 612, 340, 20);
  out += tvFoot(a, f, 150, 540) + tvFoot(a, f, 650, 540);
  out += place(tvPanel(a, f), 60, 146);
  return out;
}

function tvAngle(a: Art, f: Finish): string {
  let out = shadow(a, 405, 616, 330, 26);
  out += g(rect(0, 0, 680, 396, 7, f.deep), { transform: "matrix(0.84 0.11 0 1 98 132)" });
  out += tvFoot(a, f, 175, 552) + tvFoot(a, f, 640, 604);
  out += g(tvPanel(a, f), { transform: "matrix(0.84 0.11 0 1 112 136)" });
  return out;
}

export const drawTv: DrawKind = (a, f, view) => {
  if (view === "1") return tvFront(a, f);
  if (view === "2") return tvAngle(a, f);
  return place(tvFront(a, f), 64, 10, 0.84) + place(drawSoundbar(a, f, "1"), 120, 420, 0.7);
};

// -----------------------------------------------------------------------------
// Smartwatch
// -----------------------------------------------------------------------------

function watchBands(a: Art, f: Finish): string {
  const top = a.lin([
    [0, f.deep],
    [0.55, f.shade],
    [1, f.base],
  ]);
  const bottom = a.lin([
    [0, f.base],
    [0.5, f.shade],
    [1, f.deep],
  ]);
  let out = path("M-84 -128L-78 -300Q-78 -322 -56 -322H56Q78 -322 78 -300L84 -128Z", top);
  out += path("M-84 128L-78 310Q-78 332 -56 332H56Q78 332 78 310L84 128Z", bottom);
  for (let i = 0; i < 4; i += 1) out += circle(0, 200 + i * 30, 5.5, f.deep, { "fill-opacity": 0.75 });
  out += rect(-90, 172, 180, 18, 6, a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  return out;
}

function watchCase(a: Art, f: Finish, back: boolean): string {
  let out = watchBands(a, f);
  out += rect(back ? -128 : 110, -72, 18, 48, 7, cylY(a, f));
  out += rect(back ? -122 : 110, 2, 12, 64, 5, f.shade);
  out += path(roundRectPath(-118, -142, 236, 284, 64), diag(a, f), edge(f, f.light ? 0.55 : 0.2));
  out += rimLight(a, roundRectPath(-116, -140, 232, 280, 62), 0.9);
  if (back) {
    out += circle(0, 0, 100, a.rad([
      [0, "#3a3f46"],
      [0.7, "#16181b"],
      [1, "#0a0b0d"],
    ], 0.4, 0.35, 0.7));
    out += circle(0, 0, 70, "none", { stroke: "#5a616a", "stroke-width": 2 });
    for (let i = 0; i < 4; i += 1) {
      const ang = (Math.PI / 2) * i + Math.PI / 4;
      out += circle(Math.cos(ang) * 36, Math.sin(ang) * 36, 10, "#2b0f12", { stroke: "#4b5058", "stroke-width": 2 });
    }
    out += circle(0, 0, 14, "#1d2630", { stroke: "#4b5058", "stroke-width": 2 });
    out += sheen(a, "M-60 -80Q0 -110 60 -80L40 -60Q0 -80 -40 -60Z", 0.35);
  } else {
    out += path(roundRectPath(-108, -132, 216, 264, 55), "#050607");
    out += screen(a, -96, -120, 192, 240, 44, "watch");
  }
  return out;
}

export const drawSmartwatch: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 400, 735, 150, 18) + place(watchCase(a, f, false), 400, 390, 1);
  if (view === "2") return shadow(a, 400, 735, 150, 18) + place(watchCase(a, f, true), 400, 390, 1);
  return place(watchCase(a, f, false), 400, 410, 1.75, -8);
};
