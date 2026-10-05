/** Cadeira de escritório, luminária, panelas e sofá. */
import { type Finish, mix } from "../palette";
import { CHROME, RUBBER, WOOD, cylX, cylY, diag, dome, edge, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, stroke } from "../svg";
import type { DrawKind } from "./types";

// -----------------------------------------------------------------------------
// Cadeira de escritório ergonômica
// -----------------------------------------------------------------------------

const FRAME = toneOf("#2b2e33");

function mesh(a: Art, f: Finish): string {
  const c = f.light ? "#000000" : "#ffffff";
  return a.pattern(8, 8, path("M0 4H8M4 0V8", "none", { stroke: c, "stroke-opacity": 0.14, "stroke-width": 1.2 }));
}

function starBase(a: Art, cx: number, cy: number, rx: number, ry: number, front: boolean): string {
  let back = "";
  let fore = "";
  for (let i = 0; i < 5; i += 1) {
    const th = Math.PI / 2 + (i * 2 * Math.PI) / 5 + 0.25;
    const ex = cx + Math.cos(th) * rx;
    const ey = cy + Math.sin(th) * ry;
    const nx = -Math.sin(th) * 9;
    const leg = path(d`M${cx + nx} ${cy - 6}L${ex + nx * 0.5} ${ey - 4}L${ex - nx * 0.5} ${ey + 4}L${cx - nx} ${cy + 8}Z`, a.lin([
      [0, FRAME.hi],
      [1, FRAME.deep],
    ]));
    const wheel = rect(ex - 12, ey + 2, 24, 28, 12, cylX(a, RUBBER)) + rect(ex - 4, ey - 4, 8, 10, 2, CHROME.shade);
    if (Math.sin(th) < 0 || !front) back += leg + wheel;
    else fore += leg + wheel;
  }
  return back + ellipse(cx, cy, 30, 12, FRAME.deep) + fore;
}

function chairFront(a: Art, f: Finish): string {
  let out = shadow(a, 400, 690, 250, 30);
  out += starBase(a, 400, 640, 200, 52, true);
  out += rect(388, 470, 24, 120, 6, cylX(a, CHROME));
  out += rect(378, 560, 44, 84, 10, cylX(a, FRAME));
  // espinha + encosto
  out += rect(386, 330, 28, 150, 8, cylX(a, FRAME));
  out += path("M286 150Q400 110 514 150Q540 290 512 420Q400 440 288 420Q260 290 286 150Z", cylX(a, FRAME));
  out += path("M300 164Q400 128 500 164Q522 290 498 404Q400 422 302 404Q278 290 300 164Z", a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.deep],
  ], 0, 0, 0.6, 1));
  out += path("M300 164Q400 128 500 164Q522 290 498 404Q400 422 302 404Q278 290 300 164Z", mesh(a, f));
  out += path("M296 320Q400 340 504 320L502 352Q400 372 298 352Z", cylY(a, FRAME));
  // apoio de cabeça
  out += rect(392, 92, 16, 60, 6, FRAME.base);
  out += path("M326 70Q400 50 474 70Q480 100 470 116Q400 104 330 116Q320 100 326 70Z", a.lin([
    [0, f.hi],
    [1, f.shade],
  ]), { stroke: FRAME.base, "stroke-width": 5 });
  // assento
  out += rect(360, 470, 80, 22, 6, FRAME.deep);
  out += path("M254 452Q254 486 330 492H470Q546 486 546 452V440H254Z", a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  out += path("M256 440Q256 398 330 394H470Q544 398 544 440Q544 470 470 474H330Q256 470 256 440Z", a.lin([
    [0, f.base],
    [1, f.hi],
  ], 0, 0, 0.3, 1), edge(f, 0.3));
  out += sheen(a, "M280 430Q290 402 340 400H460Q420 410 300 450Z", 0.35);
  // braços
  for (const s of [-1, 1] as const) {
    const x = 400 + s * 168;
    out += path(d`M${x - 8} 470V392H${x + 8}V470Z`, cylX(a, FRAME));
    out += rect(x - 42 + s * 6, 372, 84, 22, 11, cylY(a, FRAME));
  }
  return out;
}

