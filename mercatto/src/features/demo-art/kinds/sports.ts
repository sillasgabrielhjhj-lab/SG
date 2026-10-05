/** Bicicleta, halter, tapete de yoga e bola de futebol. */
import { type Finish, mix } from "../palette";
import { CHROME, RUBBER, type Tone, cylY, edge, shadow, sheen, toneOf } from "../studio";
import { type Art, circle, d, ellipse, g, path, rect, stroke } from "../svg";
import type { DrawKind } from "./types";

// -----------------------------------------------------------------------------
// Mini motor 3D (projeção ortográfica + pintor) para sólidos facetados
// -----------------------------------------------------------------------------

type V3 = readonly [number, number, number];
const LIGHT: V3 = norm([-0.5, 0.75, 0.6]);

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const addv = (p: V3, q: V3, k = 1): V3 => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

function rot(p: V3, yaw: number, pitch: number, roll = 0): V3 {
  let [x, y, z] = p;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  return [x, y, z];
}

function shadeTone(t: Tone, i: number): string {
  return i < 0.5 ? mix(t.deep, t.base, i * 2) : mix(t.base, t.hi, (i - 0.5) * 2);
}

interface Face {
  pts: V3[];
  tone: Tone;
}

/** Desenha faces já rotacionadas: descarta as de costas e ordena por profundidade. */
function renderFaces(faces: readonly Face[], cx: number, cy: number, s: number, outline: string): string {
  const visible = faces
    .map((f) => {
      const n = norm(cross(sub(f.pts[1] ?? f.pts[0]!, f.pts[0]!), sub(f.pts[2] ?? f.pts[0]!, f.pts[0]!)));
      const z = f.pts.reduce((acc, p) => acc + p[2], 0) / f.pts.length;
      return { f, n, z };
    })
    .filter((v) => v.n[2] > 0.001)
    .sort((p, q) => p.z - q.z);
  return visible
    .map(({ f, n }) => {
      const i = Math.max(0, Math.min(1, 0.3 + 0.7 * Math.max(0, dot(n, LIGHT)) + 0.15 * n[2]));
      const dd = `M${f.pts.map((p) => `${(cx + p[0] * s).toFixed(1)} ${(cy - p[1] * s).toFixed(1)}`).join("L")}Z`;
      return path(dd, shadeTone(f.tone, i), { stroke: outline, "stroke-opacity": 0.25, "stroke-width": 1, "stroke-linejoin": "round" });
    })
    .join("");
}

/** Prisma regular de n lados com eixo X entre x0 e x1. */
function prismX(x0: number, x1: number, r: number, n: number, phase: number, tone: Tone, capTone = tone): Face[] {
  const ring = (x: number) =>
    Array.from({ length: n }, (_, k): V3 => {
      const ang = phase + (k * 2 * Math.PI) / n;
      return [x, Math.cos(ang) * r, Math.sin(ang) * r];
    });
  const a = ring(x0);
  const b = ring(x1);
  const faces: Face[] = [];
  for (let k = 0; k < n; k += 1) {
    const k2 = (k + 1) % n;
    faces.push({ pts: [a[k]!, b[k]!, b[k2]!, a[k2]!], tone });
  }
  faces.push({ pts: [...a], tone: capTone });
  faces.push({ pts: [...b].reverse(), tone: capTone });
  return faces;
}

const rotFaces = (faces: readonly Face[], yaw: number, pitch: number, roll = 0, offset: V3 = [0, 0, 0]): Face[] =>
  faces.map((f) => ({ ...f, pts: f.pts.map((p) => rot(addv(p, offset), yaw, pitch, roll)) }));

// -----------------------------------------------------------------------------
// Halter sextavado
// -----------------------------------------------------------------------------

function dumbbellFaces(f: Finish): Face[] {
  const capTone: Tone = { hi: mix(f.hi, f.base, 0.4), base: f.shade, shade: f.deep, deep: mix(f.deep, "#000000", 0.4) };
  return [
    ...prismX(-1.55, -0.8, 0.82, 6, Math.PI / 6, f, capTone),
    ...prismX(-0.8, -0.68, 0.36, 12, 0, CHROME),
    ...prismX(-0.68, 0.68, 0.2, 14, 0, CHROME),
    ...prismX(0.68, 0.8, 0.36, 12, 0, CHROME),
    ...prismX(0.8, 1.55, 0.82, 6, Math.PI / 6, f, capTone),
  ];
}

