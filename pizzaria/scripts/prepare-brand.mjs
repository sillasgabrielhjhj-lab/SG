/**
 * Gera os arquivos de marca a partir da logo original enviada pelo cliente:
 * - public/brand/logo.png  -> logo com o fundo branco externo removido (transparente)
 * - src/app/icon.png, src/app/apple-icon.png, public/icons/icon-*.png -> ícones do app
 *
 * Uso: node scripts/prepare-brand.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'scripts/logo-original.png';
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => (y * W + x) * 4;
const minC = (i) => Math.min(data[i], data[i + 1], data[i + 2]);

// 1. Flood fill a partir das bordas, atravessando pixels claros (fundo branco + antisserrilhado).
const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const k = y * W + x;
  if (bg[k] || minC(k * 4) < 150) continue;
  bg[k] = 1;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// 2. Pixels do fundo e a borda de 1px ao redor: desmistura a cor do branco para gerar alpha suave.
const ring = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (bg[k]) continue;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && bg[ny * W + nx]) ring[k] = 1;
      }
  }
for (let k = 0; k < W * H; k++) {
  if (!bg[k] && !ring[k]) continue;
  const i = k * 4;
  const a = (255 - minC(i)) / 255;
  if (a < 0.04) { data[i + 3] = 0; continue; }
  for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - 255 * (1 - a)) / a)));
  data[i + 3] = Math.round(a * 255);
}

await mkdir('public/brand', { recursive: true });
await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .trim({ threshold: 1 })
  .png({ compressionLevel: 9, palette: false })
  .toFile('public/brand/logo.png');

// 3. Ícones do app (fatia de pizza em fundo vermelho da marca).
const iconSvg = (size, radius) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="#E31B2C"/>
  <g transform="translate(12 12) scale(1.6667)" fill="none" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z" fill="#00824A"/>
    <path d="M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12"/>
    <path d="M18.8 9.3a1 1 0 0 0 2.1 7.7"/>
    <path d="m12 14-1 1"/>
    <path d="m13.75 18.25-1.25 1.42"/>
  </g>
</svg>`);

await mkdir('public/icons', { recursive: true });
await sharp(iconSvg(64, 14)).resize(64, 64).png().toFile('src/app/icon.png');
await sharp(iconSvg(180, 0)).resize(180, 180).png().toFile('src/app/apple-icon.png');
await sharp(iconSvg(192, 14)).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(iconSvg(512, 14)).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(iconSvg(512, 0)).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png');

const meta = await sharp('public/brand/logo.png').metadata();
console.log('logo', meta.width, meta.height);
