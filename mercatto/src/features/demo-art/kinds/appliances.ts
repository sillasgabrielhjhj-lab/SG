/** Geladeira, lavadora, micro-ondas, air fryer, liquidificador, cafeteira e robô aspirador. */
import { BRAND, type Finish, mix } from "../palette";
import { CHROME, RUBBER, SNOW, cuboidBack, cylX, cylY, darkGlass, diag, dome, edge, flat, rimLight, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, rng, roundRectPath, stroke } from "../svg";
import type { DrawKind } from "./types";

const brushed = (a: Art, f: Finish) =>
  a.lin(
    [
      [0, mix(f.hi, f.base, 0.3)],
      [0.18, f.base],
      [0.42, mix(f.hi, f.base, 0.55)],
      [0.7, f.base],
      [1, f.shade],
    ],
    0,
    0,
    1,
    0.15,
  );

const handle = (a: Art, x: number, y: number, w: number, h: number) =>
  rect(x + 3, y + 4, w, h, Math.min(w, h) / 2, "#000000", { "fill-opacity": 0.22 }) +
  rect(x, y, w, h, Math.min(w, h) / 2, w < h ? cylX(a, CHROME) : cylY(a, CHROME));

// -----------------------------------------------------------------------------
// Geladeira French Door
// -----------------------------------------------------------------------------

function fridgeClosed(a: Art, f: Finish): string {
  const x = 230;
  const y = 92;
  const w = 340;
  const h = 600;
  let out = shadow(a, 420, 698, 250, 22);
  out += cuboidBack(a, f, x, y, w, h, 46, 26, 14);
  out += rect(x, y, w, h, 14, brushed(a, f), edge(f, f.light ? 0.5 : 0.2));
  out += rect(x, y + h - 26, w, 26, 6, "#1d2024");
  out += path(d`M${x + 20} ${y + h - 13}H${x + w - 20}`, "none", { stroke: "#3b4047", "stroke-width": 10, "stroke-dasharray": "4 4" });
  out += path(d`M${x + w / 2} ${y + 4}V${y + 376}M${x + 4} ${y + 380}H${x + w - 4}`, "none", { stroke: f.deep, "stroke-width": 4 });
  out += handle(a, x + w / 2 - 22, y + 110, 10, 230) + handle(a, x + w / 2 + 12, y + 110, 10, 230);
  out += handle(a, x + 70, y + 410, w - 140, 11);
  out += rect(x + 40, y + 120, 70, 44, 8, darkGlass(a));
  out += circle(x + 60, y + 142, 6, BRAND.jade400) + rect(x + 74, y + 134, 26, 5, 2, "#e9ecef") + rect(x + 74, y + 146, 18, 4, 2, "#7d858d");
  out += sheen(a, d`M${x} ${y}H${x + 120}L${x + 40} ${y + h}H${x}Z`, 0.3, 1, 0.2);
  out += rimLight(a, roundRectPath(x + 1, y + 1, w - 2, h - 2, 13), 0.6);
  return out;
}

