/**
 * "Hosts virtuais" SIMULADOS (SOMENTE testes): permite exercitar o safeFetch REAL (SSRF, redirecionamentos, limites,
 * timeout) contra nomes de host como `meli.la` ou `produto.mercadolivre.com.br` sem acessar a internet.
 *
 * Como usar no arquivo de teste (vi.mock é içado, por isso o import dinâmico dentro da fábrica):
 *
 *   vi.mock('undici', async (importOriginal) => {
 *     const actual = await importOriginal<typeof import('undici')>();
 *     const { wrapUndiciRequest } = await import('../helpers/sim-virtual-hosts.js');
 *     return { ...actual, request: wrapUndiciRequest(actual.request) };
 *   });
 *
 * Todo o resto do safeFetch (validação SSRF com resolver injetado, laço de redirecionamentos, limite de tamanho,
 * prazo) roda de verdade; só o transporte é desviado para um servidor HTTP local, preservando o cabeçalho Host.
 * (Este arquivo NÃO importa nada de src/: a fábrica do vi.mock o carrega enquanto 'undici' ainda está sendo resolvido.)
 */
import type { request as undiciRequest } from 'undici';

const routes = new Map<string, number>();

/** Direciona as requisições (https/http) destes hostnames para 127.0.0.1:<porta>. */
export function routeVirtualHosts(hosts: readonly string[], port: number): void {
  for (const h of hosts) routes.set(h.toLowerCase(), port);
}
export function clearVirtualHosts(): void {
  routes.clear();
}

export function wrapUndiciRequest(actual: typeof undiciRequest): typeof undiciRequest {
  return ((input: unknown, opts: Record<string, unknown> | undefined) => {
    const url = new URL(typeof input === 'string' ? input : String((input as URL).href ?? input));
    const port = routes.get(url.hostname.toLowerCase());
    if (port === undefined) return (actual as (i: unknown, o: unknown) => unknown)(input, opts);
    const { dispatcher: _ignored, ...rest } = opts ?? {};
    const headers = { ...((rest.headers as Record<string, string> | undefined) ?? {}), host: url.host };
    return (actual as (i: unknown, o: unknown) => unknown)(`http://127.0.0.1:${port}${url.pathname}${url.search}`, { ...rest, headers });
  }) as unknown as typeof undiciRequest;
}
