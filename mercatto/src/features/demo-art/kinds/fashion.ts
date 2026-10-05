/** Camiseta, tênis, mochila, relógio de pulso e óculos de sol. */
import { BRAND, type Finish, mix } from "../palette";
import { CHROME, RUBBER, SNOW, cylX, cylY, diag, edge, rimLight, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, g, path, place, rect, stroke } from "../svg";
import type { DrawKind } from "./types";

const flatShadow = (a: Art, dd: string, dx = 8, dy = 16, blur = 14, opacity = 0.26) =>
  path(dd, "#0f1a18", { "fill-opacity": opacity, filter: a.blur(blur), transform: `translate(${dx} ${dy})` });

function knit(a: Art, f: Finish): string {
  return a.pattern(4, 4, path("M0 2H4", "none", { stroke: f.light ? "#000000" : "#ffffff", "stroke-opacity": 0.05, "stroke-width": 1 }));
}

// -----------------------------------------------------------------------------
// Camiseta
// -----------------------------------------------------------------------------

const TEE = "M336 146Q400 196 464 146L572 178Q622 198 678 322L604 382L552 314V666Q400 684 248 666V314L196 382L122 322Q178 198 228 178Z";
const TEE_BACK = "M336 146Q400 162 464 146L572 178Q622 198 678 322L604 382L552 314V666Q400 684 248 666V314L196 382L122 322Q178 198 228 178Z";

function tee(a: Art, f: Finish, back: boolean): string {
  const shape = back ? TEE_BACK : TEE;
  let out = flatShadow(a, shape);
  out += path(shape, a.lin([
    [0, f.hi],
    [0.35, f.base],
    [1, f.shade],
  ], 0, 0, 0.5, 1), edge(f, f.light ? 0.45 : 0.2));
  out += path(shape, knit(a, f));
  // dobras suaves
  out += path("M300 330Q330 480 296 640Q330 560 318 420Z", f.deep, { "fill-opacity": 0.1 });
  out += path("M500 360Q470 500 512 650Q480 560 486 430Z", f.deep, { "fill-opacity": 0.08 });
  out += path("M248 330Q300 360 330 470Q290 400 248 380Z", "#ffffff", { "fill-opacity": 0.12 });
  out += path("M420 220Q470 300 456 420Q440 320 400 240Z", "#ffffff", { "fill-opacity": 0.1 });
  // gola
  if (back) {
    out += path("M336 146Q400 162 464 146", "none", stroke(f.shade, 14));
  } else {
    out += path("M342 150Q400 178 458 150Q400 168 342 150Z", f.deep, { "fill-opacity": 0.85 });
    out += path("M336 146Q400 196 464 146", "none", stroke(mix(f.base, f.shade, 0.6), 14));
  }
  const seam = { "stroke-dasharray": "4 4", "stroke-opacity": 0.45 };
  out += path("M134 336L198 370M666 336L602 370", "none", stroke(f.deep, 2, seam));
  out += path("M252 650Q400 666 548 650", "none", stroke(f.deep, 2, seam));
  out += path("M228 178L250 314M572 178L550 314", "none", stroke(f.deep, 2, { "stroke-opacity": 0.2 }));
  return out;
}

function foldedTee(a: Art, f: Finish, y: number): string {
  let out = rect(230, y + 14, 340, 250, 18, f.deep);
  out += rect(230, y, 340, 250, 18, a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.shade],
  ], 0, 0, 0.5, 1), edge(f, f.light ? 0.45 : 0.2));
  out += rect(230, y, 340, 250, 18, knit(a, f));
  out += path(d`M330 ${y}Q400 ${y + 70} 470 ${y}`, "none", stroke(mix(f.base, f.shade, 0.6), 14));
  out += path(d`M340 ${y + 2}Q400 ${y + 40} 460 ${y + 2}Z`, f.deep, { "fill-opacity": 0.7 });
  out += path(d`M262 ${y + 10}V${y + 240}M538 ${y + 10}V${y + 240}`, "none", stroke(f.deep, 2, { "stroke-opacity": 0.25 }));
  return out;
}