function fridgeOpen(a: Art, f: Finish): string {
  const x = 250;
  const y = 92;
  const w = 300;
  const h = 600;
  const r = rng(7);
  let out = shadow(a, 400, 698, 330, 24);
  out += rect(x, y, w, h, 12, brushed(a, f), edge(f, f.light ? 0.5 : 0.2));
  // interior iluminado
  out += rect(x + 14, y + 14, w - 28, 352, 6, a.lin([
    [0, "#ffffff"],
    [1, "#e6ecef"],
  ]));
  out += rect(x + 14, y + 14, w - 28, 352, 6, a.rad([
    [0, "#fffbe8", 0.9],
    [1, "#fffbe8", 0],
  ], 0.5, 0, 0.8));
  out += path(d`M${x + 14} ${y + 14}L${x + 40} ${y + 40}V${y + 340}L${x + 14} ${y + 366}M${x + w - 14} ${y + 14}L${x + w - 40} ${y + 40}V${y + 340}L${x + w - 14} ${y + 366}`, "#d3dbe0", { "fill-opacity": 0.6 });
  const items = ["#e8505b", "#f5b400", "#3d8c64", "#59a6ff", "#ff9f43", "#ffffff"];
  for (let s = 0; s < 3; s += 1) {
    const sy = y + 130 + s * 105;
    out += rect(x + 30, sy, w - 60, 6, 2, "#cfe3ea", { stroke: "#ffffff", "stroke-width": 1 });
    let ix = x + 46;
    while (ix < x + w - 70) {
      const c = items[Math.floor(r() * items.length)] ?? "#e8505b";
      const kind = r();
      if (kind < 0.4) {
        const bh = 50 + r() * 30;
        out += rect(ix, sy - bh, 22, bh, 8, a.lin([
          [0, mix(c, "#ffffff", 0.35)],
          [1, c],
        ], 0, 0, 1, 0));
        out += rect(ix + 6, sy - bh - 10, 10, 12, 3, "#dfe3e6");
        ix += 34;
      } else if (kind < 0.75) {
        out += circle(ix + 16, sy - 16, 16, a.rad([
          [0, mix(c, "#ffffff", 0.45)],
          [1, mix(c, "#000000", 0.15)],
        ], 0.4, 0.35, 0.7));
        ix += 36;
      } else {
        out += rect(ix, sy - 40, 46, 40, 6, mix(c, "#ffffff", 0.55), { stroke: c, "stroke-width": 2 });
        ix += 56;
      }
    }
  }
  out += rect(x + 30, y + 14, w - 60, 10, 4, "#ffffff");
  // portas abertas (vistas de lado, com prateleiras internas)
  const door = (side: -1 | 1) => {
    const ex = side < 0 ? x : x + w;
    const ox = ex + side * 120;
    const dd = d`M${ex} ${y}L${ox} ${y - 40}V${y + 400}L${ex} ${y + 380}Z`;
    let o = path(dd, a.lin([
      [0, "#f6f8f9"],
      [1, "#d8dee2"],
    ], side < 0 ? 1 : 0, 0, side < 0 ? 0 : 1, 0), { stroke: "#c3cbd1", "stroke-width": 1.5 });
    for (let i = 0; i < 3; i += 1) {
      const by = y + 70 + i * 110;
      o += path(d`M${ex + side * 8} ${by + 8}L${ox - side * 6} ${by - 26}V${by + 10}L${ex + side * 8} ${by + 40}Z`, "#bfe0ec", { "fill-opacity": 0.65, stroke: "#9cc5d4", "stroke-width": 1 });
      o += rect(ex + side * 30 - 9, by - 30, 18, 46, 6, items[(i * 2 + (side > 0 ? 1 : 0)) % items.length] ?? "#59a6ff");
    }
    o += path(d`M${ox} ${y - 40}l${side * 10} -4V${y + 396}l${-side * 10} 4Z`, f.shade);
    return o;
  };
  out += door(-1) + door(1);
  out += path(d`M${x + 4} ${y + 380}H${x + w - 4}`, "none", { stroke: f.deep, "stroke-width": 4 });
  out += handle(a, x + 60, y + 410, w - 120, 11);
  out += rect(x, y + h - 26, w, 26, 6, "#1d2024");
  return out;
}

export const drawRefrigerator: DrawKind = (a, f, view) => {
  if (view === "1") return fridgeClosed(a, f);
  if (view === "2") return fridgeOpen(a, f);
  return g(fridgeClosed(a, f), { transform: "translate(-530 -150) scale(2.3)" });
};

// -----------------------------------------------------------------------------
// Lavadora (frontal)
// -----------------------------------------------------------------------------

function washerBody(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  let out = cuboidBack(a, f, x, y, w, h, 44, 28, 14);
  out += rect(x, y, w, h, 14, flat(a, f, 0.5, 1), edge(f, f.light ? 0.55 : 0.2));
  out += rect(x, y, w, 92, 14, a.lin([
    [0, f.hi],
    [1, f.base],
  ]));
  out += path(d`M${x + 2} ${y + 92}H${x + w - 2}`, "none", { stroke: f.deep, "stroke-opacity": 0.5, "stroke-width": 2 });
  out += rect(x + 20, y + 22, 110, 50, 8, f.shade, { "fill-opacity": 0.5 });
  out += rect(x + 30, y + 40, 90, 10, 5, f.deep, { "fill-opacity": 0.5 });
  out += rect(x + 150, y + 26, 120, 42, 8, darkGlass(a));
  out += rect(x + 162, y + 38, 44, 18, 3, BRAND.jade400, { "fill-opacity": 0.85 });
  out += circle(x + 222, y + 47, 4, BRAND.sun400) + circle(x + 238, y + 47, 4, "#59a6ff") + circle(x + 254, y + 47, 4, "#e9ecef");
  out += circle(x + w - 58, y + 47, 32, f.deep, { "fill-opacity": 0.35 });
  out += circle(x + w - 60, y + 45, 30, dome(a, CHROME));
  out += circle(x + w - 60, y + 45, 22, cylX(a, CHROME));
  out += line2(x + w - 60, y + 45, x + w - 60, y + 27);
  out += rect(x + 30, y + h - 40, w - 60, 4, 2, f.deep, { "fill-opacity": 0.35 });
  return out;
}