function chairSide(a: Art, f: Finish): string {
  let out = shadow(a, 400, 690, 240, 26);
  out += path("M400 640L190 662M400 640L610 662", "none", stroke(FRAME.base, 18));
  out += path("M400 640L300 650M400 640L500 650", "none", stroke(FRAME.shade, 14));
  for (const x of [190, 300, 500, 610]) out += rect(x - 14, 650, 28, 30, 14, cylX(a, RUBBER));
  out += rect(386, 480, 28, 160, 8, cylX(a, CHROME));
  out += rect(378, 560, 44, 84, 10, cylX(a, FRAME));
  out += path("M500 470Q560 400 540 300Q520 200 560 110", "none", stroke(FRAME.base, 26));
  out += path("M520 470Q570 400 556 300Q540 200 572 120", "none", stroke(a.lin([
    [0, f.hi],
    [1, f.deep],
  ], 0, 0, 1, 0), 24));
  out += path("M536 330Q566 340 560 380", "none", stroke(FRAME.deep, 18));
  out += rect(270, 440, 280, 46, 22, a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.deep],
  ]), edge(f, 0.3));
  out += rect(340, 486, 120, 18, 6, FRAME.deep);
  out += path("M450 470V390", "none", stroke(FRAME.base, 16));
  out += rect(380, 374, 130, 22, 11, cylY(a, FRAME));
  out += rect(546, 60, 50, 70, 18, a.lin([
    [0, f.hi],
    [1, f.shade],
  ]), { transform: "rotate(12 571 95)" });
  return out;
}

export const drawOfficeChair: DrawKind = (a, f, view) => {
  if (view === "1") return chairFront(a, f);
  if (view === "2") return chairSide(a, f);
  return g(chairFront(a, f), { transform: "translate(-360 -230) scale(1.9)" });
};

// -----------------------------------------------------------------------------
// Luminária de mesa articulada
// -----------------------------------------------------------------------------

function arm(a: Art, x1: number, y1: number, x2: number, y2: number, t: Finish): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 7;
  const ny = (dx / len) * 7;
  return (
    path(d`M${x1 + nx} ${y1 + ny}L${x2 + nx} ${y2 + ny}M${x1 - nx} ${y1 - ny}L${x2 - nx} ${y2 - ny}`, "none", stroke(t.shade, 7)) +
    path(d`M${x1 + nx} ${y1 + ny}L${x2 + nx} ${y2 + ny}M${x1 - nx} ${y1 - ny}L${x2 - nx} ${y2 - ny}`, "none", stroke(t.hi, 2.5, { "stroke-opacity": 0.8 }))
  );
}

function spring(x1: number, y1: number, x2: number, y2: number): string {
  let dd = d`M${x1} ${y1}`;
  const n = 14;
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const off = (i % 2 ? 1 : -1) * 6;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    dd += d`L${px + off} ${py + off * 0.4}`;
  }
  return path(dd, "none", stroke(CHROME.shade, 2));
}

function lamp(a: Art, f: Finish, j1: readonly [number, number], j2: readonly [number, number], tilt: number): string {
  const [x1, y1] = j1;
  const [x2, y2] = j2;
  let out = ellipse(x2 + 60, 655, 230, 46, a.rad([
    [0, "#ffd98a", 0.55],
    [1, "#ffd98a", 0],
  ]));
  out += shadow(a, 292, 652, 140, 22);
  out += path(d`M${x2 + 10} 330L${x2 - 120} 650H${x2 + 260}L${x2 + 120} 330Z`, a.lin([
    [0, "#fff1c4", 0.32],
    [1, "#fff1c4", 0],
  ]));
  out += ellipse(290, 640, 112, 26, f.deep);
  out += ellipse(290, 630, 112, 26, a.lin([
    [0, f.hi],
    [1, f.shade],
  ], 0, 0, 1, 0.5), edge(f, 0.4));
  out += circle(290, 612, 14, dome(a, f));
  out += arm(a, 290, 612, x1, y1, f) + spring(296, 590, (290 + x1) / 2 + 10, (612 + y1) / 2);
  out += arm(a, x1, y1, x2, y2, f) + spring(x1 + 8, y1 + 4, (x1 + x2) / 2, (y1 + y2) / 2 + 8);
  out += circle(x1, y1, 13, dome(a, CHROME)) + circle(x1, y1, 5, CHROME.deep);
  const shade = g(
    path("M-22 0L-90 132A90 26 0 0 0 90 132L22 0Z", cylX(a, f), edge(f, f.light ? 0.6 : 0.25)) +
      ellipse(0, 0, 22, 8, f.shade) +
      ellipse(0, 132, 88, 24, a.rad([
        [0, "#ffffff"],
        [0.35, "#fff3c9"],
        [1, "#f2c66b"],
      ], 0.5, 0.4, 0.6)) +
      path("M-14 8L-70 118", "none", stroke("#ffffff", 6, { "stroke-opacity": 0.35 })),
    { transform: `translate(${x2 + 20} ${y2 + 18}) rotate(${tilt})` },
  );
  out += shade;
  out += circle(x2, y2, 14, dome(a, CHROME)) + circle(x2, y2, 5, CHROME.deep);
  return out;
}