export const drawTshirt: DrawKind = (a, f, view) => {
  if (view === "1") return tee(a, f, false);
  if (view === "2") return tee(a, f, true);
  return shadow(a, 400, 640, 230, 26) + foldedTee(a, f, 370) + foldedTee(a, f, 250);
};

// -----------------------------------------------------------------------------
// Tênis
// -----------------------------------------------------------------------------

function sneaker(a: Art, f: Finish): string {
  const sole = f.name === "white" ? toneOf("#c9a77a") : toneOf("#2b2e33");
  const accent = f.neutral ? toneOf(BRAND.jade600) : SNOW;
  const upper =
    "M152 540Q138 484 212 466Q300 446 362 408L470 336Q500 320 540 326L604 332Q644 332 652 362Q668 432 662 520L420 524Q262 526 152 540Z";
  let out = shadow(a, 410, 612, 300, 22);
  out += path("M160 584Q150 606 188 610H624Q662 608 662 580Z", vertTone(a, sole));
  out += path("M148 540Q134 582 172 590H630Q666 588 666 548L662 504Q560 522 420 524Q262 526 148 540Z", a.lin([
    [0, "#ffffff"],
    [1, "#dfe3e6"],
  ]), { stroke: "#c3c9ce", "stroke-width": 1.5 });
  out += path("M170 568Q400 574 650 560", "none", stroke("#c3c9ce", 2));
  out += path(upper, a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.shade],
  ], 0, 0, 0.4, 1), edge(f, f.light ? 0.5 : 0.25));
  out += path(upper, a.pattern(10, 10, circle(5, 5, 1.2, f.deep, { "fill-opacity": 0.12 })));
  // sobreposições
  out += path("M150 540Q150 496 220 482Q250 500 262 530Z", mix(f.base, f.shade, 0.5));
  out += path("M590 360Q640 360 656 420L662 520H584Q600 440 590 360Z", a.lin([
    [0, mix(f.base, f.shade, 0.4)],
    [1, f.deep],
  ]));
  out += path("M250 520Q360 470 470 470Q560 470 620 430L630 450Q560 500 460 500Q360 502 262 532Z", diag(a, accent), edge(accent, 0.3));
  out += path("M152 540Q262 526 420 524L662 520", "none", stroke(f.deep, 2, { "stroke-dasharray": "4 4", "stroke-opacity": 0.5 }));
  // forro, língua, puxador
  out += path("M440 352L468 296Q488 286 506 300L508 336Z", a.lin([
    [0, f.hi],
    [1, f.shade],
  ]));
  out += path("M478 338Q548 304 626 338Q560 362 478 338Z", "#1b1d21");
  out += path("M640 336Q660 300 672 318L664 372Z", vertTone(a, sole));
  // cadarços
  const eyes: [number, number][] = [];
  for (let i = 0; i < 5; i += 1) eyes.push([352 + i * 28, 424 - i * 20]);
  let lace = "";
  eyes.forEach(([x, y], i) => {
    if (i === 0) return;
    const [px, py] = eyes[i - 1] ?? [x, y];
    lace += d`M${px - 14} ${py - 12}L${x + 12} ${y + 10}M${px + 12} ${py + 10}L${x - 14} ${y - 12}`;
  });
  out += path(lace, "none", stroke(f.light ? "#ffffff" : "#f3f4f5", 7));
  out += path(lace, "none", stroke("#000000", 1, { "stroke-opacity": 0.25 }));
  for (const [x, y] of eyes) out += circle(x + 14, y + 12, 3.5, f.deep) + circle(x - 14, y - 12, 3.5, f.deep);
  out += sheen(a, "M200 470Q300 448 360 412L380 420Q300 470 214 490Z", 0.45);
  return out;
}

function vertTone(a: Art, t: { hi: string; base: string; shade: string; deep: string }): string {
  return a.lin([
    [0, t.base],
    [1, t.deep],
  ]);
}