const line2 = (x1: number, y1: number, x2: number, y2: number) => path(d`M${x1} ${y1}L${x2} ${y2}`, "none", stroke("#3a3f45", 4));

function washerDoorGlass(a: Art, cx: number, cy: number): string {
  let out = circle(cx, cy, 112, a.rad([
    [0, "#2f4e66"],
    [0.6, "#16273a"],
    [1, "#070c12"],
  ], 0.45, 0.4, 0.6));
  out += circle(cx, cy, 104, a.pattern(10, 10, circle(5, 5, 1.6, "#9fb7c8", { "fill-opacity": 0.35 })));
  out += path(d`M${cx - 104} ${cy + 20}Q${cx - 50} ${cy - 5} ${cx} ${cy + 18}T${cx + 104} ${cy + 16}V${cy + 40}A104 104 0 0 1 ${cx - 104} ${cy + 40}Z`, "#6fb6e8", { "fill-opacity": 0.35 });
  out += path(d`M${cx - 60} ${cy + 40}q30 -40 70 -10q30 25 50 -5q10 50 -40 55q-60 5 -80 -40z`, "#e8505b", { "fill-opacity": 0.7 });
  out += path(d`M${cx - 20} ${cy - 50}q40 -20 70 10q-30 10 -50 30q-30 -10 -20 -40z`, "#f5d26b", { "fill-opacity": 0.6 });
  out += path(d`M${cx - 92} ${cy - 30}A96 96 0 0 1 ${cx + 10} ${cy - 96}`, "none", stroke("#ffffff", 10, { "stroke-opacity": 0.35 }));
  out += path(d`M${cx - 70} ${cy + 40}A80 80 0 0 0 ${cx - 30} ${cy + 74}`, "none", stroke("#ffffff", 4, { "stroke-opacity": 0.25 }));
  return out;
}

function washerClosed(a: Art, f: Finish): string {
  const x = 200;
  const y = 150;
  const w = 400;
  const h = 520;
  let out = shadow(a, 420, 676, 270, 22) + washerBody(a, f, x, y, w, h);
  const cx = 400;
  const cy = 420;
  out += circle(cx + 3, cy + 6, 158, "#000000", { "fill-opacity": 0.18 });
  out += circle(cx, cy, 156, dome(a, f.light ? toneOf("#e3e7ea") : CHROME), { stroke: "#7d858d", "stroke-width": 1.5 });
  out += circle(cx, cy, 134, a.lin([
    [0, "#1c1f23"],
    [1, "#3a3f46"],
  ], 0, 0, 1, 1));
  out += washerDoorGlass(a, cx, cy);
  out += rect(cx + 128, cy - 34, 18, 68, 9, f.deep, { "fill-opacity": 0.5 });
  out += rimLight(a, roundRectPath(x + 1, y + 1, w - 2, h - 2, 13), 0.6);
  return out;
}

function washerOpen(a: Art, f: Finish): string {
  const x = 250;
  const y = 150;
  const w = 400;
  const h = 520;
  let out = shadow(a, 430, 676, 320, 24) + washerBody(a, f, x, y, w, h);
  const cx = 450;
  const cy = 420;
  out += circle(cx, cy, 140, a.lin([
    [0, "#2b2f35"],
    [1, "#50565e"],
  ], 0, 0, 1, 1));
  out += circle(cx, cy, 116, a.rad([
    [0, "#9aa3ac"],
    [0.55, "#5d656e"],
    [1, "#22262b"],
  ], 0.5, 0.5, 0.55));
  out += circle(cx, cy, 108, a.pattern(12, 12, circle(6, 6, 2, "#1d2024", { "fill-opacity": 0.6 })));
  for (let i = 0; i < 3; i += 1) {
    const ang = (i * 2 * Math.PI) / 3 + 0.4;
    out += path(d`M${cx + Math.cos(ang) * 110} ${cy + Math.sin(ang) * 110}L${cx + Math.cos(ang) * 70} ${cy + Math.sin(ang) * 70}`, "none", stroke("#c9ced3", 14));
  }
  out += circle(cx, cy, 30, "#3b4047", { "fill-opacity": 0.6 });
  // porta aberta (vista de lado, à esquerda)
  out += ellipse(172, 420, 70, 158, "#000000", { "fill-opacity": 0.15 });
  out += ellipse(180, 420, 64, 156, dome(a, f.light ? toneOf("#e3e7ea") : CHROME), { stroke: "#7d858d", "stroke-width": 1.5 });
  out += ellipse(184, 420, 50, 128, a.rad([
    [0, "#3a5870"],
    [0.7, "#1b2a3a"],
    [1, "#0a1118"],
  ], 0.45, 0.4, 0.6));
  out += path("M160 330Q150 420 165 500", "none", stroke("#ffffff", 6, { "stroke-opacity": 0.35 }));
  out += rect(236, 400, 22, 40, 6, "#2b2f35");
  return out;
}

