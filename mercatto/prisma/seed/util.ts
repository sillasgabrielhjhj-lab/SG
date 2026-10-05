/** Utilidades determinísticas do seed (mesma entrada => mesmos dados). */

/** PRNG Mulberry32 com semente fixa — o seed é reprodutível. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!,
    chance: (p: number) => next() < p,
  };
}

export function cpfFromSeed(n: number): string {
  const r = rng(1000 + n);
  const base = Array.from({ length: 9 }, () => r.int(0, 9));
  if (new Set(base).size === 1) base[8] = (base[8]! + 1) % 10;
  const dv = (d: number[]) => {
    const s = d.reduce((acc, x, i) => acc + x * (d.length + 1 - i), 0);
    const m = (s * 10) % 11;
    return m === 10 ? 0 : m;
  };
  const d1 = dv(base);
  return [...base, d1, dv([...base, d1])].join("");
}

/** EAN-13 com dígito verificador válido (prefixo 789 = Brasil). Marcado como DEMO no produto. */
export function ean13(n: number): string {
  const body = `789${String(100000000 + n).slice(-9)}`;
  const sum = body.split("").map(Number).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

export const demoImg = (kind: string, color: string, view: 1 | 2 | 3) => `/demo-assets/p/${kind}/${color}/${view}.svg`;
export const demoBanner = (name: string) => `/demo-assets/banner/${name}.svg`;

export const daysAgo = (d: number, hours = 0) => new Date(Date.now() - d * 24 * 3600_000 - hours * 3600_000);
export const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);
