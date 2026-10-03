import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "public", "placeholders");
mkdirSync(outDir, { recursive: true });

const palettes = [
  ["#4F3CC9", "#7C6AE8"],
  ["#E85D33", "#FF8A5C"],
  ["#0F7A5C", "#2FBF8F"],
  ["#1E3A8A", "#3B82F6"],
  ["#9D174D", "#DB2777"],
  ["#92400E", "#D97706"],
  ["#374151", "#6B7280"],
  ["#065F46", "#10B981"],
];

function shapeFor(index) {
  const shapes = [
    `<circle cx="300" cy="280" r="130" fill="rgba(255,255,255,0.18)" />`,
    `<rect x="170" y="150" width="260" height="260" rx="28" fill="rgba(255,255,255,0.16)" />`,
    `<polygon points="300,150 430,380 170,380" fill="rgba(255,255,255,0.16)" />`,
  ];
  return shapes[index % shapes.length];
}

function buildSvg(seedIndex, label) {
  const [c1, c2] = palettes[seedIndex % palettes.length];
  const shape = shapeFor(seedIndex);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)" />
  ${shape}
  <text x="50%" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.85)">${label}</text>
</svg>`;
}

const total = 48;
for (let i = 0; i < total; i++) {
  const svg = buildSvg(i, "Mercatto");
  writeFileSync(join(outDir, `ph-${i}.svg`), svg, "utf8");
}

console.log(`Generated ${total} placeholder images in ${outDir}`);
