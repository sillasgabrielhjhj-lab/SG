/** Prefixa caminhos de arquivos em /public com o basePath (necessário em subpastas, ex.: GitHub Pages). */
export function asset(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
