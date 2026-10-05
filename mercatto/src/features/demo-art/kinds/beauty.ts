/** Perfume, skincare e secador de cabelo. */
import { type Finish, mix } from "../palette";
import { CHROME, RUBBER, SNOW, cylX, cylY, diag, dome, edge, packageBox, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, stroke } from "../svg";
import type { DrawKind } from "./types";

const caustic = (a: Art, f: Finish, cx: number, cy: number, rx: number, ry: number) =>
  ellipse(cx + 30, cy, rx, ry, a.rad([
    [0, f.base, 0.35],
    [1, f.base, 0],
  ]));

// -----------------------------------------------------------------------------
// Perfume
// -----------------------------------------------------------------------------

function perfumeBottle(a: Art, f: Finish, w: number, withCap: boolean): string {
  const x = 400 - w / 2;
  const y = 300;
  const h = 340;
  const liquid = a.lin([
    [0, mix(f.hi, "#ffffff", 0.2), 0.9],
    [0.5, f.base, 0.85],
    [1, f.shade, 0.95],
  ], 0, 0, 1, 1);
  let out = caustic(a, f, 400, h + y + 6, w * 0.7, 26) + shadow(a, 400, y + h + 4, w * 0.6, 16);
  out += rect(x, y, w, h, 26, a.lin([
    [0, "#ffffff", 0.7],
    [0.5, "#e8eef1", 0.35],
    [1, "#b8c6ce", 0.6],
  ], 0, 0, 1, 0), { stroke: "#9fb0ba", "stroke-width": 2 });
  out += rect(x + 24, y + 40, w - 48, h - 90, 12, liquid);
  out += rect(x + 24, y + 40, w - 48, 16, 8, mix(f.hi, "#ffffff", 0.5), { "fill-opacity": 0.6 });
  out += path(d`M400 ${y - 10}V${y + h - 60}`, "none", stroke("#ffffff", 3, { "stroke-opacity": 0.6 }));
  out += rect(x + 10, y + h - 44, w - 20, 34, 12, "#ffffff", { "fill-opacity": 0.35 });
  out += rect(x + 10, y + 10, 14, h - 20, 7, "#ffffff", { "fill-opacity": 0.7 });
  out += rect(x + w - 30, y + 20, 8, h - 60, 4, "#ffffff", { "fill-opacity": 0.45 });
  out += path(d`M${x + 4} ${y + 30}L${x + w * 0.4} ${y + 4}`, "none", stroke("#ffffff", 4, { "stroke-opacity": 0.6 }));
  // gargalo
  out += rect(400 - 44, y - 34, 88, 38, 6, cylX(a, CHROME));
  out += rect(400 - 48, y - 6, 96, 10, 4, cylX(a, CHROME));
  if (withCap) {
    out += rect(400 - 82, y - 156, 164, 124, 18, diag(a, f), edge(f, 0.4));
    out += rect(400 - 82, y - 156, 164, 124, 18, a.lin([
      [0, "#ffffff", 0.3],
      [0.3, "#ffffff", 0],
      [0.8, "#000000", 0],
      [1, "#000000", 0.2],
    ], 0, 0, 1, 0));
    out += rect(400 - 64, y - 146, 18, 104, 9, "#ffffff", { "fill-opacity": 0.45 });
  } else {
    out += rect(400 - 20, y - 64, 40, 32, 8, cylX(a, CHROME));
    out += circle(400 + 12, y - 50, 4, "#2b2e33");
  }
  return out;
}

export const drawPerfume: DrawKind = (a, f, view) => {
  if (view === "1") return perfumeBottle(a, f, 270, true);
  if (view === "2") return perfumeBottle(a, f, 160, false);
  return packageBox(a, f, 140, 210, 250, 420, 70) + place(perfumeBottle(a, f, 270, true), 230, 120, 0.72);
};

// -----------------------------------------------------------------------------
// Skincare
// -----------------------------------------------------------------------------