export const drawSneaker: DrawKind = (a, f, view) => {
  if (view === "1") return sneaker(a, f);
  if (view === "2") return g(sneaker(a, f), { transform: "translate(810 0) scale(-1 1) rotate(-5 400 600)" });
  return place(sneaker(a, f), 150, 40, 0.78) + place(sneaker(a, f), 40, 200, 0.8);
};

// -----------------------------------------------------------------------------
// Mochila
// -----------------------------------------------------------------------------

const PACK = "M252 230Q252 140 400 140Q548 140 548 230V600Q548 652 496 652H304Q252 652 252 600Z";

function backpackFront(a: Art, f: Finish): string {
  let out = shadow(a, 400, 660, 210, 22);
  out += path("M232 330Q224 330 224 344V600Q224 640 260 640V330Z", a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0));
  out += path("M568 330Q576 330 576 344V600Q576 640 540 640V330Z", a.lin([
    [0, f.deep],
    [1, f.shade],
  ], 0, 0, 1, 0));
  out += path("M330 150Q330 96 400 96Q470 96 470 150", "none", stroke(RUBBER.base, 14));
  out += path(PACK, a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.shade],
  ], 0, 0, 0.5, 1), edge(f, f.light ? 0.5 : 0.25));
  out += path(PACK, knit(a, f));
  out += path("M266 410V236Q266 156 400 156Q534 156 534 236V410", "none", stroke(f.deep, 5, { "stroke-dasharray": "3 3", "stroke-opacity": 0.7 }));
  out += rect(254, 404, 22, 30, 6, RUBBER.base) + rect(524, 404, 22, 30, 6, RUBBER.base);
  // bolso frontal
  out += path("M290 450Q290 420 330 420H470Q510 420 510 450V600Q510 630 480 630H320Q290 630 290 600Z", a.lin([
    [0, f.base],
    [1, f.deep],
  ]), edge(f, 0.35));
  out += path("M298 444Q300 428 330 428H470Q500 428 502 444", "none", stroke(f.deep, 4, { "stroke-dasharray": "3 3" }));
  out += rect(480, 436, 16, 34, 6, RUBBER.base);
  out += rect(484, 466, 8, 18, 4, RUBBER.hi);
  // alças de compressão
  for (const x of [312, 488]) out += rect(x - 9, 230, 18, 150, 4, mix(f.deep, "#000000", 0.25), { "fill-opacity": 0.7 });
  out += rect(370, 344, 60, 34, 8, a.lin([
    [0, "#3a3e44"],
    [1, "#16181b"],
  ]));
  out += sheen(a, "M270 230Q270 160 390 150Q300 190 296 300L290 600H270Z", 0.3, 1, 0.3);
  return out;
}

function backpackBack(a: Art, f: Finish): string {
  let out = shadow(a, 400, 660, 210, 22);
  out += path("M330 150Q330 96 400 96Q470 96 470 150", "none", stroke(RUBBER.base, 14));
  out += path(PACK, a.lin([
    [0, f.base],
    [1, f.deep],
  ], 0, 0, 0.5, 1), edge(f, 0.3));
  const pad = a.pattern(8, 8, path("M0 4L4 0L8 4L4 8Z", "none", { stroke: "#000000", "stroke-opacity": 0.25, "stroke-width": 1 }));
  for (const x of [286, 414]) {
    out += rect(x, 240, 100, 340, 34, a.lin([
      [0, "#4a4f57"],
      [1, "#24272b"],
    ], 0, 0, 1, 1));
    out += rect(x, 240, 100, 340, 34, pad);
  }
  for (const s of [-1, 1] as const) {
    const x = 400 + s * 70;
    out += path(d`M${x - 22} 200Q${x + s * 40} 380 ${x + s * 100} 590L${x + s * 140} 586Q${x + s * 80} 380 ${x + 22} 200Z`, a.lin([
      [0, RUBBER.hi],
      [1, RUBBER.base],
    ], 0, 0, 1, 0));
    out += path(d`M${x + s * 100} 590L${x + s * 124} 650`, "none", stroke(RUBBER.shade, 12));
    out += rect(x + s * 106 - 12, 572, 24, 26, 4, CHROME.shade, { transform: `rotate(${-s * 18} ${x + s * 106} 585)` });
  }
  out += rect(340, 376, 120, 12, 4, RUBBER.base);
  out += rect(386, 370, 28, 24, 5, "#4a4f57");
  return out;
}