export const drawWasher: DrawKind = (a, f, view) => {
  if (view === "1") return washerClosed(a, f);
  if (view === "2") return washerOpen(a, f);
  return g(washerClosed(a, f), { transform: "translate(-560 -180) scale(2.4)" });
};

// -----------------------------------------------------------------------------
// Micro-ondas
// -----------------------------------------------------------------------------

function microwaveBody(a: Art, f: Finish, x: number, y: number, w: number, h: number): string {
  let out = cuboidBack(a, f, x, y, w, h, 56, 36, 12);
  out += rect(x, y, w, h, 12, flat(a, f, 0.6, 1), edge(f, f.light ? 0.55 : 0.2));
  const px = x + w - 138;
  out += rect(px, y + 14, 124, h - 28, 8, a.lin([
    [0, "#25282d"],
    [1, "#0d0e10"],
  ]));
  out += rect(px + 14, y + 32, 96, 34, 5, "#040506");
  out += rect(px + 26, y + 42, 50, 14, 2, BRAND.jade400, { "fill-opacity": 0.9 });
  out += circle(px + 94, y + 49, 4, BRAND.sun400);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out += rect(px + 16 + c * 32, y + 84 + r * 30, 26, 20, 5, a.lin([
        [0, "#41454c"],
        [1, "#26292e"],
      ]));
    }
  }
  out += circle(px + 62, y + h - 58, 30, "#000000", { "fill-opacity": 0.4 });
  out += circle(px + 62, y + h - 60, 28, dome(a, CHROME));
  out += circle(px + 62, y + h - 60, 20, cylX(a, CHROME));
  return out;
}

function microwaveClosed(a: Art, f: Finish): string {
  const x = 110;
  const y = 260;
  const w = 560;
  const h = 320;
  let out = shadow(a, 420, 584, 340, 24) + microwaveBody(a, f, x, y, w, h);
  out += rect(x + 22, y + 22, w - 190, h - 44, 10, darkGlass(a));
  out += rect(x + 46, y + 44, w - 238, h - 88, 4, a.rad([
    [0, "#4a3a22", 0.9],
    [1, "#0b0c0e", 0],
  ], 0.5, 0.6, 0.6));
  out += rect(x + 46, y + 44, w - 238, h - 88, 4, a.pattern(7, 7, circle(3.5, 3.5, 1.4, "#000000", { "fill-opacity": 0.55 })));
  out += handle(a, x + w - 168, y + 40, 12, h - 80);
  out += sheen(a, d`M${x + 22} ${y + 22}H${x + 200}L${x + 100} ${y + h - 22}H${x + 22}Z`, 0.2, 1, 0.3);
  out += rimLight(a, roundRectPath(x + 1, y + 1, w - 2, h - 2, 11), 0.6);
  return out;
}

function microwaveOpen(a: Art, f: Finish): string {
  const x = 190;
  const y = 260;
  const w = 520;
  const h = 300;
  let out = shadow(a, 400, 566, 360, 24) + microwaveBody(a, f, x, y, w, h);
  const cw = w - 170;
  out += rect(x + 18, y + 18, cw, h - 36, 6, "#e9e3d6");
  out += path(d`M${x + 18} ${y + 18}L${x + 70} ${y + 60}H${x + cw - 34}L${x + cw + 18} ${y + 18}Z`, "#f6f1e6");
  out += path(d`M${x + 18} ${y + h - 18}L${x + 70} ${y + h - 70}H${x + cw - 34}L${x + cw + 18} ${y + h - 18}Z`, "#d8d0bf");
  out += rect(x + 70, y + 60, cw - 104, h - 130, 2, a.rad([
    [0, "#fff6d8"],
    [1, "#e0d6c0"],
  ], 0.5, 0.2, 0.8));
  out += ellipse(x + 18 + cw / 2, y + h - 52, 130, 22, "#ffffff", { "fill-opacity": 0.55, stroke: "#c9c1b0", "stroke-width": 2 });
  // porta aberta para a esquerda
  out += path(d`M${x} ${y}L${x - 110} ${y + 40}V${y + h + 22}L${x} ${y + h}Z`, a.lin([
    [0, "#2b2f35"],
    [1, "#0f1113"],
  ], 1, 0, 0, 0));
  out += path(d`M${x - 14} ${y + 28}L${x - 96} ${y + 58}V${y + h - 6}L${x - 14} ${y + h - 22}Z`, a.pattern(7, 7, circle(3.5, 3.5, 1.4, "#5a6068", { "fill-opacity": 0.5 })));
  out += path(d`M${x - 110} ${y + 40}l-8 2V${y + h + 24}l8 -2Z`, f.shade);
  return out;
}

