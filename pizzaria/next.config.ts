import type { NextConfig } from 'next';

/**
 * Dois modos de build:
 * - `npm run build`        → app Next.js padrão (Vercel, Node, etc.)
 * - `npm run build:static` → site 100% estático em /out (GitHub Pages, Netlify, qualquer hospedagem)
 *   Para publicar em subpasta, defina NEXT_PUBLIC_BASE_PATH (ex.: "/pizzaria").
 */
const isStaticExport = process.env.STATIC_EXPORT === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: 'export', trailingSlash: true } : {}),
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // As fotos vêm de uma CDN que redimensiona sob demanda (Unsplash/imgix),
    // então o mesmo loader funciona tanto no modo servidor quanto no estático.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 160, 256, 320],
    qualities: [60, 70, 75, 80],
  },
};

export default nextConfig;