function backpackSide(a: Art, f: Finish): string {
  let out = shadow(a, 400, 660, 160, 22);
  out += path("M320 150Q440 140 470 250Q500 400 480 600Q476 650 430 652H330Q310 652 310 630V170Q310 152 320 150Z", a.lin([
    [0, f.hi],
    [0.4, f.base],
    [1, f.shade],
  ], 0, 0, 0.8, 1), edge(f, f.light ? 0.5 : 0.25));
  out += path("M310 200Q260 360 300 560", "none", stroke(RUBBER.base, 26));
  out += rect(360, 210, 44, 160, 0, "none");
  // garrafa no bolso lateral
  out += rect(352, 300, 76, 240, 30, cylX(a, toneOf(BRAND.jade600)));
  out += rect(364, 270, 52, 40, 10, cylX(a, RUBBER));
  out += path("M330 420Q400 400 480 430V600Q476 640 436 640H340Q330 640 330 620Z", a.lin([
    [0, f.shade],
    [1, f.deep],
  ]), { "fill-opacity": 0.92 });
  out += path("M330 420Q400 400 480 430V600Q476 640 436 640H340Q330 640 330 620Z", a.pattern(7, 7, path("M0 0L7 7M7 0L0 7", "none", { stroke: "#000000", "stroke-opacity": 0.3 })));
  out += path("M326 300H486", "none", stroke(mix(f.deep, "#000000", 0.2), 14));
  out += rect(470, 290, 26, 26, 4, RUBBER.base);
  out += sheen(a, "M330 160Q420 150 450 240L360 300Z", 0.3);
  return out;
}

export const drawBackpack: DrawKind = (a, f, view) => {
  if (view === "1") return backpackFront(a, f);
  if (view === "2") return backpackBack(a, f);
  return backpackSide(a, f);
};

// -----------------------------------------------------------------------------
// Relógio de pulso analógico
// -----------------------------------------------------------------------------

/** Pulseira metálica de 3 elos (superior + inferior), degradês compartilhados por fileira. */
function bracelets(a: Art, f: Finish): string {
  let out = "";
  const rows = 6;
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);
    const w = 150 - t * 16;
    const fade = 1 - t * 0.55;
    const tone = { hi: mix(f.shade, f.hi, fade), base: mix(f.deep, f.base, fade), shade: mix(f.deep, f.shade, fade), deep: f.deep };
    const outer = cylY(a, tone);
    const center = a.lin([
      [0, tone.hi],
      [0.5, "#ffffff"],
      [1, tone.base],
    ]);
    for (const y of [194 - i * 40, 570 + i * 40]) {
      out += rect(400 - w / 2, y, w * 0.32, 36, 6, outer);
      out += rect(400 + w / 2 - w * 0.32, y, w * 0.32, 36, 6, outer);
      out += rect(400 - w * 0.17, y + 2, w * 0.34, 32, 8, center);
    }
  }
  return out;
}

function dialTone(f: Finish): { base: string; edge: string; ink: string } {
  return f.light || f.name === "gray"
    ? { base: "#1b2a4a", edge: "#0b1428", ink: "#f2f4f6" }
    : { base: "#eef0f2", edge: "#c3c9ce", ink: "#22262b" };
}