function dumbbell(a: Art, f: Finish, cx: number, cy: number, s: number, yaw: number, pitch: number, roll = 0): string {
  return renderFaces(rotFaces(dumbbellFaces(f), yaw, pitch, roll), cx, cy, s, f.deep) + knurl(a, cx, cy, s, yaw, pitch, roll);
}

function knurl(a: Art, cx: number, cy: number, s: number, yaw: number, pitch: number, roll: number): string {
  const p0 = rot([-0.5, 0, 0.2], yaw, pitch, roll);
  const p1 = rot([0.5, 0, 0.2], yaw, pitch, roll);
  const dd = d`M${cx + p0[0] * s} ${cy - p0[1] * s}L${cx + p1[0] * s} ${cy - p1[1] * s}`;
  const pat = a.pattern(5, 5, path("M0 0L5 5M5 0L0 5", "none", { stroke: "#4a5058", "stroke-opacity": 0.55, "stroke-width": 1 }));
  return path(dd, "none", { stroke: pat, "stroke-width": s * 0.3, "stroke-linecap": "butt" });
}

export const drawDumbbell: DrawKind = (a, f, view) => {
  if (view === "1") return shadow(a, 400, 560, 300, 40) + dumbbell(a, f, 400, 420, 190, -0.5, 0.42);
  if (view === "2") {
    return (
      shadow(a, 400, 600, 330, 44) +
      dumbbell(a, f, 410, 340, 150, -0.35, 0.5) +
      dumbbell(a, f, 390, 500, 160, -0.35, 0.5)
    );
  }
  return dumbbell(a, f, 330, 430, 420, -0.6, 0.32);
};

// -----------------------------------------------------------------------------
// Bola de futebol (icosaedro truncado projetado na esfera)
// -----------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO: V3[] = [
  [0, 1, PHI],
  [0, -1, PHI],
  [0, 1, -PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [-1, PHI, 0],
  [1, -PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [-PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, -1],
];

function icoNeighbors(i: number): number[] {
  const v = ICO[i]!;
  return ICO.map((w, j) => ({ j, dist: Math.hypot(...sub(w, v)) })).filter((e) => e.j !== i && Math.abs(e.dist - 2) < 0.01).map((e) => e.j);
}

function slerpPts(p: V3, q: V3, steps: number): V3[] {
  return Array.from({ length: steps + 1 }, (_, k) => norm(addv(p, sub(q, p), k / steps)));
}

function football(a: Art, f: Finish, cx: number, cy: number, R: number, yaw: number, pitch: number, roll: number): string {
  const panel = f.name === "white" || f.name === "silver" ? "#23262b" : f.base;
  const project = (p: V3): string => {
    const r = rot(p, yaw, pitch, roll);
    let [x, y] = [r[0], r[1]];
    if (r[2] < 0) {
      const l = Math.hypot(x, y) || 1;
      x /= l;
      y /= l;
    }
    return `${(cx + x * R).toFixed(1)} ${(cy - y * R).toFixed(1)}`;
  };
  let out = shadow(a, cx, cy + R + 6, R * 1.0, R * 0.16, 1.1);
  out += circle(cx, cy, R, "#f7f8f9");
  let pents = "";
  let seams = "";
  const seen = new Set<string>();
  ICO.forEach((v0, i) => {
    const v = norm(v0);
    const ns = icoNeighbors(i);
    const e1 = norm(sub(ICO[ns[0]!]!, v0));
    const e2 = cross(v, e1);
    const ordered = ns
      .map((j) => {
        const dv = sub(ICO[j]!, v0);
        return { j, ang: Math.atan2(dot(dv, e2), dot(dv, e1)) };
      })
      .sort((p, q) => p.ang - q.ang)
      .map((e) => e.j);
    const corners = ordered.map((j) => norm(addv(v0, sub(ICO[j]!, v0), 1 / 3)));
    const center = rot(v, yaw, pitch, roll);
    if (center[2] > -0.35) {
      const pts: V3[] = [];
      corners.forEach((c, k) => pts.push(...slerpPts(c, corners[(k + 1) % 5]!, 4).slice(0, -1)));
      pents += `M${pts.map(project).join("L")}Z`;
    }
    // costuras hexágono-hexágono ao longo das arestas do icosaedro
    for (const j of ns) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const w = ICO[j]!;
      const p1 = norm(addv(v0, sub(w, v0), 1 / 3));
      const p2 = norm(addv(v0, sub(w, v0), 2 / 3));
      const segs = slerpPts(p1, p2, 4).filter((p) => rot(p, yaw, pitch, roll)[2] > 0);
      if (segs.length > 1) seams += `M${segs.map(project).join("L")}`;
    }
  });
  out += g(path(pents, panel), { "clip-path": a.clip(circle(cx, cy, R, "#000")) });
  out += path(seams, "none", stroke("#9aa1a8", R * 0.012));
  out += path(pents, "none", { stroke: "#9aa1a8", "stroke-width": R * 0.012, "clip-path": a.clip(circle(cx, cy, R - 1, "#000")) });
  // volume: sombreamento esférico + brilho especular
  out += circle(cx, cy, R, a.rad([
    [0, "#ffffff", 0],
    [0.55, "#000000", 0.05],
    [0.85, "#000000", 0.28],
    [1, "#000000", 0.5],
  ], 0.4, 0.36, 0.72));
  out += ellipse(cx - R * 0.36, cy - R * 0.42, R * 0.3, R * 0.18, a.rad([
    [0, "#ffffff", 0.75],
    [1, "#ffffff", 0],
  ]), { transform: `rotate(-35 ${(cx - R * 0.36).toFixed(1)} ${(cy - R * 0.42).toFixed(1)})` });
  return out;
}

