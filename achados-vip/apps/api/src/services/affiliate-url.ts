/** Utilitários puros de URL do Mercado Livre / afiliado. Sem rede: só valida a FORMA (a resolução de destino fica em services/affiliate.ts). */

const ML_ID_RE = /(?<![A-Za-z0-9])(MLBU?)-?(\d+)(?!\d)/i;
const BARE_ID_RE = /^(MLBU?)-?(\d+)$/i;
const MAX_URL_LENGTH = 2048;

const normalizeId = (m: RegExpExecArray) => `${m[1]!.toUpperCase()}${m[2]!}`;

/**
 * Extrai o id do anúncio/produto do ML: "MLB-123" / "MLB123" (solto ou na URL) / "/p/MLB123" (catálogo) / MLBU (produto de usuário).
 * Retorna sempre sem hífen e em maiúsculas ("MLB123"). Procura primeiro no caminho; depois na query/hash.
 * Não valida o host (use checkAffiliateUrlShape).
 */
export function extractMlItemId(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const bare = BARE_ID_RE.exec(raw);
  if (bare) return normalizeId(bare);
  let places: string[];
  try {
    const u = new URL(raw);
    let path = u.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* mantém o caminho cru */
    }
    places = [path, u.search, u.hash];
  } catch {
    places = [raw];
  }
  for (const place of places) {
    const m = ML_ID_RE.exec(place);
    if (m) return normalizeId(m);
  }
  return null;
}

const hostMatches = (host: string, allowed: string) => {
  const a = allowed.trim().toLowerCase().replace(/\.$/, '');
  if (!a) return false;
  // "*.dominio.com" aceita subdomínios (não o domínio puro)
  return a.startsWith('*.') ? host.endsWith(a.slice(1)) && host.length > a.length - 1 : host === a;
};

/**
 * Valida a forma da URL de afiliado: https, porta padrão, host exato na lista (ou "*.x"), sem credenciais, sem IP literal.
 * Não faz rede nem prova que o link é de afiliado.
 */
export function checkAffiliateUrlShape(url: string, allowedHosts: readonly string[]): { ok: boolean; reason?: string } {
  const raw = (url ?? '').trim();
  if (!raw) return { ok: false, reason: 'URL vazia' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: 'URL longa demais' };
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return { ok: false, reason: 'URL contém espaços ou caracteres de controle' };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL inválida' };
  }
  if (u.protocol !== 'https:') return { ok: false, reason: 'A URL precisa usar https' };
  if (u.username || u.password) return { ok: false, reason: 'A URL não pode conter usuário/senha' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  // new URL normaliza formas numéricas (decimal/hex/octal) para IPv4 pontuado; IPv6 vem entre colchetes
  if (host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { ok: false, reason: 'A URL não pode usar endereço IP' };
  if (u.port && u.port !== '443') return { ok: false, reason: 'A URL não pode usar porta não padrão' };
  if (!allowedHosts.some((a) => hostMatches(host, a))) return { ok: false, reason: `Host não permitido: ${host}` };
  return { ok: true };
}