function dropper(a: Art, f: Finish, x: number, base: number): string {
  let out = shadow(a, x, base + 4, 80, 12);
  out += path(d`M${x - 60} ${base - 210}Q${x - 60} ${base - 250} ${x - 20} ${base - 254}H${x + 20}Q${x + 60} ${base - 250} ${x + 60} ${base - 210}V${base - 14}Q${x + 60} ${base} ${x + 46} ${base}H${x - 46}Q${x - 60} ${base} ${x - 60} ${base - 14}Z`, a.lin([
    [0, f.hi, 0.85],
    [0.5, f.base, 0.8],
    [1, f.shade, 0.9],
  ], 0, 0, 1, 0), { stroke: f.deep, "stroke-opacity": 0.4, "stroke-width": 1.5 });
  out += rect(x - 46, base - 120, 92, 70, 6, "#ffffff", { "fill-opacity": 0.75 });
  out += rect(x - 30, base - 98, 60, 6, 3, f.shade, { "fill-opacity": 0.6 });
  out += rect(x - 30, base - 84, 40, 5, 2.5, f.shade, { "fill-opacity": 0.4 });
  out += rect(x - 50, base - 236, 10, 200, 5, "#ffffff", { "fill-opacity": 0.5 });
  out += rect(x - 34, base - 300, 68, 52, 8, cylX(a, toneOf("#2b2e33")));
  out += path(d`M${x - 22} ${base - 300}V${base - 340}Q${x - 22} ${base - 372} ${x} ${base - 372}Q${x + 22} ${base - 372} ${x + 22} ${base - 340}V${base - 300}Z`, cylX(a, RUBBER));
  return out;
}

function jar(a: Art, f: Finish, cx: number, base: number, lid: boolean): string {
  const glass = toneOf("#f1f2f0");
  let out = shadow(a, cx, base + 4, 120, 16);
  out += path(d`M${cx - 100} ${base - 120}V${base - 16}A100 22 0 0 0 ${cx + 100} ${base - 16}V${base - 120}Z`, cylX(a, glass), edge(glass, 0.5));
  out += path(d`M${cx - 100} ${base - 50}A100 22 0 0 0 ${cx + 100} ${base - 50}V${base - 16}A100 22 0 0 1 ${cx - 100} ${base - 16}Z`, f.base, { "fill-opacity": 0.35 });
  if (lid) {
    out += path(d`M${cx - 104} ${base - 168}V${base - 118}A104 22 0 0 0 ${cx + 104} ${base - 118}V${base - 168}Z`, cylX(a, f), edge(f, 0.4));
    out += ellipse(cx, base - 168, 104, 22, a.lin([
      [0, f.hi],
      [1, f.base],
    ]));
  } else {
    out += ellipse(cx, base - 120, 100, 22, "#e9e4dc");
    out += ellipse(cx, base - 118, 88, 17, a.rad([
      [0, "#ffffff"],
      [1, "#efe8dd"],
    ], 0.4, 0.4, 0.7));
    out += path(d`M${cx - 50} ${base - 116}Q${cx - 20} ${base - 160} ${cx + 10} ${base - 140}Q${cx + 30} ${base - 128} ${cx + 4} ${base - 122}Q${cx + 40} ${base - 120} ${cx + 50} ${base - 112}`, "#ffffff", { stroke: "#e2d9cc", "stroke-width": 2 });
  }
  return out;
}

function tube(a: Art, f: Finish, cx: number, base: number): string {
  let out = shadow(a, cx, base + 4, 60, 10);
  out += rect(cx - 36, base - 50, 72, 50, 8, cylX(a, f));
  out += path(d`M${cx - 44} ${base - 50}L${cx - 54} ${base - 330}H${cx + 54}L${cx + 44} ${base - 50}Z`, cylX(a, SNOW), edge(SNOW, 0.6));
  out += rect(cx - 56, base - 344, 112, 18, 3, a.lin([
    [0, "#e9ecef"],
    [1, "#c3c9ce"],
  ]));
  out += rect(cx - 34, base - 250, 68, 90, 6, f.base, { "fill-opacity": 0.85 });
  return out;
}