export const drawFootball: DrawKind = (a, f, view) => {
  if (view === "1") return football(a, f, 400, 390, 250, 0.32, 0.38, 0.1);
  if (view === "2") return football(a, f, 400, 400, 250, 1.1, -0.2, 0.6);
  return football(a, f, 470, 480, 470, 0.32, 0.38, 0.1);
};

// -----------------------------------------------------------------------------
// Bicicleta
// -----------------------------------------------------------------------------

function wheel(cx: number, cy: number, r: number, rim: string): string {
  let spokes = "";
  for (let i = 0; i < 28; i += 1) {
    const ang = (i * Math.PI * 2) / 28;
    const hub = (i % 2 ? 1 : -1) * 0.3;
    spokes += d`M${cx + Math.cos(ang + hub) * 12} ${cy + Math.sin(ang + hub) * 12}L${cx + Math.cos(ang) * (r - 14)} ${cy + Math.sin(ang) * (r - 14)}`;
  }
  return (
    circle(cx, cy, r, "none", stroke("#16181b", 18)) +
    circle(cx, cy, r + 5, "none", stroke("#2b2e33", 4, { "stroke-dasharray": "3 5" })) +
    circle(cx, cy, r - 12, "none", stroke(rim, 8)) +
    circle(cx, cy, r - 12, "none", stroke("#ffffff", 1.5, { "stroke-opacity": 0.4 })) +
    path(spokes, "none", stroke("#9aa1a8", 1.4)) +
    circle(cx, cy, 14, CHROME.shade) +
    circle(cx, cy, 6, CHROME.hi)
  );
}

function tube(dd: string, f: Finish, w: number): string {
  return path(dd, "none", stroke(f.shade, w + 3)) + path(dd, "none", stroke(f.base, w)) + path(dd, "none", stroke(f.hi, w * 0.28, { "stroke-opacity": 0.8, transform: "translate(-1 -3)" }));
}

function bicycle(a: Art, f: Finish): string {
  const R: V3 = [225, 480, 0];
  const F: V3 = [585, 480, 0];
  const BB: V3 = [380, 495, 0];
  let out = shadow(a, 405, 632, 330, 18);
  out += wheel(R[0], R[1], 145, "#2b2e33") + wheel(F[0], F[1], 145, "#2b2e33");
  // transmissão
  out += path(d`M${BB[0]} ${BB[1] - 44}L${R[0]} ${R[1] - 22}M${BB[0]} ${BB[1] + 44}L${R[0]} ${R[1] + 22}`, "none", stroke("#5a6068", 4));
  out += circle(R[0], R[1], 26, "none", stroke(CHROME.shade, 8, { "stroke-dasharray": "2 2" }));
  // quadro
  out += tube(d`M${BB[0]} ${BB[1]}L${R[0]} ${R[1]}`, f, 11);
  out += tube(d`M352 300L${R[0]} ${R[1]}`, f, 10);
  out += tube(d`M${BB[0]} ${BB[1]}L346 268`, f, 15);
  out += tube("M346 290L538 300", f, 14);
  out += tube(d`M${BB[0]} ${BB[1]}L548 352`, f, 17);
  out += tube("M534 284L552 362", f, 18);
  out += tube(d`M550 360Q566 420 ${F[0]} ${F[1]}`, f, 10);
  // canote e selim
  out += path("M346 268L336 226", "none", stroke(CHROME.shade, 9));
  out += path("M296 222Q330 210 372 218Q382 222 372 228Q340 232 300 232Q288 230 296 222Z", cylY(a, RUBBER));
  // guidão drop
  out += path("M534 284L540 262L572 254", "none", stroke("#2b2e33", 9));
  out += path("M572 254Q612 254 612 290Q612 326 582 326", "none", stroke("#2b2e33", 9));
  out += path("M578 252Q596 246 604 262", "none", stroke("#16181b", 12));
  // pedivela
  out += circle(BB[0], BB[1], 46, "none", stroke(CHROME.base, 7, { "stroke-dasharray": "3 2" }));
  out += circle(BB[0], BB[1], 40, CHROME.base, { "fill-opacity": 0.35 });
  out += path(d`M${BB[0]} ${BB[1]}L${BB[0] + 34} ${BB[1] + 62}`, "none", stroke("#2b2e33", 12));
  out += rect(BB[0] + 18, BB[1] + 58, 40, 12, 4, "#16181b");
  out += circle(BB[0], BB[1], 12, CHROME.hi, { stroke: CHROME.shade, "stroke-width": 3 });
  return out;
}