function watchFace(a: Art, f: Finish): string {
  const dt = dialTone(f);
  let out = bracelets(a, f);
  out += path("M318 252L330 214H470L482 252ZM318 548L330 586H470L482 548Z", diag(a, f));
  out += rect(548, 376, 26, 48, 6, cylY(a, f)) + rect(568, 380, 8, 40, 3, f.shade);
  out += circle(400, 400, 160, a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.deep],
  ], 0, 0, 1, 1), edge(f, 0.4));
  out += circle(400, 400, 146, a.lin([
    [0, f.deep],
    [1, f.hi],
  ], 0, 0, 1, 1));
  out += circle(400, 400, 136, a.rad([
    [0, mix(dt.base, "#ffffff", 0.18)],
    [0.7, dt.base],
    [1, dt.edge],
  ], 0.45, 0.4, 0.65));
  let ticks = "";
  for (let i = 0; i < 60; i += 1) {
    if (i % 5 === 0) continue;
    const ang = (i * Math.PI) / 30;
    ticks += d`M${400 + Math.sin(ang) * 126} ${400 - Math.cos(ang) * 126}L${400 + Math.sin(ang) * 120} ${400 - Math.cos(ang) * 120}`;
  }
  out += path(ticks, "none", stroke(dt.ink, 1.4, { "stroke-opacity": 0.6 }));
  const polished = a.lin([
    [0, CHROME.hi],
    [0.5, CHROME.base],
    [1, CHROME.shade],
  ], 0, 0, 1, 0);
  for (let i = 0; i < 12; i += 1) {
    const wdt = i === 0 ? 14 : 8;
    out += rect(400 - wdt / 2, 280, wdt, 30, 2, polished, { transform: `rotate(${i * 30} 400 400)` });
    if (i === 0) out += rect(398, 282, 4, 26, 1, dt.base);
  }
  const hand = (len: number, w: number, deg: number) =>
    path(d`M${400 - w / 2} 410L${400 - w / 2} ${400 - len + w}L400 ${400 - len}L${400 + w / 2} ${400 - len + w}L${400 + w / 2} 410Z`, polished, {
      transform: `rotate(${deg} 400 400)`,
    });
  out += hand(84, 12, 300) + hand(118, 9, 62);
  out += path("M400 430V284", "none", stroke(f.neutral ? "#e8505b" : f.name === "red" ? BRAND.sun500 : f.base, 2.5, { transform: "rotate(160 400 400)" }));
  out += circle(400, 400, 8, CHROME.base) + circle(400, 400, 3, CHROME.deep);
  out += path("M290 330A130 130 0 0 1 470 278L450 300A110 110 0 0 0 306 344Z", "#ffffff", { "fill-opacity": 0.22 });
  out += rimLight(a, "M240 400A160 160 0 0 1 560 400A160 160 0 0 1 240 400Z", 0.8);
  return out;
}

function watchBack(a: Art, f: Finish): string {
  let out = bracelets(a, f);
  out += path("M318 252L330 214H470L482 252ZM318 548L330 586H470L482 548Z", diag(a, f));
  out += rect(226, 376, 26, 48, 6, cylY(a, f));
  out += circle(400, 400, 160, a.lin([
    [0, f.hi],
    [0.5, f.base],
    [1, f.deep],
  ], 0, 0, 1, 1), edge(f, 0.4));
  out += circle(400, 400, 132, "none", { stroke: f.deep, "stroke-opacity": 0.5, "stroke-width": 2 });
  for (let i = 0; i < 6; i += 1) {
    const ang = (i * Math.PI) / 3;
    out += circle(400 + Math.cos(ang) * 142, 400 + Math.sin(ang) * 142, 5, f.deep, { "fill-opacity": 0.7 });
  }
  out += circle(400, 400, 100, a.rad([
    [0, "#3a3e44"],
    [1, "#121315"],
  ]));
  out += circle(380, 410, 50, "none", { stroke: "#b18a43", "stroke-width": 10, "stroke-dasharray": "4 3" });
  out += circle(436, 372, 30, "none", { stroke: "#d2d6db", "stroke-width": 8, "stroke-dasharray": "3 3" });
  out += path("M400 400L330 330A100 100 0 0 1 470 330Z", a.lin([
    [0, "#f7e6b5"],
    [1, "#b18a43"],
  ]), { "fill-opacity": 0.9 });
  out += circle(400, 400, 10, "#c9ced3");
  out += circle(452, 440, 6, "#c0392b");
  out += path("M330 330A100 100 0 0 1 470 330", "none", stroke("#ffffff", 10, { "stroke-opacity": 0.2 }));
  return out;
}