function pump(a: Art, f: Finish): string {
  let out = shadow(a, 400, 664, 120, 18);
  out += rect(300, 270, 200, 390, 40, cylX(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(318, 420, 164, 140, 10, "#ffffff", { "fill-opacity": 0.8 });
  out += rect(340, 450, 120, 10, 5, f.shade, { "fill-opacity": 0.6 });
  out += rect(340, 470, 90, 8, 4, f.shade, { "fill-opacity": 0.4 });
  out += rect(352, 220, 96, 56, 10, cylX(a, f));
  out += rect(386, 150, 28, 76, 6, cylX(a, CHROME));
  out += path("M370 150H470Q500 150 500 170V178H370Z", cylY(a, f));
  out += rect(370, 128, 70, 26, 8, cylX(a, f));
  out += sheen(a, "M318 290H360V640H318Z", 0.35, 1, 0);
  return out;
}

export const drawSkincare: DrawKind = (a, f, view) => {
  if (view === "1") return dropper(a, f, 260, 640) + tube(a, f, 620, 640) + jar(a, f, 430, 660, true);
  if (view === "2") return pump(a, f);
  return g(jar(a, f, 400, 640, false), { transform: "translate(-400 -560) scale(2)" }) + place(jar(a, f, 0, 0, true), 650, 760, 0.8, -12);
};

// -----------------------------------------------------------------------------
// Secador de cabelo
// -----------------------------------------------------------------------------

function dryerSide(a: Art, f: Finish): string {
  let out = shadow(a, 400, 690, 230, 22);
  out += path("M520 646Q560 700 640 690", "none", stroke(RUBBER.base, 9));
  // cabo
  out += path("M426 360H520L560 620Q566 652 532 656H484Q456 656 452 628Z", cylX(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(470, 430, 26, 64, 13, f.deep, { transform: "rotate(-9 483 462)" });
  out += rect(474, 436, 18, 26, 9, "#f3f4f5", { transform: "rotate(-9 483 462)" });
  out += rect(482, 510, 22, 50, 11, f.deep, { transform: "rotate(-9 493 535)" });
  // corpo
  out += path("M200 300Q200 228 272 228H560Q628 228 628 300Q628 372 560 372H272Q200 372 200 300Z", cylY(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += ellipse(608, 300, 30, 72, a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0));
  out += ellipse(612, 300, 22, 60, a.pattern(6, 6, circle(3, 3, 1.4, "#000000", { "fill-opacity": 0.5 })));
  out += path("M206 300Q206 238 270 236", "none", stroke("#ffffff", 4, { "stroke-opacity": 0.5 }));
  // bocal concentrador
  out += path("M210 252L110 276Q96 280 96 294V306Q96 320 110 324L210 348Z", a.lin([
    [0, "#4a4f57"],
    [0.5, "#24272b"],
    [1, "#121315"],
  ]));
  out += path("M110 276Q96 280 96 294V306Q96 320 110 324", "none", stroke("#6b727b", 2));
  out += rect(250, 240, 300, 22, 11, "#ffffff", { "fill-opacity": 0.35 });
  return out;
}

function dryerBack(a: Art, f: Finish): string {
  let out = shadow(a, 400, 720, 160, 18);
  out += path("M346 420H454L470 690Q470 712 448 712H352Q330 712 330 690Z", cylX(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(386, 520, 28, 70, 14, f.deep);
  out += circle(400, 320, 160, dome(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += circle(400, 320, 124, "#16181b");
  out += circle(400, 320, 120, a.pattern(12, 10.4, circle(6, 5.2, 3.6, "#3a3f46") + circle(0, 0, 3.6, "#3a3f46") + circle(12, 0, 3.6, "#3a3f46") + circle(0, 10.4, 3.6, "#3a3f46") + circle(12, 10.4, 3.6, "#3a3f46")));
  out += circle(400, 320, 30, dome(a, f));
  out += path("M276 250A150 150 0 0 1 400 172", "none", stroke("#ffffff", 8, { "stroke-opacity": 0.4 }));
  return out;
}

function diffuser(a: Art): string {
  const t = toneOf("#3a3e44");
  let out = shadow(a, 0, 90, 130, 16);
  out += path("M-120 0Q-120 80 0 84Q120 80 120 0Z", diag(a, t));
  out += ellipse(0, 0, 120, 30, "#16181b");
  for (let i = -4; i <= 4; i += 1) out += rect(i * 24 - 5, -40 + Math.abs(i) * 4, 10, 46, 5, cylX(a, t));
  out += rect(-50, 70, 100, 40, 10, cylX(a, t));
  return out;
}

export const drawHairdryer: DrawKind = (a, f, view) => {
  if (view === "1") return dryerSide(a, f);
  if (view === "2") return dryerBack(a, f);
  return place(dryerSide(a, f), 140, 40, 0.8) + place(diffuser(a), 220, 590, 0.9, -8);
};
