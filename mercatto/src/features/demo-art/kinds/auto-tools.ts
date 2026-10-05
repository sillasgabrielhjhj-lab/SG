/** Pneu (com roda), dashcam, furadeira e caixa de ferramentas. */
import { BRAND, type Finish, mix } from "../palette";
import { CHROME, RUBBER, WOOD, cuboidBack, cylX, cylY, diag, dome, edge, flat, lens, rimLight, screen, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, place, rect, stroke } from "../svg";
import type { DrawKind } from "./types";

// -----------------------------------------------------------------------------
// Pneu + roda de liga leve
// -----------------------------------------------------------------------------

function treadPattern(a: Art): string {
  return a.pattern(
    44,
    36,
    path("M0 6L22 18L44 6M0 24L22 36L44 24", "none", { stroke: "#050506", "stroke-width": 6, "stroke-linejoin": "round" }) +
      path("M22 0V8M0 18H8M36 18H44", "none", { stroke: "#050506", "stroke-width": 3 }),
  );
}

function wheelFace(a: Art, f: Finish): string {
  let out = circle(0, 0, 270, a.rad([
    [0, "#3a3e44"],
    [0.75, "#202226"],
    [0.9, "#141518"],
    [1, "#0a0b0c"],
  ], 0.45, 0.42, 0.6));
  out += circle(0, 0, 242, "none", { stroke: "#2c2f34", "stroke-width": 3 });
  out += path("M-200 -120A232 232 0 0 1 60 -226", "none", stroke("#ffffff", 14, { "stroke-opacity": 0.08 }));
  out += circle(0, 0, 172, diag(a, CHROME));
  out += circle(0, 0, 160, "#16181b");
  // disco de freio
  out += circle(0, 0, 130, a.rad([
    [0, "#9aa2aa"],
    [1, "#5c636b"],
  ], 0.4, 0.4, 0.7));
  out += circle(0, 0, 112, a.pattern(16, 16, circle(8, 8, 2.2, "#3a3f45")));
  out += rect(-150, -60, 50, 110, 14, BRAND.sun500, { transform: "rotate(-20)" });
  // raios duplos
  let spokes = "";
  for (let i = 0; i < 5; i += 1) {
    const ang = (i * 72 * Math.PI) / 180 - Math.PI / 2;
    for (const off of [-0.13, 0.13]) {
      const a1 = ang + off * 0.5;
      const a2 = ang + off;
      spokes += d`M${Math.cos(a1 - 0.07) * 40} ${Math.sin(a1 - 0.07) * 40}L${Math.cos(a2 - 0.045) * 162} ${Math.sin(a2 - 0.045) * 162}L${Math.cos(a2 + 0.045) * 162} ${Math.sin(a2 + 0.045) * 162}L${Math.cos(a1 + 0.07) * 40} ${Math.sin(a1 + 0.07) * 40}Z`;
    }
  }
  out += path(spokes, "#000000", { "fill-opacity": 0.35, transform: "translate(4 6)" });
  out += path(spokes, a.lin([
    [0, f.hi],
    [0.45, f.base],
    [1, f.shade],
  ], 0, 0, 1, 1), { stroke: f.deep, "stroke-width": 1, "stroke-opacity": 0.6 });
  out += circle(0, 0, 166, "none", { stroke: diag(a, f), "stroke-width": 10 });
  out += circle(0, 0, 50, dome(a, f));
  for (let i = 0; i < 5; i += 1) {
    const ang = (i * 72 * Math.PI) / 180 - Math.PI / 2 + 0.6;
    out += circle(Math.cos(ang) * 32, Math.sin(ang) * 32, 6, dome(a, CHROME));
  }
  out += circle(0, 0, 18, f.deep);
  return out;
}

function tire3q(a: Art, f: Finish): string {
  let out = shadow(a, 420, 690, 280, 26);
  out += ellipse(452, 400, 236, 274, "#121315");
  out += ellipse(452, 400, 236, 274, treadPattern(a));
  out += ellipse(452, 400, 236, 274, a.lin([
    [0, "#ffffff", 0.12],
    [0.5, "#ffffff", 0],
    [1, "#000000", 0.4],
  ], 0, 0, 1, 0));
  out += g(wheelFace(a, f), { transform: "translate(380 400) scale(0.88 1)" });
  return out;
}