export const drawMicrowave: DrawKind = (a, f, view) => {
  if (view === "1") return microwaveClosed(a, f);
  if (view === "2") return microwaveOpen(a, f);
  return g(microwaveClosed(a, f), { transform: "translate(-830 -480) scale(2.2)" });
};

// -----------------------------------------------------------------------------
// Air fryer
// -----------------------------------------------------------------------------

function airfryer(a: Art, f: Finish, side: boolean): string {
  let out = shadow(a, side ? 420 : 400, 650, 220, 24);
  if (side) {
    out += path("M520 230Q520 186 562 196L600 206Q620 212 620 240V590Q620 618 600 624L560 636Q520 646 520 600Z", a.lin([
      [0, f.shade],
      [1, f.deep],
    ], 0, 0, 1, 0));
  }
  const body = "M250 300Q250 190 360 186H440Q550 190 550 300V590Q550 640 500 640H300Q250 640 250 590Z";
  out += path(body, a.lin([
    [0, f.hi],
    [0.3, f.base],
    [0.8, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0.7), edge(f, f.light ? 0.6 : 0.25));
  out += path("M286 290Q290 222 366 218H434Q510 222 514 290V318H286Z", darkGlass(a));
  out += circle(400, 266, 26, "none", stroke(BRAND.jade400, 4));
  out += circle(400, 266, 26, "none", stroke(BRAND.jade400, 10, { "stroke-opacity": 0.18 }));
  out += circle(330, 270, 6, "#e9ecef", { "fill-opacity": 0.8 }) + circle(470, 270, 6, "#e9ecef", { "fill-opacity": 0.8 });
  out += rect(386, 300, 28, 4, 2, "#e9ecef", { "fill-opacity": 0.6 });
  // gaveta/cesto
  out += path("M268 352H532V586Q532 618 500 618H300Q268 618 268 586Z", a.lin([
    [0, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1));
  out += path("M268 352H532", "none", stroke(f.deep, 4, { "stroke-opacity": 0.6 }));
  out += rect(310, 380, 180, 70, 14, darkGlass(a));
  out += rect(310, 380, 180, 70, 14, a.rad([
    [0, "#f0a640", 0.55],
    [1, "#f0a640", 0],
  ], 0.5, 0.8, 0.6));
  out += path("M360 470H440V520Q440 560 420 572H380Q360 560 360 520Z", "#000000", { "fill-opacity": 0.25, transform: "translate(4 6)" });
  out += path("M360 470H440V520Q440 560 420 572H380Q360 560 360 520Z", cylX(a, RUBBER));
  out += sheen(a, "M262 290Q266 206 350 196H380Q300 230 300 320V600H262Z", 0.4, 1, 0.3);
  return out;
}

function fries(a: Art, cx: number, cy: number): string {
  const r = rng(42);
  let out = "";
  for (let i = 0; i < 46; i += 1) {
    const x = cx + (r() - 0.5) * 300;
    const y = cy + (r() - 0.5) * 90 - 10;
    const ang = (r() - 0.5) * 150;
    const len = 70 + r() * 50;
    const tone = r();
    out += rect(x - len / 2, y - 7, len, 14, 3, tone > 0.6 ? "#e8a93c" : tone > 0.25 ? "#f2c35a" : "#d68f2a", {
      transform: `rotate(${ang.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})`,
      stroke: "#b8741d",
      "stroke-width": 1,
    });
  }
  return out + ellipse(cx, cy - 10, 170, 70, a.rad([
    [0, "#fff3c9", 0.25],
    [1, "#fff3c9", 0],
  ]));
}

function fryerBasket(a: Art, f: Finish): string {
  let out = shadow(a, 380, 640, 300, 30);
  out += path("M150 380Q150 360 170 360H590Q610 360 610 380L580 600Q574 630 540 630H220Q186 630 180 600Z", a.lin([
    [0, "#3a3e44"],
    [1, "#141518"],
  ], 0, 0, 1, 1));
  out += ellipse(380, 372, 228, 62, "#0c0d0f");
  out += g(fries(a, 380, 360), { "clip-path": a.clip(ellipse(380, 360, 222, 80, "#000")) });
  out += path("M150 380Q150 360 170 360H590Q610 360 610 380", "none", stroke("#5a6068", 4));
  out += path("M600 420H700Q740 420 740 460V500Q740 530 700 530H600Z", a.lin([
    [0, f.hi],
    [1, f.shade],
  ]), edge(f, 0.4));
  out += rect(640, 440, 80, 70, 20, cylY(a, RUBBER));
  return out;
}

export const drawAirfryer: DrawKind = (a, f, view) => {
  if (view === "1") return airfryer(a, f, false);
  if (view === "2") return airfryer(a, f, true);
  return fryerBasket(a, f);
};

// -----------------------------------------------------------------------------
// Liquidificador
// -----------------------------------------------------------------------------

function blender(a: Art, f: Finish, full: boolean): string {
  let out = shadow(a, 400, 666, 190, 22);
  // base do motor
  out += path("M296 520H504L528 640Q530 656 512 656H288Q270 656 272 640Z", a.lin([
    [0, f.hi],
    [0.35, f.base],
    [1, f.deep],
  ], 0, 0, 1, 0.6), edge(f, f.light ? 0.6 : 0.25));
  out += rect(296, 520, 208, 14, 4, f.deep, { "fill-opacity": 0.5 });
  out += circle(400, 594, 34, "#000000", { "fill-opacity": 0.3 });
  out += circle(400, 592, 32, dome(a, CHROME));
  out += circle(400, 592, 22, cylX(a, CHROME));
  out += line2(400, 592, 414, 574);
  out += circle(338, 594, 6, "#e9ecef") + circle(462, 594, 6, BRAND.jade400);
  // copo
  const jar = "M286 160H514L476 500H324Z";
  if (full) {
    out += path("M318 300H482L474 500H326Z", a.lin([
      [0, "#f27a9a"],
      [1, "#b8304f"],
    ], 0, 0, 1, 1), { "fill-opacity": 0.9 });
    out += ellipse(400, 300, 82, 10, "#f9b8c8");
  }
  out += path(jar, a.lin([
    [0, "#ffffff", 0.45],
    [0.5, "#dfe9ee", 0.18],
    [1, "#a9bdc8", 0.4],
  ], 0, 0, 1, 0), { stroke: "#9fb3bf", "stroke-width": 2 });
  if (!full) {
    for (let i = 0; i < 5; i += 1) out += path(d`M330 ${260 + i * 46}h${20 + (i % 2) * 14}`, "none", stroke("#8aa0ad", 2));
    out += path("M360 470L440 450M366 452L434 474", "none", stroke(CHROME.shade, 9));
    out += circle(400, 462, 9, "#3a3f45");
  }
  out += path("M500 200Q590 220 580 330Q572 430 488 440", "none", stroke("#2b2f35", 26, { "stroke-opacity": 0.85 }));
  out += path("M500 200Q590 220 580 330Q572 430 488 440", "none", stroke("#ffffff", 4, { "stroke-opacity": 0.25 }));
  out += path("M300 172L330 488", "none", stroke("#ffffff", 10, { "stroke-opacity": 0.55 }));
  out += path("M330 172L352 488", "none", stroke("#ffffff", 4, { "stroke-opacity": 0.35 }));
  out += rect(318, 496, 164, 26, 6, cylX(a, RUBBER));
  // tampa
  out += rect(276, 140, 248, 30, 12, cylX(a, RUBBER));
  out += rect(366, 118, 68, 26, 10, cylX(a, RUBBER));
  return out;
}

export const drawBlender: DrawKind = (a, f, view) => {
  if (view === "1") return blender(a, f, true);
  if (view === "2") return blender(a, f, false);
  return g(blender(a, f, false), { transform: "translate(-560 -760) scale(2.4)" });
};

// -----------------------------------------------------------------------------
// Cafeteira espresso
// -----------------------------------------------------------------------------

function cup(a: Art, cx: number, y: number, s: number): string {
  return (
    ellipse(cx, y + 60 * s, 70 * s, 14 * s, a.lin([
      [0, "#ffffff"],
      [1, "#d6dade"],
    ])) +
    path(d`M${cx - 48 * s} ${y}H${cx + 48 * s}L${cx + 40 * s} ${y + 46 * s}Q${cx + 36 * s} ${y + 58 * s} ${cx + 20 * s} ${y + 58 * s}H${cx - 20 * s}Q${cx - 36 * s} ${y + 58 * s} ${cx - 40 * s} ${y + 46 * s}Z`, cylX(a, SNOW), edge(SNOW, 0.5)) +
    path(d`M${cx + 44 * s} ${y + 10 * s}q${26 * s} 0 ${22 * s} ${18 * s}q${-4 * s} ${14 * s} ${-26 * s} ${12 * s}`, "none", stroke("#e3e6e9", 7 * s)) +
    ellipse(cx, y + 2 * s, 46 * s, 8 * s, a.rad([
      [0, "#c78b4e"],
      [0.7, "#7a4a22"],
      [1, "#4a2a12"],
    ]))
  );
}

function espresso(a: Art, f: Finish): string {
  const x = 230;
  const y = 170;
  const w = 340;
  const h = 470;
  let out = shadow(a, 420, 646, 260, 22);
  out += cuboidBack(a, f, x, y, w, h, 40, 24, 16);
  out += rect(x, y, w, h, 16, a.lin([
    [0, f.hi],
    [0.25, f.base],
    [0.85, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0.4), edge(f, f.light ? 0.55 : 0.2));
  out += path(d`M${x + 10} ${y - 4}L${x + 40} ${y - 22}H${x + w + 30}L${x + w - 10} ${y - 4}`, "none", stroke(CHROME.base, 4));
  // painel e manômetro
  out += circle(400, 250, 40, "#000000", { "fill-opacity": 0.25 });
  out += circle(400, 248, 38, dome(a, CHROME));
  out += circle(400, 248, 30, "#fbfbf8");
  let ticks = "";
  for (let i = 0; i <= 8; i += 1) {
    const ang = Math.PI * (0.8 + (i * 1.4) / 8);
    ticks += d`M${400 + Math.cos(ang) * 22} ${248 + Math.sin(ang) * 22}L${400 + Math.cos(ang) * 27} ${248 + Math.sin(ang) * 27}`;
  }
  out += path(ticks, "none", stroke("#3a3f45", 2));
  out += line2(400, 248, 416, 234) + circle(400, 248, 4, "#3a3f45");
  out += circle(310, 250, 13, cylX(a, CHROME)) + circle(490, 250, 13, cylX(a, CHROME));
  // grupo e porta-filtro
  out += rect(340, 318, 120, 40, 12, cylX(a, CHROME));
  out += rect(352, 356, 96, 28, 8, cylX(a, CHROME));
  out += path("M440 368L600 410Q616 416 610 432L604 446Q598 456 584 452L432 392Z", cylY(a, RUBBER));
  out += rect(386, 382, 10, 14, 3, CHROME.shade) + rect(404, 382, 10, 14, 3, CHROME.shade);
  out += path("M391 396V470M409 396V470", "none", stroke("#6b3e1c", 3, { "stroke-opacity": 0.9 }));
  // vaporizador
  out += path("M532 330V500Q532 520 518 530", "none", stroke(CHROME.shade, 10));
  out += path("M532 330V500Q532 520 518 530", "none", stroke(CHROME.hi, 4));
  out += circle(532, 322, 12, cylX(a, RUBBER));
  // bandeja
  out += rect(270, 556, 260, 30, 6, cylY(a, CHROME));
  let slots = "";
  for (let i = 0; i < 11; i += 1) slots += d`M${290 + i * 22} 564v14`;
  out += path(slots, "none", stroke("#4a5058", 4));
  out += cup(a, 400, 474, 1);
  out += sheen(a, d`M${x + 6} ${y + 6}H${x + 90}L${x + 30} ${y + h - 6}H${x + 6}Z`, 0.35, 1, 0.2);
  return out;
}

function espressoSide(a: Art, f: Finish): string {
  let out = shadow(a, 420, 646, 240, 22);
  out += rect(300, 170, 320, 470, 16, a.lin([
    [0, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), edge(f, f.light ? 0.55 : 0.2));
  out += rect(520, 190, 80, 330, 12, a.lin([
    [0, "#bfe3f2", 0.75],
    [1, "#7cb8d4", 0.75],
  ]), { stroke: "#9fc6d8", "stroke-width": 2 });
  out += rect(526, 300, 68, 214, 8, "#5aa7cc", { "fill-opacity": 0.35 });
  out += rect(250, 318, 80, 44, 12, cylY(a, CHROME));
  out += path("M262 360L120 400Q104 406 108 420L112 432Q118 442 132 438L272 392Z", cylY(a, RUBBER));
  out += rect(240, 556, 120, 30, 6, cylY(a, CHROME));
  out += cup(a, 290, 476, 0.85);
  out += path("M286 392V470", "none", stroke("#6b3e1c", 3));
  out += sheen(a, "M306 176H420L340 634H306Z", 0.35, 1, 0.2);
  return out;
}

export const drawCoffeemaker: DrawKind = (a, f, view) => {
  if (view === "1") return espresso(a, f);
  if (view === "2") return espressoSide(a, f);
  return g(espresso(a, f), { transform: "translate(-560 -760) scale(2.4)" });
};

// -----------------------------------------------------------------------------
// Robô aspirador
// -----------------------------------------------------------------------------

function robot(a: Art, f: Finish): string {
  let out = shadow(a, 400, 520, 290, 50);
  out += path("M150 420V462A250 104 0 0 0 650 462V420Z", a.lin([
    [0, "#2a2d32"],
    [1, "#0f1113"],
  ]));
  out += path("M152 444A250 104 0 0 0 648 444", "none", stroke("#4a4f57", 3));
  out += ellipse(400, 420, 250, 104, a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.shade],
  ], 0, 0, 0.6, 1), edge(f, f.light ? 0.6 : 0.25));
  out += ellipse(400, 420, 214, 86, "none", { stroke: f.deep, "stroke-opacity": 0.25, "stroke-width": 2 });
  // torre lidar
  out += path("M340 372V392A60 22 0 0 0 460 392V372Z", cylX(a, RUBBER));
  out += ellipse(400, 372, 60, 22, a.lin([
    [0, "#4a4f57"],
    [1, "#1d2024"],
  ]));
  out += ellipse(400, 372, 40, 13, "#111214");
  out += ellipse(400, 470, 30, 10, f.deep, { "fill-opacity": 0.5 });
  out += ellipse(400, 468, 22, 7, BRAND.jade400, { "fill-opacity": 0.85 });
  out += sheen(a, "M230 380Q320 330 440 328Q330 350 250 420Z", 0.5);
  return out;
}

function robotUnder(a: Art, f: Finish): string {
  let out = path(roundRectPath(160, 160, 480, 480, 240), "#0f1a18", { "fill-opacity": 0.25, filter: a.blur(16), transform: "translate(8 16)" });
  out += circle(400, 400, 240, diag(a, f), edge(f, 0.4));
  out += circle(400, 400, 222, a.rad([
    [0, "#3a3e44"],
    [1, "#16181b"],
  ]));
  out += rect(270, 420, 260, 70, 20, "#0c0d0f");
  out += rect(282, 430, 236, 50, 25, a.pattern(18, 50, path("M0 50L18 0", "none", stroke("#e9a03a", 6)), undefined));
  out += rect(282, 430, 236, 50, 25, cylY(a, RUBBER), { "fill-opacity": 0.55 });
  out += rect(210, 340, 44, 120, 20, cylX(a, RUBBER)) + rect(546, 340, 44, 120, 20, cylX(a, RUBBER));
  out += circle(400, 250, 22, "#0c0d0f") + circle(400, 250, 14, cylX(a, RUBBER));
  out += rect(330, 560, 40, 12, 4, CHROME.base) + rect(430, 560, 40, 12, 4, CHROME.base);
  for (const [cx, cy] of [
    [240, 250],
    [560, 250],
  ] as const) {
    out += circle(cx, cy, 14, "#26292e");
    for (let i = 0; i < 3; i += 1) {
      const ang = (i * 2 * Math.PI) / 3 + (cx < 400 ? 0.3 : 0.9);
      out += path(d`M${cx} ${cy}L${cx + Math.cos(ang) * 84} ${cy + Math.sin(ang) * 84}`, "none", stroke("#5a6068", 7));
      out += path(d`M${cx + Math.cos(ang) * 30} ${cy + Math.sin(ang) * 30}L${cx + Math.cos(ang) * 92} ${cy + Math.sin(ang) * 92}`, "none", stroke("#8a9099", 3, { "stroke-dasharray": "2 3" }));
    }
  }
  return out;
}

function dock(a: Art): string {
  const t = toneOf("#2c3036");
  return (
    shadow(a, 400, 470, 150, 22) +
    path("M310 470V250Q310 220 340 220H460Q490 220 490 250V470Z", diag(a, t)) +
    rect(350, 260, 100, 40, 14, "#0c0d0f") +
    rect(360, 270, 80, 20, 10, a.lin([
      [0, "#5a6068"],
      [1, "#16181b"],
    ])) +
    rect(380, 440, 14, 22, 3, CHROME.base) +
    rect(406, 440, 14, 22, 3, CHROME.base)
  );
}

export const drawRobotVacuum: DrawKind = (a, f, view) => {
  if (view === "1") return robot(a, f);
  if (view === "2") return robotUnder(a, f);
  return dock(a) + place(robot(a, f), 64, 140, 0.84);
};
