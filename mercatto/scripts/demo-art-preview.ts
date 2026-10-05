/**
 * QA visual das ilustrações de demonstração.
 *
 *   npx tsx scripts/demo-art-preview.ts [--no-shots]
 *
 * Gera /tmp/claude-0/demo-art-preview/ com os SVGs (todos os kinds × 3 cores ×
 * 3 vistas + banners), páginas HTML em partes e screenshots PNG (Playwright).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEMO_ART_COLORS, DEMO_ART_KINDS, DEMO_ART_VIEWS, DEMO_BANNER_NAMES } from "../src/features/demo-art/catalog";
import { renderBannerSvg, renderProductSvg } from "../src/features/demo-art/render";

const OUT = "/tmp/claude-0/demo-art-preview";
const PER_PAGE = 6;
const THUMB = 150;

function colorsFor(index: number) {
  const n = DEMO_ART_COLORS.length;
  return [DEMO_ART_COLORS[index % n], DEMO_ART_COLORS[(index + 4) % n], DEMO_ART_COLORS[(index + 9) % n]].filter(
    (c): c is (typeof DEMO_ART_COLORS)[number] => c !== undefined,
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
body{margin:0;padding:12px;font:12px system-ui,sans-serif;background:#fff;color:#16232a}
.row{display:flex;align-items:center;gap:4px;margin-bottom:6px}
.lbl{width:96px;font-weight:600}
img{width:${THUMB}px;height:${THUMB}px;border:1px solid #e3e7e7}
.sep{width:8px}
.banner img{width:800px;height:300px;margin:4px}
</style></head><body>${body}</body></html>`;
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "svg"), { recursive: true });
  const sizes: { name: string; bytes: number }[] = [];
  const rows: string[] = [];

  const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
  DEMO_ART_KINDS.forEach((kind, i) => {
    if (only && !only.includes(kind)) return;
    let row = `<div class="row"><div class="lbl">${kind}</div>`;
    colorsFor(i).forEach((color, ci) => {
      if (ci) row += `<div class="sep"></div>`;
      for (const view of DEMO_ART_VIEWS) {
        const svg = renderProductSvg({ kind, color, view });
        const file = `${kind}-${color}-${view}.svg`;
        writeFileSync(join(OUT, "svg", file), svg);
        sizes.push({ name: file, bytes: Buffer.byteLength(svg) });
        row += `<img src="svg/${file}" alt="${file}">`;
      }
    });
    rows.push(`${row}</div>`);
  });

  let banners = "";
  for (const name of DEMO_BANNER_NAMES) {
    const svg = renderBannerSvg(name);
    writeFileSync(join(OUT, "svg", `banner-${name}.svg`), svg);
    sizes.push({ name: `banner-${name}.svg`, bytes: Buffer.byteLength(svg) });
    banners += `<img src="svg/banner-${name}.svg" alt="${name}">`;
  }

  const pages: string[] = [];
  for (let p = 0; p * PER_PAGE < rows.length; p += 1) {
    const file = `part-${p + 1}.html`;
    writeFileSync(join(OUT, file), page(file, rows.slice(p * PER_PAGE, (p + 1) * PER_PAGE).join("")));
    pages.push(file);
  }
  writeFileSync(join(OUT, "banners.html"), page("banners", `<div class="banner">${banners}</div>`));
  pages.push("banners.html");
  writeFileSync(join(OUT, "index.html"), page("demo-art", rows.join("") + `<div class="banner">${banners}</div>`));

  sizes.sort((x, y) => y.bytes - x.bytes);
  const over = sizes.filter((s) => !s.name.startsWith("banner-") && s.bytes > 25 * 1024);
  console.log(`SVGs: ${sizes.length}; maiores:`, sizes.slice(0, 5).map((s) => `${s.name} ${(s.bytes / 1024).toFixed(1)}KB`).join(", "));
  if (over.length) console.log("ACIMA DE 25KB:", over.map((s) => s.name).join(", "));

  if (process.argv.includes("--no-shots")) return;
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }));
  const ctx = await browser.newContext({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  for (const file of pages) {
    await tab.goto(`file://${join(OUT, file)}`);
    await tab.waitForLoadState("load");
    await tab.screenshot({ path: join(OUT, file.replace(".html", ".png")), fullPage: true });
  }
  await browser.close();
  console.log(`Screenshots em ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