function tireTread(a: Art): string {
  let out = shadow(a, 400, 690, 160, 20);
  out += rect(290, 120, 220, 560, 60, "#121315");
  out += rect(300, 120, 200, 560, 50, treadPattern(a));
  out += path("M360 130V670M440 130V670", "none", stroke("#050506", 8));
  out += rect(290, 120, 220, 560, 60, a.lin([
    [0, "#000000", 0.5],
    [0.25, "#ffffff", 0.08],
    [0.45, "#ffffff", 0.14],
    [0.75, "#000000", 0.2],
    [1, "#000000", 0.6],
  ], 0, 0, 1, 0));
  out += rect(290, 120, 220, 560, 60, a.lin([
    [0, "#000000", 0.55],
    [0.15, "#000000", 0],
    [0.85, "#000000", 0],
    [1, "#000000", 0.55],
  ]));
  return out;
}

export const drawTire: DrawKind = (a, f, view) => {
  if (view === "1") return tire3q(a, f);
  if (view === "2") return tireTread(a) + place(g(wheelFace(a, f), { transform: "scale(0.28)" }), 640, 600, 1);
  return g(tire3q(a, f), { transform: "translate(-560 -330) scale(1.9)" });
};

// -----------------------------------------------------------------------------
// Dashcam
// -----------------------------------------------------------------------------

function dashMount(a: Art): string {
  const t = toneOf("#2b2e33");
  return (
    rect(350, 230, 160, 36, 10, diag(a, t)) +
    rect(352, 228, 156, 6, 3, "#ffffff", { "fill-opacity": 0.2 }) +
    rect(412, 262, 36, 48, 8, cylX(a, t)) +
    circle(430, 316, 18, dome(a, t))
  );
}