export const drawWristwatch: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 400, 745, 120, 14) + watchFace(a, f);
  if (view === "2") return shadow(a, 400, 745, 120, 14) + watchBack(a, f);
  return g(watchFace(a, f), { transform: "translate(-440 -440) scale(2.1)" });
};

// -----------------------------------------------------------------------------
// Óculos de sol
// -----------------------------------------------------------------------------

const LENS_L = "M178 330Q174 298 208 296H344Q374 298 372 330L362 408Q352 462 292 462H246Q194 462 184 408Z";
const LENS_R = "M622 330Q626 298 592 296H456Q426 298 428 330L438 408Q448 462 508 462H554Q606 462 616 408Z";

function lensFill(a: Art): string {
  return a.lin([
    [0, "#141a22"],
    [0.55, "#2c3846"],
    [1, "#5b6876"],
  ]);
}

function glassesFront(a: Art, f: Finish): string {
  let out = "";
  out += rect(130, 304, 46, 18, 6, f.deep) + rect(624, 304, 46, 18, 6, f.deep);
  out += path("M372 326Q400 306 428 326", "none", stroke(f.shade, 22));
  for (const l of [LENS_L, LENS_R]) {
    out += path(l, "none", stroke(f.deep, 26, { transform: "translate(0 3)" }));
    out += path(l, "none", stroke(diag(a, f), 22));
    out += path(l, lensFill(a));
    out += path(l, a.lin([
      [0, "#7fb2d9", 0.35],
      [0.5, "#7fb2d9", 0],
      [1, "#f5b400", 0.18],
    ], 0, 0, 1, 1));
  }
  out += path("M196 320Q260 300 330 312L300 360Q240 340 200 370Z", "#ffffff", { "fill-opacity": 0.22 });
  out += path("M446 320Q520 300 590 312L560 360Q500 340 450 370Z", "#ffffff", { "fill-opacity": 0.22 });
  out += path("M168 300Q190 284 214 284H346Q376 286 386 304M632 300Q610 284 586 284H454Q424 286 414 304", "none", stroke("#ffffff", 3, { "stroke-opacity": 0.5 }));
  out += circle(184, 316, 4, CHROME.hi) + circle(616, 316, 4, CHROME.hi);
  return out;
}

function glassesAngle(a: Art, f: Finish): string {
  let out = shadow(a, 420, 560, 300, 24);
  out += path("M560 316Q660 330 720 360Q740 372 736 400", "none", stroke(f.deep, 14));
  out += path("M560 316Q660 330 720 360Q740 372 736 400", "none", stroke(diag(a, f), 10));
  out += g(glassesFront(a, f), { transform: "matrix(0.82 0.1 0 1 40 0)" });
  out += path("M180 330Q440 346 690 372Q720 378 724 404", "none", stroke(f.deep, 16));
  out += path("M180 330Q440 346 690 372Q720 378 724 404", "none", stroke(diag(a, f), 11));
  return out;
}

function glassesCase(a: Art): string {
  const t = toneOf("#2c3036");
  return (
    shadow(a, 400, 640, 300, 26) +
    path("M140 540Q140 470 210 470H590Q660 470 660 540V560Q660 630 590 630H210Q140 630 140 560Z", diag(a, t)) +
    path("M144 548H656", "none", stroke("#4a4f57", 3)) +
    rect(370, 540, 60, 16, 4, CHROME.shade)
  );
}

export const drawSunglasses: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 400, 540, 280, 24) + glassesFront(a, f);
  if (view === "2") return glassesAngle(a, f);
  return glassesCase(a) + place(glassesFront(a, f), 70, 140, 0.82, -4);
};