export const drawLamp: DrawKind = (a, f, view) => {
  if (view === "1") return lamp(a, f, [380, 352], [540, 230], -14);
  if (view === "2") return lamp(a, f, [230, 330], [470, 200], 8);
  return g(lamp(a, f, [380, 352], [540, 230], -14), { transform: "translate(-640 -320) scale(2.1)" });
};

// -----------------------------------------------------------------------------
// Panelas
// -----------------------------------------------------------------------------

function pot(a: Art, f: Finish): string {
  let out = shadow(a, 400, 600, 250, 30);
  for (const s of [-1, 1] as const) {
    out += path(d`M${400 + s * 196} 410Q${400 + s * 250} 410 ${400 + s * 252} 432Q${400 + s * 250} 452 ${400 + s * 196} 452`, "none", stroke(f.deep, 22));
    out += path(d`M${400 + s * 196} 410Q${400 + s * 250} 410 ${400 + s * 252} 432Q${400 + s * 250} 452 ${400 + s * 196} 452`, "none", stroke(f.base, 14));
  }
  out += path("M200 380V540A200 52 0 0 0 600 540V380Z", cylX(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += path("M200 520A200 52 0 0 0 600 520V540A200 52 0 0 1 200 540Z", f.deep, { "fill-opacity": 0.4 });
  out += ellipse(400, 380, 204, 52, a.lin([
    [0, f.shade],
    [1, f.hi],
  ]));
  // tampa
  out += path("M206 378Q220 296 400 290Q580 296 594 378A196 46 0 0 1 206 378Z", a.rad([
    [0, f.hi],
    [0.5, f.base],
    [1, f.shade],
  ], 0.4, 0.2, 0.8), edge(f, f.light ? 0.6 : 0.2));
  out += path("M250 360Q290 316 400 310", "none", stroke("#ffffff", 8, { "stroke-opacity": 0.4 }));
  out += path("M350 292V276A50 14 0 0 1 450 276V292A50 14 0 0 1 350 292Z", cylX(a, CHROME));
  out += ellipse(400, 276, 50, 14, dome(a, CHROME));
  out += path("M222 420Q230 500 250 540", "none", stroke("#ffffff", 14, { "stroke-opacity": 0.3 }));
  return out;
}

function pan(a: Art, f: Finish): string {
  let out = shadow(a, 380, 560, 280, 40);
  out += path("M560 420L740 316Q762 306 770 322L774 330Q780 346 760 356L590 452Z", cylY(a, RUBBER));
  out += circle(742, 332, 7, "#0b0c0e");
  out += rect(540, 410, 60, 30, 8, CHROME.base, { transform: "rotate(-30 570 425)" });
  out += ellipse(360, 452, 230, 118, f.deep);
  out += ellipse(360, 440, 230, 116, a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, f.light ? 0.6 : 0.25));
  out += ellipse(360, 444, 206, 100, a.rad([
    [0, "#4a4f57"],
    [0.7, "#2a2d32"],
    [1, "#151619"],
  ], 0.45, 0.4, 0.7));
  out += ellipse(360, 444, 206, 100, a.pattern(14, 14, circle(3, 4, 1.1, "#ffffff", { "fill-opacity": 0.12 }) + circle(10, 10, 0.9, "#ffffff", { "fill-opacity": 0.1 })));
  out += path("M190 420Q250 360 380 352", "none", stroke("#ffffff", 10, { "stroke-opacity": 0.22 }));
  out += path("M168 440Q180 520 300 540", "none", stroke(f.hi, 3, { "stroke-opacity": 0.8 }));
  return out;
}

export const drawCookware: DrawKind = (a, f, view) => {
  if (view === "1") return pot(a, f);
  if (view === "2") return pan(a, f);
  return place(pan(a, f), 10, 20, 0.72) + place(pot(a, f), 250, 210, 0.66);
};

// -----------------------------------------------------------------------------
// Sofá
// -----------------------------------------------------------------------------

function fabricPattern(a: Art, f: Finish): string {
  return a.pattern(5, 5, rect(0, 0, 2.5, 2.5, 0, f.light ? "#000000" : "#ffffff", { "fill-opacity": 0.05 }));
}

function sofa(a: Art, f: Finish): string {
  const soft = (dir = 1) =>
    a.lin([
      [0, f.hi],
      [0.45, f.base],
      [1, f.shade],
    ], 0, 0, 0.3 * dir, 1);
  const tex = fabricPattern(a, f);
  let out = shadow(a, 400, 612, 340, 26);
  for (const x of [140, 650]) out += path(d`M${x} 590L${x + 4} 618H${x + 14}L${x + 16} 590Z`, cylX(a, WOOD));
  out += rect(110, 268, 580, 230, 34, a.lin([
    [0, f.base],
    [1, f.deep],
  ]));
  for (let i = 0; i < 3; i += 1) {
    const x = 166 + i * 158;
    out += rect(x, 286, 152, 160, 30, soft(), edge(f, 0.3));
    out += rect(x, 286, 152, 160, 30, tex);
    out += path(d`M${x + 20} 300Q${x + 76} 290 ${x + 132} 300`, "none", stroke("#ffffff", 6, { "stroke-opacity": 0.22 }));
  }
  out += rect(140, 470, 520, 120, 20, a.lin([
    [0, f.shade],
    [1, f.deep],
  ]));
  for (let i = 0; i < 3; i += 1) {
    const x = 166 + i * 158;
    out += rect(x, 430, 154, 60, 22, a.lin([
      [0, f.base],
      [1, f.hi],
    ]), edge(f, 0.3));
    out += rect(x, 476, 154, 62, 18, a.lin([
      [0, f.base],
      [1, f.shade],
    ]), edge(f, 0.3));
    out += rect(x, 430, 154, 108, 20, tex);
  }
  for (const x of [96, 632]) {
    out += rect(x, 352, 76, 236, 30, a.lin([
      [0, f.hi],
      [0.4, f.base],
      [1, f.shade],
    ], 0, 0, 1, 1), edge(f, 0.35));
    out += rect(x, 352, 76, 236, 30, tex);
    out += rect(x + 10, 360, 56, 14, 7, "#ffffff", { "fill-opacity": 0.25 });
  }
  const pillow = mix(f.base, f.neutral ? "#13a585" : "#ffffff", f.neutral ? 0.55 : 0.55);
  const pt = toneOf(pillow);
  out += path("M190 330Q236 318 290 334Q300 380 290 420Q240 430 194 418Q182 372 190 330Z", diag(a, pt), { transform: "rotate(-8 240 375)" });
  out += path("M512 334Q560 318 610 330Q618 372 606 418Q560 430 512 420Q500 380 512 334Z", diag(a, pt), { transform: "rotate(8 560 375)" });
  for (const x of [160, 404, 640]) out += path(d`M${x} 588L${x + 2} 620H${x + 12}L${x + 14} 588Z`, cylX(a, WOOD));
  return out;
}

function sofaSide(a: Art, f: Finish): string {
  let out = shadow(a, 400, 612, 270, 24);
  out += path("M200 230Q190 200 220 196L300 190Q330 190 334 220L350 470H200Z", a.lin([
    [0, f.hi],
    [1, f.shade],
  ], 0, 0, 1, 0.3), edge(f, 0.3));
  out += rect(170, 380, 460, 210, 30, a.lin([
    [0, f.base],
    [1, f.deep],
  ]));
  out += rect(300, 338, 340, 250, 34, a.lin([
    [0, f.hi],
    [0.35, f.base],
    [1, f.shade],
  ], 0, 0, 0.4, 1), edge(f, 0.35));
  out += rect(300, 338, 340, 250, 34, fabricPattern(a, f));
  out += rect(318, 346, 300, 14, 7, "#ffffff", { "fill-opacity": 0.25 });
  for (const x of [200, 600]) out += path(d`M${x} 588L${x + 4} 620H${x + 14}L${x + 18} 588Z`, cylX(a, WOOD));
  return out;
}

export const drawSofa: DrawKind = (a, f, view) => {
  if (view === "1") return sofa(a, f);
  if (view === "2") return sofaSide(a, f);
  return g(sofa(a, f), { transform: "translate(-200 -560) scale(2.2)" });
};