function dashFront(a: Art, f: Finish): string {
  let out = shadow(a, 410, 548, 190, 20);
  out += dashMount(a);
  out += path("M544 340L572 324V488L544 508Z", a.lin([
    [0, f.shade],
    [1, f.deep],
  ], 0, 0, 1, 0));
  out += path("M262 340L290 324H560L544 340Z", a.lin([
    [0, f.hi],
    [1, f.base],
  ]));
  out += rect(250, 336, 300, 176, 30, diag(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += circle(345, 424, 74, f.deep, { "fill-opacity": 0.5 });
  out += lens(a, 345, 422, 66, toneOf("#3a3e44"));
  out += circle(462, 380, 7, "#0c0d0f") + circle(462, 380, 3, "#7d1b1b");
  out += rect(440, 450, 80, 8, 4, f.deep, { "fill-opacity": 0.5 });
  out += rect(440, 466, 60, 8, 4, f.deep, { "fill-opacity": 0.5 });
  out += circle(505, 380, 5, BRAND.jade400);
  out += sheen(a, "M262 346H420L300 506H262Z", 0.3, 1, 0.3);
  return out;
}

function dashBack(a: Art, f: Finish): string {
  let out = shadow(a, 400, 548, 190, 20);
  out += dashMount(a);
  out += rect(240, 336, 320, 176, 30, diag(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += rect(262, 352, 230, 144, 10, "#050607");
  out += screen(a, 268, 358, 218, 132, 6, "camera");
  for (let i = 0; i < 4; i += 1) out += circle(522, 372 + i * 34, 10, a.lin([
    [0, f.hi],
    [1, f.shade],
  ]), { stroke: f.deep, "stroke-width": 1.5 });
  out += rimLight(a, "M270 336H530Q560 336 560 366V482Q560 512 530 512H270Q240 512 240 482V366Q240 336 270 336Z", 0.6);
  return out;
}

export const drawDashcam: DrawKind = (a, f, view) => {
  if (view === "1") return dashFront(a, f);
  if (view === "2") return dashBack(a, f);
  return g(dashFront(a, f), { transform: "translate(-690 -840) scale(3.1)" });
};

// -----------------------------------------------------------------------------
// Furadeira / parafusadeira
// -----------------------------------------------------------------------------

function drill(a: Art, f: Finish): string {
  const dark = toneOf("#26292e");
  let out = shadow(a, 430, 666, 210, 20);
  // bateria
  out += path("M330 584H566Q580 584 580 598V644Q580 658 566 658H330Q316 658 316 644V598Q316 584 330 584Z", vertGrad(a, dark));
  out += rect(330, 560, 236, 34, 10, diag(a, f), edge(f, 0.4));
  for (let i = 0; i < 4; i += 1) out += rect(500 + i * 14, 626, 9, 6, 2, i < 3 ? "#3ee08f" : "#4a4f57");
  // cabo
  out += path("M420 330H512L478 568H392Z", diag(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += path("M470 340H512L480 566H446Z", vertGrad(a, dark));
  let grip = "";
  for (let i = 0; i < 8; i += 1) grip += d`M${470 - i * 3.6} ${380 + i * 24}h${30}`;
  out += path(grip, "none", stroke("#000000", 3, { "stroke-opacity": 0.4 }));
  out += path("M392 348H424Q430 380 420 412H400Q404 380 392 348Z", cylX(a, dark));
  out += rect(430, 340, 30, 14, 5, dark.hi);
  // corpo do motor
  out += path("M230 232H500Q560 232 560 290Q560 344 500 344H230Z", cylY(a, f), edge(f, f.light ? 0.6 : 0.25));
  out += path("M440 232H500Q560 232 560 290Q560 344 500 344H440Z", cylY(a, dark));
  let vents = "";
  for (let i = 0; i < 5; i += 1) vents += d`M${470 + i * 14} 254V326`;
  out += path(vents, "none", stroke("#000000", 5, { "stroke-opacity": 0.55 }));
  // anel de torque + mandril + broca
  out += rect(196, 240, 44, 98, 12, cylY(a, dark));
  let ridges = "";
  for (let i = 0; i < 6; i += 1) ridges += d`M${200 + i * 7} 244V334`;
  out += path(ridges, "none", stroke("#000000", 2, { "stroke-opacity": 0.5 }));
  out += path("M196 256L140 268V310L196 322Z", cylY(a, CHROME));
  out += rect(120, 272, 26, 34, 6, cylY(a, CHROME));
  out += path("M120 284L40 286L30 289L40 292L120 294Z", cylY(a, CHROME));
  let flute = "";
  for (let i = 0; i < 7; i += 1) flute += d`M${44 + i * 11} 284l8 10`;
  out += path(flute, "none", stroke(CHROME.deep, 2));
  out += rect(250, 244, 160, 14, 7, "#ffffff", { "fill-opacity": 0.35 });
  return out;
}

function vertGrad(a: Art, t: { hi: string; base: string; shade: string; deep: string }): string {
  return a.lin([
    [0, t.hi],
    [0.3, t.base],
    [1, t.deep],
  ]);
}

function bitCase(a: Art): string {
  const t = toneOf("#2b2e33");
  let out = shadow(a, 400, 650, 280, 18);
  out += rect(120, 560, 560, 90, 16, diag(a, t));
  for (let i = 0; i < 12; i += 1) {
    const x = 160 + i * 44;
    const h = 60 + i * 9;
    out += rect(x - 3 - i * 0.3, 570 - h, 6 + i * 0.6, h, 2, cylX(a, CHROME));
    out += rect(x - 10, 560, 20, 22, 4, "#16181b");
  }
  return out;
}

export const drawDrill: DrawKind = (a, f, view) => {
  if (view === "1") return drill(a, f);
  if (view === "2") return g(drill(a, f), { transform: "translate(830 0) scale(-1 1) rotate(-6 430 450)" });
  return place(bitCase(a), 0, 60, 1) + place(drill(a, f), 110, 20, 0.78);
};

// -----------------------------------------------------------------------------
// Caixa de ferramentas
// -----------------------------------------------------------------------------

function toolboxClosed(a: Art, f: Finish): string {
  const x = 170;
  const y = 330;
  const w = 430;
  const h = 290;
  let out = shadow(a, 420, 628, 280, 24);
  out += cuboidBack(a, f, x, y, w, h, 70, 50, 14);
  out += rect(x, y, w, h, 14, flat(a, f, 0.4, 1), edge(f, f.light ? 0.6 : 0.25));
  out += rect(x, y, w, 70, 14, a.lin([
    [0, f.hi],
    [1, f.base],
  ]));
  out += path(d`M${x + 4} ${y + 70}H${x + w - 4}`, "none", stroke(f.deep, 4, { "stroke-opacity": 0.6 }));
  for (const lx of [x + 70, x + w - 110]) {
    out += rect(lx, y + 44, 40, 56, 6, cylX(a, CHROME));
    out += rect(lx + 8, y + 60, 24, 26, 4, CHROME.shade);
  }
  out += rect(x + 30, y + 120, w - 60, 140, 12, f.shade, { "fill-opacity": 0.35 });
  out += rect(x + 50, y + 140, w - 100, 100, 10, a.lin([
    [0, f.hi],
    [1, f.shade],
  ], 0, 0, 1, 1), { "fill-opacity": 0.6 });
  // alça
  out += path(d`M${x + 140} ${y - 20}V${y - 64}Q${x + 140} ${y - 92} ${x + 170} ${y - 92}H${x + 300}Q${x + 330} ${y - 92} ${x + 330} ${y - 64}V${y - 20}`, "none", stroke(RUBBER.deep, 26));
  out += path(d`M${x + 140} ${y - 20}V${y - 64}Q${x + 140} ${y - 92} ${x + 170} ${y - 92}H${x + 300}Q${x + 330} ${y - 92} ${x + 330} ${y - 64}V${y - 20}`, "none", stroke(RUBBER.hi, 18));
  out += rect(x + 126, y - 26, 228, 20, 8, RUBBER.base);
  out += sheen(a, d`M${x} ${y}H${x + 140}L${x + 60} ${y + h}H${x}Z`, 0.3, 1, 0.2);
  return out;
}

function screwdriver(a: Art, color: string, len: number): string {
  const t = toneOf(color);
  return rect(0, -12, 120, 24, 12, cylY(a, t)) + rect(116, -5, len, 10, 3, cylY(a, CHROME)) + path(d`M${116 + len} -5L${130 + len} -1V1L${116 + len} 5Z`, CHROME.shade);
}

function wrench(a: Art): string {
  return (
    path("M0 -14H260V14H0Z", cylY(a, CHROME)) +
    path("M-30 -40Q-74 -40 -74 0Q-74 40 -30 40Q-6 40 6 18L-20 8V-8L6 -18Q-6 -40 -30 -40Z", diag(a, CHROME)) +
    circle(290, 0, 40, diag(a, CHROME)) +
    circle(290, 0, 20, "#e9ecee")
  );
}

function hammer(a: Art): string {
  return rect(0, -14, 320, 28, 12, cylY(a, WOOD)) + rect(300, -60, 56, 120, 10, cylX(a, toneOf("#5a6068"))) + path("M356 -50L400 -30V30L356 50Z", cylX(a, toneOf("#3a3f45")));
}

function toolboxOpen(a: Art, f: Finish): string {
  const x = 170;
  const y = 380;
  const w = 430;
  const h = 240;
  let out = shadow(a, 420, 628, 290, 24);
  // tampa aberta para trás
  out += path(d`M${x} ${y}L${x + 70} ${y - 200}H${x + w + 70}L${x + w} ${y}Z`, a.lin([
    [0, f.base],
    [1, f.shade],
  ]), edge(f, 0.4));
  out += path(d`M${x + 30} ${y - 20}L${x + 86} ${y - 180}H${x + w + 46}L${x + w - 10} ${y - 20}Z`, f.deep, { "fill-opacity": 0.4 });
  out += path(d`M${x} ${y}L${x + 70} ${y - 50}H${x + w + 70}L${x + w} ${y}Z`, "#16181b");
  // ferramentas saindo
  out += place(screwdriver(a, "#e8505b", 70), x + 90, y - 30, 0.8, -70);
  out += place(screwdriver(a, BRAND.sun500, 60), x + 150, y - 24, 0.8, -84);
  out += place(screwdriver(a, BRAND.jade600, 80), x + 210, y - 26, 0.8, -98);
  out += place(wrench(a), x + 270, y - 12, 0.5, -60);
  out += cuboidBack(a, f, x, y, w, h, 70, 50, 14).replace(/<path[^>]*>/, "");
  out += rect(x, y, w, h, 14, flat(a, f, 0.4, 1), edge(f, f.light ? 0.6 : 0.25));
  out += rect(x + 30, y + 60, w - 60, 140, 12, f.shade, { "fill-opacity": 0.35 });
  for (const lx of [x + 70, x + w - 110]) out += rect(lx, y - 6, 40, 40, 6, cylX(a, CHROME));
  return out;
}

export const drawToolbox: DrawKind = (a, f, view) => {
  if (view === "1") return toolboxClosed(a, f);
  if (view === "2") return toolboxOpen(a, f);
  return (
    place(toolboxClosed(a, f), 150, -10, 0.68) +
    shadow(a, 400, 700, 320, 20) +
    place(hammer(a), 150, 560, 1, -6) +
    place(wrench(a), 240, 640, 1, 4) +
    place(screwdriver(a, mix(f.base, "#e8505b", f.neutral ? 1 : 0), 140), 280, 712, 1, -3)
  );
};
