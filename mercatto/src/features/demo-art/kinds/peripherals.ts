/** Teclado, mouse, console, controle e headset. */
import { BRAND, type Finish, mix } from "../palette";
import { RUBBER, type Tone, UI, cylX, cylY, diag, dome, edge, rimLight, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, roundRectPath, stroke, reuse } from "../svg";
import type { DrawKind } from "./types";

// -----------------------------------------------------------------------------
// Teclado (layout 75%, desenhado em vista superior e projetado obliquamente)
// -----------------------------------------------------------------------------

const KB_U = 38;
const KB_ROWS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, 1],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1, 1],
];

function keycapTones(f: Finish): { cap: Tone; mod: Tone; accent: Tone } {
  const darkCaps = f.name === "white" || f.name === "silver" || f.name === "gray" || f.name === "beige";
  const cap = darkCaps ? toneOf("#34373c") : toneOf("#eceef0");
  const mod = darkCaps ? toneOf("#22252a") : toneOf(mix("#d5d9dd", f.base, 0.25));
  const accent = f.neutral ? toneOf(BRAND.jade600) : toneOf(f.base);
  return { cap, mod, accent };
}

function keyboardTop(a: Art, f: Finish): string {
  const { cap, mod, accent } = keycapTones(f);
  const w = 16 * KB_U + 32;
  const h = 6 * KB_U + 34;
  let out = path(roundRectPath(0, 0, w, h, 18), diag(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(12, 12, w - 24, h - 24, 8, f.deep, { "fill-opacity": 0.55 });
  const capFill = (t: Tone) =>
    a.lin([
      [0, t.hi],
      [1, t.base],
    ]);
  const mk = (t: Tone) =>
    a.symbol(
      (id) =>
        `<g id="${id}">${rect(0, 0, KB_U - 4, KB_U - 4, 6, t.shade)}${rect(3, 2, KB_U - 10, KB_U - 12, 5, capFill(t))}</g>`,
    );
  const k1 = mk(cap);
  const kMod = mk(mod);
  const kAcc = mk(accent);
  const wide = (x: number, y: number, units: number, t: Tone) =>
    rect(x, y, units * KB_U - 4, KB_U - 4, 6, t.shade) + rect(x + 3, y + 2, units * KB_U - 10, KB_U - 12, 5, capFill(t));
  KB_ROWS.forEach((row, r) => {
    let x = 18;
    const y = 18 + r * KB_U + (r > 0 ? 4 : 0);
    row.forEach((units, c) => {
      const isMod = units !== 1 || c === row.length - 1 || r === 0;
      const isAccent = (r === 0 && c === 0) || (r === 3 && units === 2.25);
      if (units === 1) out += reuse(isAccent ? kAcc : isMod ? kMod : k1, x, y);
      else out += wide(x, y, units, isAccent ? accent : units > 6 ? cap : mod);
      x += units * KB_U;
    });
  });
  out += rimLight(a, roundRectPath(1, 1, w - 2, h - 2, 17), 0.7);
  return out;
}

function keyboardOblique(a: Art, f: Finish): string {
  const tf = "translate(400 420) scale(1.12 0.67) rotate(-12) translate(-320 -131)";
  const side = g(path(roundRectPath(0, 0, 640, 262, 18), a.lin([
    [0, f.shade],
    [1, f.deep],
  ])), { transform: `translate(0 20) ${tf}` });
  return shadow(a, 405, 468, 370, 64) + side + g(keyboardTop(a, f), { transform: tf });
}

export const drawKeyboard: DrawKind = (a, f, view) => {
  if (view === "1") return keyboardOblique(a, f);
  if (view === "2") {
    const blurred = path(roundRectPath(54, 280, 704, 288, 20), "#0f1a18", { "fill-opacity": 0.28, filter: a.blur(14) });
    return blurred + place(keyboardTop(a, f), 48, 256, 1.1);
  }
  return g(keyboardOblique(a, f), { transform: "translate(-560 -560) scale(2.3)" });
};

// -----------------------------------------------------------------------------
// Mouse
// -----------------------------------------------------------------------------

const MOUSE_TOP = "M400 185C500 185 522 300 522 405C522 545 482 615 400 615C318 615 278 545 278 405C278 300 300 185 400 185Z";

function mouseTop(a: Art, f: Finish): string {
  let out = path(MOUSE_TOP, "#0f1a18", { "fill-opacity": 0.3, filter: a.blur(16), transform: "translate(10 18)" });
  out += path(MOUSE_TOP, a.rad([
    [0, f.hi],
    [0.45, f.base],
    [0.85, f.shade],
    [1, f.deep],
  ], 0.4, 0.3, 0.75), edge(f, f.light ? 0.6 : 0.2));
  out += path("M282 360Q400 392 518 360", "none", stroke(f.deep, 3, { "stroke-opacity": 0.6 }));
  out += path("M400 188V372", "none", stroke(f.deep, 3, { "stroke-opacity": 0.6 }));
  out += rect(386, 238, 28, 74, 14, "#0c0d0f");
  out += rect(390, 244, 20, 62, 10, cylX(a, RUBBER));
  let ridges = "";
  for (let i = 0; i < 7; i += 1) ridges += d`M391 ${250 + i * 8}h18`;
  out += path(ridges, "none", stroke("#000000", 2, { "stroke-opacity": 0.5 }));
  out += rect(394, 330, 12, 18, 6, f.shade);
  out += sheen(a, "M330 230Q360 196 400 192V360Q340 350 300 342Q300 280 330 230Z", 0.45, 0.4, 1);
  return out;
}

function mouseSide(a: Art, f: Finish): string {
  const body = "M205 555C205 460 300 365 455 365C568 365 612 450 612 528Q612 560 584 560H232Q205 560 205 555Z";
  let out = shadow(a, 410, 568, 230, 22);
  out += rect(225, 548, 370, 18, 9, "#16181b");
  out += path(body, a.lin([
    [0, f.hi],
    [0.4, f.base],
    [0.85, f.shade],
    [1, f.deep],
  ]), edge(f, f.light ? 0.6 : 0.2));
  out += path("M240 520C250 470 300 440 370 440H470C520 440 540 470 545 520Z", RUBBER.base, { "fill-opacity": 0.85 });
  let grip = "";
  for (let i = 0; i < 12; i += 1) grip += d`M${270 + i * 22} 455l-14 58`;
  out += path(grip, "none", stroke("#000000", 2, { "stroke-opacity": 0.35 }));
  out += rect(300, 405, 62, 20, 10, a.lin([
    [0, f.base],
    [1, f.deep],
  ]));
  out += rect(372, 405, 62, 20, 10, a.lin([
    [0, f.base],
    [1, f.deep],
  ]));
  out += path("M215 470C230 420 300 375 400 368", "none", stroke(f.deep, 2.5, { "stroke-opacity": 0.6 }));
  out += sheen(a, "M260 430C300 385 380 368 455 368C520 368 560 390 585 430C520 405 400 400 260 430Z", 0.5);
  return out;
}

function mousepad(a: Art): string {
  const pad = "M160 300L700 250Q720 248 722 268L760 600Q762 620 742 622L130 668Q110 670 108 650L80 340Q78 320 98 318Z";
  return (
    path(pad, "#0f1a18", { "fill-opacity": 0.25, filter: a.blur(10), transform: "translate(4 10)" }) +
    path(pad, a.lin([
      [0, "#3a3e44"],
      [1, "#1d2024"],
    ], 0, 0, 1, 1)) +
    path(pad, "none", { stroke: "#5a6068", "stroke-width": 3, "stroke-dasharray": "2 5" })
  );
}

export const drawMouse: DrawKind = (a, f, view) => {
  if (view === "1") return mouseTop(a, f);
  if (view === "2") return mouseSide(a, f);
  return mousepad(a) + place(g(mouseTop(a, f), { transform: "translate(-400 -400)" }), 430, 455, 0.72, 14);
};

// -----------------------------------------------------------------------------
// Console
// -----------------------------------------------------------------------------

type Pt = readonly [number, number];
const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
const add = (p: Pt, q: Pt, k = 1): Pt => [p[0] + q[0] * k, p[1] + q[1] * k];

function consoleBox(a: Art, f: Finish, o: Pt, ex: Pt, ez: Pt, ey: Pt, vertical: boolean): string {
  // o = canto frontal inferior esquerdo; ex = largura; ez = profundidade; ey = altura
  const fbl = o;
  const fbr = add(o, ex);
  const ftl = add(o, ey);
  const ftr = add(ftl, ex);
  const btl = add(ftl, ez);
  const btr = add(ftr, ez);
  const bbr = add(fbr, ez);
  let out = shadow(a, (fbl[0] + bbr[0]) / 2, (fbl[1] + bbr[1]) / 2 + 8, Math.abs(bbr[0] - fbl[0]) * 0.62, 34);
  out += path(poly([ftl, ftr, btr, btl]), a.lin([
    [0, f.hi],
    [1, f.base],
  ], 0, 1, 1, 0), edge(f, f.light ? 0.5 : 0.2));
  out += path(poly([ftl, ftr, fbr, fbl]), a.lin([
    [0, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, f.light ? 0.5 : 0.2));
  out += path(poly([ftr, btr, bbr, fbr]), a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0));
  // faixa preta brilhante no centro da face frontal
  const m0 = add(fbl, ey, 0.42);
  const m1 = add(fbl, ey, 0.6);
  out += path(poly([m0, add(m0, ex), add(m1, ex), m1]), a.lin([
    [0, "#2b2f35"],
    [0.5, "#0b0c0e"],
    [1, "#1c1f23"],
  ], 0, 0, 1, 1));
  out += path(poly([m0, add(m0, ex), add(m1, ex), m1]), "none", { stroke: "#ffffff", "stroke-opacity": 0.12, "stroke-width": 1 });
  // barra de luz e botões
  const l0 = add(add(fbl, ey, 0.51), ex, 0.06);
  out += path(`M${l0[0].toFixed(1)} ${l0[1].toFixed(1)}l${(ex[0] * 0.3).toFixed(1)} ${(ex[1] * 0.3).toFixed(1)}`, "none", stroke(BRAND.jade400, 3));
  const pb = add(add(fbl, ey, 0.51), ex, 0.86);
  out += circle(pb[0], pb[1], 5, "#f4f6f8", { "fill-opacity": 0.9 });
  const usb = add(add(fbl, ey, 0.51), ex, 0.76);
  out += rect(usb[0] - 9, usb[1] - 3, 18, 6, 1.5, "#000000");
  // ventilação no lado
  let vents = "";
  for (let i = 1; i < 9; i += 1) {
    const s = add(add(ftr, ez, i / 9), ey, -0.18);
    vents += `M${s[0].toFixed(1)} ${s[1].toFixed(1)}l${(-ey[0] * 0.64).toFixed(1)} ${(-ey[1] * 0.64).toFixed(1)}`;
  }
  out += path(vents, "none", stroke(f.deep, vertical ? 5 : 4, { "stroke-opacity": 0.8 }));
  out += sheen(a, poly([ftl, add(ftl, ex, 0.45), add(add(ftl, ex, 0.3), ez), add(ftl, ez)]), 0.4, 1, 0.3);
  return out;
}

export const drawConsole: DrawKind = (a, f, view) => {
  if (view === "1") return consoleBox(a, f, [120, 560], [430, 46], [150, -120], [0, -96], false);
  if (view === "2") return consoleBox(a, f, [255, 650], [170, 32], [190, -110], [0, -440], true);
  return place(consoleBox(a, f, [120, 560], [430, 46], [150, -120], [0, -96], false), 40, -60, 0.95) + place(drawController(a, f, "1"), 210, 380, 0.62);
};

// -----------------------------------------------------------------------------
// Controle (gamepad)
// -----------------------------------------------------------------------------

const PAD =
  "M0 -112C-60 -112 -120 -122 -170 -118C-215 -114 -240 -90 -252 -50C-268 10 -280 110 -262 160C-248 196 -196 204 -170 176C-140 140 -120 92 -80 80C-50 72 -25 74 0 74C25 74 50 72 80 80C120 92 140 140 170 176C196 204 248 196 262 160C280 110 268 10 252 -50C240 -90 215 -114 170 -118C120 -122 60 -112 0 -112Z";

function stick(a: Art, x: number, y: number): string {
  return (
    circle(x, y, 47, "#0b0c0e") +
    circle(x + 2, y + 3, 37, "#000000", { "fill-opacity": 0.5 }) +
    circle(x, y, 36, a.rad([
      [0, "#4a4e55"],
      [0.7, "#24272b"],
      [1, "#121315"],
    ], 0.4, 0.35, 0.65)) +
    circle(x, y, 26, a.rad([
      [0, "#141518"],
      [1, "#30343a"],
    ], 0.55, 0.6, 0.6)) +
    circle(x, y, 33, "none", { stroke: "#5a5f66", "stroke-width": 2, "stroke-dasharray": "3 4" })
  );
}

function controllerTop(a: Art, f: Finish): string {
  let out = path("M-238 -70C-226 -112 -190 -128 -140 -128L-120 -104H-236Z", RUBBER.base);
  out += path("M238 -70C226 -112 190 -128 140 -128L120 -104H236Z", RUBBER.base);
  out += path(PAD, dome(a, f), edge(f, f.light ? 0.6 : 0.2));
  out += path(PAD, a.lin([
    [0, "#000000", 0],
    [0.75, "#000000", 0],
    [1, "#000000", 0.25],
  ]));
  out += stick(a, -160, -42);
  out += stick(a, 88, 46);
  // d-pad
  out += circle(-88, 46, 44, f.deep, { "fill-opacity": 0.45 });
  const dp = "M-100 10H-76V34H-52V58H-76V82H-100V58H-124V34H-100Z";
  out += path(dp, "#141518");
  out += path(dp, a.lin([
    [0, "#3b3f45"],
    [1, "#16181b"],
  ]), { transform: "translate(0 -2)" });
  // botões de face (sem letras)
  const face: readonly [number, number, string][] = [
    [160, -82, UI.sky],
    [198, -44, UI.coral],
    [122, -44, UI.sun],
    [160, -6, UI.jade],
  ];
  for (const [x, y, c] of face) {
    out += circle(x + 1, y + 3, 19, "#000000", { "fill-opacity": 0.35 });
    out += circle(x, y, 19, a.rad([
      [0, mix(c, "#ffffff", 0.45)],
      [0.6, c],
      [1, mix(c, "#000000", 0.35)],
    ], 0.38, 0.32, 0.7));
  }
  // centro
  out += circle(0, -58, 17, "#121315") + circle(0, -58, 13, a.rad([
    [0, "#ffffff"],
    [1, "#c9ced3"],
  ]));
  out += rect(-56, -24, 30, 12, 6, "#141518") + rect(26, -24, 30, 12, 6, "#141518");
  out += sheen(a, "M-230 -60C-210 -100 -150 -110 -60 -104C-120 -90 -200 -60 -238 -10Z", 0.45);
  out += rimLight(a, PAD, 0.5);
  return out;
}

export const drawController: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 400, 605, 270, 30) + place(controllerTop(a, f), 400, 400, 1.2);
  if (view === "2") {
    const side = g(path(PAD, a.lin([
      [0, f.shade],
      [1, f.deep],
    ])), { transform: "translate(400 452) scale(1.2 0.66)" });
    const trig = a.lin([
      [0, "#4a4f57"],
      [1, "#141518"],
    ]);
    const triggers = g(
      path("M-244 -40C-246 -150 -196 -176 -140 -170L-104 -100Z", trig) + path("M244 -40C246 -150 196 -176 140 -170L104 -100Z", trig),
      { transform: "translate(400 420) scale(1.2 0.66)" },
    );
    return (
      shadow(a, 400, 560, 300, 34) +
      triggers +
      side +
      g(controllerTop(a, f), { transform: "translate(400 430) scale(1.2 0.66)" })
    );
  }
  return place(controllerTop(a, f), 210, 470, 2.1);
};

// -----------------------------------------------------------------------------
// Headset gamer (com microfone)
// -----------------------------------------------------------------------------

function headset(a: Art, f: Finish): string {
  const band = "M238 440C220 210 560 120 580 390";
  let out = shadow(a, 420, 668, 270, 26);
  out += path(band, "none", stroke(f.deep, 50));
  out += path(band, "none", stroke(a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), 40));
  out += path(band, "none", stroke(f.deep, 2, { "stroke-dasharray": "6 6", "stroke-opacity": 0.6 }));
  out += path("M268 450C258 252 540 186 552 400", "none", stroke(RUBBER.base, 16));
  // concha esquerda (vista interna, almofada)
  out += rect(232, 380, 34, 70, 12, a.lin([
    [0, f.base],
    [1, f.deep],
  ]));
  out += ellipse(250, 520, 92, 128, a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 1));
  out += ellipse(258, 520, 76, 112, a.rad([
    [0, "#2d3035"],
    [0.75, "#1b1d21"],
    [1, "#0d0e10"],
  ], 0.45, 0.4, 0.6));
  out += ellipse(262, 522, 40, 64, "#0c0d0f");
  out += ellipse(262, 522, 30, 52, "none", { stroke: "#2a2d32", "stroke-width": 3, "stroke-dasharray": "1 4" });
  // microfone
  out += path("M215 600C200 690 300 712 362 668", "none", stroke(RUBBER.base, 13));
  out += path("M215 600C200 690 300 712 362 668", "none", stroke(RUBBER.hi, 3, { "stroke-opacity": 0.5, transform: "translate(-2 -3)" }));
  out += rect(352, 650, 46, 26, 13, cylY(a, RUBBER), { transform: "rotate(-30 375 663)" });
  out += circle(379, 660, 3.5, "#ff4b4b");
  // concha direita (vista externa)
  out += rect(556, 350, 36, 70, 12, a.lin([
    [0, f.base],
    [1, f.deep],
  ]));
  out += ellipse(548, 512, 100, 140, "#141518");
  out += ellipse(566, 508, 104, 142, dome(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += ellipse(570, 508, 86, 120, "none", { stroke: BRAND.jade400, "stroke-width": 5, "stroke-opacity": 0.95 });
  out += ellipse(570, 508, 86, 120, "none", { stroke: BRAND.jade400, "stroke-width": 14, "stroke-opacity": 0.18 });
  out += path("M570 410L640 455L640 560L570 606L500 560L500 455Z", a.lin([
    [0, f.base],
    [1, f.deep],
  ], 0, 0, 1, 1), { stroke: f.deep, "stroke-width": 2 });
  out += path("M570 410L640 455L570 508L500 455Z", f.hi, { "fill-opacity": 0.35 });
  out += sheen(a, "M490 430C510 390 560 372 600 380C560 400 520 430 500 470Z", 0.55);
  return out;
}

function headsetStand(a: Art): string {
  const t = toneOf("#2e3237");
  return (
    shadow(a, 400, 735, 170, 18) +
    ellipse(400, 726, 140, 22, "#16181b") +
    ellipse(400, 718, 140, 22, a.lin([
      [0, t.hi],
      [1, t.shade],
    ])) +
    rect(386, 300, 28, 420, 10, cylX(a, t)) +
    path("M318 312Q400 276 482 312L482 326Q400 290 318 326Z", diag(a, t))
  );
}

export const drawHeadset: DrawKind = (a, f, view) => {
  if (view === "1") return headset(a, f);
  if (view === "2") return g(headset(a, f), { transform: "translate(830 0) scale(-1 1) rotate(-6 400 500)" });
  return headsetStand(a) + place(headset(a, f), 82, 118, 0.78);
};
