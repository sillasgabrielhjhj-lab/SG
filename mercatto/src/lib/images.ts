/** SVG e artes de demonstração são servidos como estão (o otimizador do Next não os processa). */
export function skipImageOptimization(src: string): boolean {
  return src.endsWith(".svg") || src.startsWith("/demo-assets/");
}