export const drawBicycle: DrawKind = (a, f, view) => {
  if (view === "1") return bicycle(a, f);
  if (view === "2") return g(bicycle(a, f), { transform: "translate(810 0) scale(-1 1)" });
  return g(bicycle(a, f), { transform: "translate(-500 -730) scale(2.3)" });
};

// -----------------------------------------------------------------------------
// Tapete de yoga
// -----------------------------------------------------------------------------

function spiral(cx: number, cy: number, rx: number, ry: number, turns: number): string {
  let dd = "";
  const n = turns * 36;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const ang = t * turns * Math.PI * 2;
    const r = 0.12 + 0.88 * t;
    dd += `${i ? "L" : "M"}${(cx + Math.cos(ang) * rx * r).toFixed(1)} ${(cy + Math.sin(ang) * ry * r).toFixed(1)}`;
  }
  return dd;
}

function matTexture(a: Art, f: Finish): string {
  return a.pattern(10, 10, circle(5, 5, 1.6, f.light ? "#000000" : "#ffffff", { "fill-opacity": 0.08 }));
}

function rolledMat(a: Art, f: Finish): string {
  let out = shadow(a, 410, 560, 270, 30);
  out += rect(220, 360, 420, 190, 0, cylY(a, f), edge(f, 0.35));
  out += rect(220, 360, 420, 190, 0, matTexture(a, f));
  out += ellipse(640, 455, 52, 95, a.lin([
    [0, f.base],
    [1, f.deep],
  ], 0, 0, 1, 0));
  for (const x of [320, 540]) {
    out += rect(x, 352, 30, 206, 4, cylY(a, toneOf("#2b2e33")));
  }
  out += rect(527, 438, 56, 36, 6, cylY(a, CHROME));
  out += ellipse(220, 455, 52, 95, a.lin([
    [0, f.hi],
    [1, f.base],
  ], 0, 0, 1, 1), edge(f, 0.4));
  out += path(spiral(222, 455, 48, 88, 5), "none", stroke(f.deep, 4, { "stroke-opacity": 0.7 }));
  out += ellipse(222, 455, 7, 12, f.deep);
  out += rect(240, 376, 380, 26, 13, "#ffffff", { "fill-opacity": 0.25 });
  return out;
}

function openMat(a: Art, f: Finish): string {
  let out = shadow(a, 400, 690, 330, 30);
  const flat = "M250 280H550L668 680H132Z";
  out += path(flat, a.lin([
    [0, f.shade],
    [1, mix(f.hi, f.base, 0.4)],
  ]), edge(f, 0.4));
  out += path(flat, matTexture(a, f));
  out += path("M132 680H668L672 692H128Z", f.deep);
  out += path("M180 600H620M215 480H585", "none", stroke("#ffffff", 2, { "stroke-opacity": 0.25, "stroke-dasharray": "8 8" }));
  out += rect(250, 210, 300, 100, 50, cylY(a, f), edge(f, 0.4));
  out += ellipse(250, 260, 30, 50, a.lin([
    [0, f.hi],
    [1, f.base],
  ], 0, 0, 1, 1));
  out += path(spiral(251, 260, 28, 46, 3), "none", stroke(f.deep, 3, { "stroke-opacity": 0.7 }));
  return out;
}

export const drawYogaMat: DrawKind = (a, f, view) => {
  if (view === "1") return rolledMat(a, f);
  if (view === "2") return openMat(a, f);
  return g(rolledMat(a, f), { transform: "translate(-200 -610) scale(2.2)" }) + sheen(a, "M0 0H300L0 300Z", 0.05);
};

