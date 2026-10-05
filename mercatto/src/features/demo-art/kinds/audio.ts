/** Fones intra-auriculares, headphones, soundbar e caixa de som portátil. */
import { type Finish, mix } from "../palette";
import { CHROME, RUBBER, cylX, cylY, diag, dome, edge, rimLight, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, roundRectPath, stroke } from "../svg";
import type { DrawKind } from "./types";

// -----------------------------------------------------------------------------
// Earbuds (estojo de carga + fones)
// -----------------------------------------------------------------------------

function bud(a: Art, f: Finish): string {
  let out = ellipse(-46, 26, 44, 38, a.rad([
    [0, "#8d949c"],
    [0.6, "#5d646c"],
    [1, "#3a3f45"],
  ], 0.4, 0.35, 0.7), { transform: "rotate(-30 -46 26)" });
  out += ellipse(-62, 36, 16, 12, "#202326", { transform: "rotate(-30 -62 36)" });
  out += path("M-70 -10C-70 -66 -20 -84 26 -78C78 -70 92 -26 84 14C76 56 34 78 -6 74C-48 70 -70 40 -70 -10Z", dome(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += ellipse(22, -6, 40, 36, a.lin([
    [0, f.hi],
    [1, f.shade],
  ], 0, 0, 1, 1), { stroke: f.deep, "stroke-opacity": 0.35, "stroke-width": 1.5 });
  out += ellipse(10, -22, 18, 9, "#ffffff", { "fill-opacity": 0.6, transform: "rotate(-25 10 -22)" });
  out += ellipse(-30, 30, 7, 4, "#111315", { transform: "rotate(-30 -30 30)" });
  return out;
}

function caseBase(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  return path(
    d`M${x} ${y}H${x + w}V${y + h - 70}Q${x + w} ${y + h} ${x + w - 80} ${y + h}H${x + 80}Q${x} ${y + h} ${x} ${y + h - 70}Z`,
    a.lin([
      [0, f.hi],
      [0.35, f.base],
      [0.85, f.shade],
      [1, f.deep],
    ], 0, 0, 0.7, 1),
    edge(f, f.light ? 0.6 : 0.25),
  );
}

function earbudsOpen(a: Art, f: Finish): string {
  let out = shadow(a, 400, 630, 210, 26);
  // tampa aberta (face interna)
  out += path("M272 452V318Q272 240 352 240H448Q528 240 528 318V452Z", a.lin([
    [0, f.shade],
    [1, f.base],
  ], 0, 0, 0, 1), edge(f, f.light ? 0.6 : 0.25));
  out += path("M286 452V326Q286 256 356 256H444Q514 256 514 326V452Z", a.lin([
    [0, mix(f.base, f.shade, 0.5)],
    [1, f.deep],
  ]));
  out += rect(376, 440, 48, 14, 4, CHROME.shade);
  out += caseBase(a, f, 270, 450, 260, 168);
  out += ellipse(400, 452, 128, 18, f.deep);
  out += ellipse(400, 452, 120, 13, "#0c0d0f", { "fill-opacity": 0.8 });
  out += place(bud(a, f), 348, 428, 0.62, -20);
  out += place(g(bud(a, f), { transform: "scale(-1 1)" }), 452, 428, 0.62, 20);
  out += circle(400, 548, 5, "#3ee08f");
  out += circle(400, 548, 12, "#3ee08f", { "fill-opacity": 0.2 });
  out += sheen(a, "M282 462H360L300 610Q280 600 276 560Z", 0.45, 0.3, 1);
  return out;
}

function earbudsClosed(a: Art, f: Finish): string {
  const bodyD = "M270 420Q270 330 370 330H430Q530 330 530 420V510Q530 600 430 600H370Q270 600 270 510Z";
  let out = path(bodyD, dome(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += path("M272 392Q330 404 400 404Q470 404 528 392", "none", stroke(f.deep, 2.5, { "stroke-opacity": 0.6 }));
  out += circle(400, 500, 5, "#3ee08f");
  out += sheen(a, "M300 350Q330 334 380 334L320 470Q290 440 290 400Z", 0.55);
  out += rimLight(a, bodyD, 0.6);
  return out;
}

export const drawEarbuds: DrawKind = (a, f, view) => {
  if (view === "1") return earbudsOpen(a, f);
  if (view === "2") {
    return (
      shadow(a, 300, 560, 120, 20) +
      shadow(a, 510, 590, 120, 20) +
      place(bud(a, f), 300, 440, 1.5, -12) +
      place(g(bud(a, f), { transform: "scale(-1 1)" }), 510, 470, 1.5, 16)
    );
  }
  return shadow(a, 380, 612, 190, 24) + place(earbudsClosed(a, f), -40, 10) + shadow(a, 590, 640, 90, 14) + place(bud(a, f), 590, 585, 0.9, 25);
};

// -----------------------------------------------------------------------------
// Headphones over-ear
// -----------------------------------------------------------------------------

function headphonesFront(a: Art, f: Finish): string {
  const band = "M200 430C196 140 604 140 600 430";
  let out = shadow(a, 400, 690, 260, 24);
  out += path(band, "none", stroke(f.deep, 40));
  out += path(band, "none", stroke(a.lin([
    [0, f.hi],
    [0.45, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), 32));
  out += path("M226 440C224 186 576 186 574 440", "none", stroke(RUBBER.base, 16));
  out += path("M226 440C224 186 576 186 574 440", "none", stroke(RUBBER.hi, 3, { "stroke-opacity": 0.4 }));
  for (const x of [192, 600]) {
    out += rect(x - 8, 420, 16, 70, 6, cylX(a, CHROME));
  }
  const cup = (x: number, flip: boolean) => {
    const cx = flip ? x - 30 : x;
    return (
      rect(flip ? x - 2 : x - 40, 474, 42, 214, 20, a.lin([
        [0, "#2c2f34"],
        [1, "#121315"],
      ], 0, 0, 1, 0)) +
      rect(cx - 48, 462, 96, 238, 48, cylX(a, f), edge(f, f.light ? 0.6 : 0.25)) +
      rect(cx - 30, 500, 60, 162, 30, "none", { stroke: f.deep, "stroke-opacity": 0.35, "stroke-width": 2 }) +
      rect(cx - 36, 478, 18, 120, 9, "#ffffff", { "fill-opacity": 0.28 })
    );
  };
  out += cup(186, false) + cup(644, true);
  return out;
}

function headphones3q(a: Art, f: Finish): string {
  let out = shadow(a, 420, 690, 250, 26);
  // concha de trás (vista interna)
  out += ellipse(548, 470, 74, 112, a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0));
  out += ellipse(540, 472, 58, 96, a.rad([
    [0, "#34373d"],
    [1, "#111214"],
  ], 0.45, 0.4, 0.6));
  out += ellipse(540, 474, 30, 56, "#0b0c0e");
  // arco
  const band = "M318 352C290 96 588 70 556 372";
  out += path(band, "none", stroke(f.deep, 40));
  out += path(band, "none", stroke(a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), 32));
  out += path("M344 356C322 130 560 110 534 372", "none", stroke(RUBBER.base, 14));
  out += rect(546, 346, 16, 60, 6, cylX(a, CHROME));
  out += rect(308, 330, 18, 66, 6, cylX(a, CHROME));
  // concha da frente (vista externa)
  out += ellipse(352, 506, 128, 160, "#16181b");
  out += ellipse(330, 504, 124, 158, dome(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += ellipse(330, 504, 96, 124, "none", { stroke: f.deep, "stroke-opacity": 0.25, "stroke-width": 3 });
  out += sheen(a, "M226 440C236 380 280 350 330 346C290 380 260 420 250 480Z", 0.6);
  out += circle(420, 600, 5, f.deep);
  return out;
}

function hardCase(a: Art): string {
  const t = toneOf("#2c3036");
  return (
    shadow(a, 400, 690, 300, 28) +
    path("M140 470C140 320 260 250 400 250C540 250 660 320 660 470C660 610 560 680 400 680C240 680 140 610 140 470Z", diag(a, t)) +
    path("M156 470C156 334 266 268 400 268C534 268 644 334 644 470", "none", { stroke: "#5a6068", "stroke-width": 4, "stroke-dasharray": "3 5", fill: "none" }) +
    rect(620, 440, 30, 50, 10, CHROME.shade)
  );
}

export const drawHeadphones: DrawKind = (a, f, view) => {
  if (view === "1") return headphonesFront(a, f);
  if (view === "2") return headphones3q(a, f);
  return hardCase(a) + place(headphonesFront(a, f), 112, 120, 0.72);
};

// -----------------------------------------------------------------------------
// Soundbar (+ subwoofer)
// -----------------------------------------------------------------------------

function grille(a: Art, f: Finish): string {
  return a.pattern(9, 9, circle(4.5, 4.5, 2.1, f.light ? "#30343a" : "#000000", { "fill-opacity": 0.55 }));
}

function soundbarFront(a: Art, f: Finish): string {
  let out = shadow(a, 400, 474, 360, 22);
  out += path("M98 330H702Q732 330 738 352L742 362H58L62 352Q68 330 98 330Z", a.lin([
    [0, f.hi],
    [1, f.base],
  ]), edge(f, 0.3));
  out += rect(58, 358, 684, 104, 24, a.lin([
    [0, f.base],
    [0.6, f.shade],
    [1, f.deep],
  ]), edge(f, f.light ? 0.5 : 0.2));
  out += rect(76, 368, 648, 84, 16, grille(a, f));
  out += rect(76, 368, 648, 84, 16, a.lin([
    [0, "#ffffff", 0.08],
    [1, "#000000", 0.25],
  ]));
  for (let i = 0; i < 5; i += 1) out += circle(380 + i * 10, 440, 2.4, "#ffffff", { "fill-opacity": i < 3 ? 0.9 : 0.35 });
  for (let i = 0; i < 3; i += 1) out += rect(360 + i * 30, 337, 20, 4, 2, f.deep, { "fill-opacity": 0.6 });
  out += rimLight(a, roundRectPath(59, 359, 682, 102, 23), 0.6);
  return out;
}

function soundbarTop(a: Art, f: Finish): string {
  let out = shadow(a, 400, 520, 370, 30);
  out += rect(60, 450, 680, 52, 22, a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  out += rect(76, 462, 648, 30, 12, grille(a, f));
  out += path("M110 300H690Q744 300 744 352V420Q744 470 690 470H110Q56 470 56 420V352Q56 300 110 300Z", a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.shade],
  ], 0, 0, 0.3, 1), edge(f, f.light ? 0.5 : 0.2));
  out += rect(96, 320, 220, 130, 26, grille(a, f), { "fill-opacity": 0.9 });
  out += rect(484, 320, 220, 130, 26, grille(a, f), { "fill-opacity": 0.9 });
  out += rect(340, 360, 120, 50, 25, f.shade, { "fill-opacity": 0.5 });
  out += circle(365, 385, 9, f.deep) + circle(400, 385, 11, f.deep) + circle(435, 385, 9, f.deep);
  out += sheen(a, "M120 302H420L300 470H110Q58 470 58 420V360Z", 0.25, 0.4, 1);
  return out;
}

function subwoofer(a: Art, f: Finish): string {
  let out = shadow(a, 120, 330, 140, 22);
  out += path("M10 40L40 10H250L220 40Z", a.lin([
    [0, f.hi],
    [1, f.base],
  ]));
  out += path("M220 40L250 10V300L220 330Z", a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  out += rect(10, 40, 210, 290, 10, a.lin([
    [0, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, f.light ? 0.5 : 0.2));
  out += circle(115, 185, 80, "#101113") + circle(115, 185, 66, a.rad([
    [0, "#4b5058"],
    [0.6, "#1d2024"],
    [1, "#0d0e10"],
  ], 0.42, 0.38, 0.7));
  out += circle(115, 185, 26, a.rad([
    [0, "#5c626a"],
    [1, "#1d2024"],
  ], 0.4, 0.35, 0.7));
  return out;
}

export const drawSoundbar: DrawKind = (a, f, view) => {
  if (view === "1") return soundbarFront(a, f);
  if (view === "2") return soundbarTop(a, f);
  return place(subwoofer(a, f), 520, 300) + place(soundbarFront(a, f), 20, 260, 0.82);
};

// -----------------------------------------------------------------------------
// Caixa de som portátil (cilíndrica)
// -----------------------------------------------------------------------------

function fabric(a: Art, f: Finish): string {
  const line = f.light ? "#000000" : "#ffffff";
  return a.pattern(
    6,
    6,
    path("M0 0L6 6M6 0L0 6", "none", { stroke: line, "stroke-opacity": 0.1, "stroke-width": 1 }),
  );
}

function speakerUpright(a: Art, f: Finish): string {
  let out = shadow(a, 400, 660, 160, 24);
  out += rect(290, 180, 220, 470, 40, cylX(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(290, 180, 220, 470, 40, fabric(a, f));
  out += ellipse(400, 618, 110, 30, cylX(a, RUBBER));
  out += rect(290, 600, 220, 30, 0, cylX(a, RUBBER));
  out += ellipse(400, 646, 110, 22, "#0d0e10");
  out += ellipse(400, 182, 110, 30, dome(a, RUBBER));
  out += ellipse(400, 182, 92, 22, "#26292e");
  for (const [x, w] of [
    [360, 16],
    [400, 22],
    [440, 16],
  ] as const) {
    out += ellipse(x, 182, w, w * 0.32, "#3d4249");
  }
  out += rect(386, 250, 28, 300, 14, RUBBER.base, { "fill-opacity": 0.85 });
  out += path("M400 300V340M380 320H420M380 470H420", "none", stroke(f.light ? "#d6dade" : f.hi, 5));
  out += rect(290, 180, 60, 470, 30, a.lin([
    [0, "#ffffff", 0],
    [0.5, "#ffffff", 0.25],
    [1, "#ffffff", 0],
  ], 0, 0, 1, 0));
  return out;
}

function speakerLying(a: Art, f: Finish): string {
  let out = shadow(a, 400, 560, 300, 26);
  out += rect(150, 360, 470, 190, 30, cylY(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(150, 360, 470, 190, 30, fabric(a, f));
  out += rect(588, 360, 50, 190, 22, cylY(a, RUBBER));
  out += ellipse(152, 455, 46, 96, a.lin([
    [0, RUBBER.hi],
    [1, RUBBER.deep],
  ], 0, 0, 1, 1));
  out += ellipse(156, 455, 34, 78, a.rad([
    [0, "#5a5f67"],
    [0.6, "#2a2d32"],
    [1, "#121315"],
  ], 0.4, 0.4, 0.7));
  out += ellipse(158, 455, 16, 38, "none", { stroke: "#70767e", "stroke-width": 2 });
  out += rect(300, 360, 180, 26, 13, RUBBER.base);
  out += path("M360 373H380M390 373H410M420 373H440", "none", stroke("#8c939b", 4));
  out += rect(200, 366, 380, 40, 20, "#ffffff", { "fill-opacity": 0.18 });
  return out;
}

export const drawSpeaker: DrawKind = (a, f, view) => {
  if (view === "1") return speakerUpright(a, f);
  if (view === "2") return speakerLying(a, f);
  return g(speakerUpright(a, f), { transform: "translate(-400 -60) scale(2)" });
};
