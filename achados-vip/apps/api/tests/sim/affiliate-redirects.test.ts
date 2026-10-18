/**
 * SIMULADO: validação de links de afiliado com o safeFetch REAL (SSRF, redirecionamentos, limites) sobre "hosts
 * virtuais" (meli.la, produto.mercadolivre.com.br...) servidos por um servidor HTTP local. Só o transporte é desviado
 * (vi.mock do undici) e o DNS é substituído por um resolver falso: nenhuma requisição à internet é feita.
 * Cobre o que o fetcher injetado não prova: cadeia de redirecionamentos de verdade, bloqueio SSRF no meio do caminho,
 * laço de redirecionamentos, limites de tamanho e rede indisponível.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { safeFetch } from '../../src/lib/ssrf.js';
import { getValidatedLink, importBatch, validateLink } from '../../src/services/affiliate.js';
import { fakePublicResolver, productUrl, seedMlProduct, simFetcher } from '../helpers/affiliate-fixtures.js';
import { closeTestResources, resetDb } from '../helpers/db.js';
import { clearVirtualHosts, routeVirtualHosts } from '../helpers/sim-virtual-hosts.js';
import { closedPort, startSimServer, type SimRequest, type SimServer } from '../helpers/sim-server.js';

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  const { wrapUndiciRequest } = await import('../helpers/sim-virtual-hosts.js');
  return { ...actual, request: wrapUndiciRequest(actual.request) };
});

const ID = 'MLB1000000001';
const HOSTS = ['meli.la', 'produto.mercadolivre.com.br', 'www.mercadolivre.com.br', 'mercadolivre.com.br', 'evil.example.com'];

const page = (mlId: string) =>
  `<!doctype html><html><head><link rel="canonical" href="https://produto.mercadolivre.com.br/${mlId.replace('MLB', 'MLB-')}-x-_JM"></head><body>${'x'.repeat(200)}</body></html>`;

let server: SimServer;

function respond(req: SimRequest, res: import('node:http').ServerResponse): void {
  const host = String(req.headers.host ?? '');
  const head = req.method === 'HEAD';
  const send = (status: number, headers: Record<string, string | number> = {}, body = '') => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
    res.end(head ? undefined : body);
  };
  const redirect = (status: number, to: string) => send(status, { location: to });

  if (host === 'meli.la') {
    switch (req.path) {
      case '/ok': return redirect(301, 'https://produto.mercadolivre.com.br/MLB-1000000001-fone-_JM?x=1');
      case '/outro': return redirect(302, 'https://produto.mercadolivre.com.br/MLB-1000000099-outro-_JM');
      case '/chain': return redirect(302, 'https://www.mercadolivre.com.br/social/achados?r=1');
      case '/canonical': return send(200, {}, page(ID));
      case '/head405': return head ? send(405) : send(200, {}, page(ID));
      case '/evil': return redirect(302, 'https://evil.example.com/MLB-1000000001');
      case '/ssrf': return redirect(302, 'http://169.254.169.254/latest/meta-data/');
      case '/loopback': return redirect(302, 'http://127.0.0.1:9/MLB-1000000001');
      case '/loop': return redirect(302, 'https://meli.la/loop');
      case '/gone': return send(404, {}, 'não encontrado');
      case '/maint': return send(503, {}, 'manutenção');
      case '/rate': return send(429, { 'retry-after': '60' }, 'muitas requisições');
      case '/forbidden': return send(403, {}, 'bloqueado');
      case '/noid': return send(200, {}, '<html><body>página sem produto</body></html>');
      case '/bighead': return redirect(301, 'https://produto.mercadolivre.com.br/MLB-1000000001-grande-_JM');
      case '/hugeget': return head ? send(200) : send(200, { 'content-length': 5_000_000 }, 'x'.repeat(1000));
      default: return send(404);
    }
  }
  if (host === 'www.mercadolivre.com.br' && req.path === '/social/achados') return redirect(302, 'https://produto.mercadolivre.com.br/MLB-1000000001-fone-_JM');
  if (host === 'produto.mercadolivre.com.br') {
    if (req.path.startsWith('/MLB-1000000001-grande')) return head ? send(200, { 'content-length': 600_000 }) : send(200, {}, page(ID));
    const m = /^\/MLB-(\d+)/.exec(req.path);
    return m ? send(200, {}, page(`MLB${m[1]}`)) : send(404);
  }
  if (host === 'evil.example.com') return send(200, {}, page(ID));
  return send(404);
}

beforeAll(async () => {
  server = await startSimServer(respond);
  routeVirtualHosts(HOSTS, server.port);
});
afterAll(async () => {
  clearVirtualHosts();
  await server.close();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  server.requests.length = 0;
});
afterEach(() => {
  routeVirtualHosts(HOSTS, server.port); // testes de "rede fora" redirecionam hosts; restaura
});

async function check(path: string, opts: { externalId?: string; fetcher?: typeof simFetcher; host?: string } = {}) {
  const product = await seedMlProduct({ externalId: opts.externalId ?? ID });
  const link = await prisma.affiliateLink.create({ data: { productId: product.id, url: `https://${opts.host ?? 'meli.la'}${path}`, status: 'PENDING' } });
  const out = await validateLink(link.id, { fetcher: opts.fetcher ?? simFetcher });
  return { product, out, seen: server.requests.map((r) => `${r.method} ${r.headers.host}${r.path}`) };
}

describe('sim: links de afiliado — destino resolvido pelo safeFetch real', () => {
  it('encurtador -> página do produto: VALIDATED seguindo o redirecionamento (HEAD em cada salto, sem GET)', async () => {
    const { out, seen, product } = await check('/ok');
    expect(out).toMatchObject({ status: 'VALIDATED', resolvedItemId: ID, lastError: null });
    expect(out.validationNote).toMatch(/Destino confirmado: MLB1000000001 \(1 redirecionamento/);
    expect(seen).toEqual(['HEAD meli.la/ok', 'HEAD produto.mercadolivre.com.br/MLB-1000000001-fone-_JM']);
    expect((await getValidatedLink(product.id))?.url).toBe('https://meli.la/ok');
  });

  it('cadeia de dois redirecionamentos', async () => {
    const { out } = await check('/chain');
    expect(out.status).toBe('VALIDATED');
    expect(out.validationNote).toMatch(/\(2 redirecionamento/);
  });

  it('o redirecionamento leva a OUTRO produto => INVALID, nunca VALIDATED', async () => {
    const { out, product } = await check('/outro');
    expect(out).toMatchObject({ status: 'INVALID', resolvedItemId: 'MLB1000000099', lastError: 'produto diferente' });
    expect(await getValidatedLink(product.id)).toBeNull();
  });

  it('HEAD não revela o produto: GET e leitura do <link rel=canonical>', async () => {
    const { out, seen } = await check('/canonical');
    expect(out.status).toBe('VALIDATED');
    expect(seen).toEqual(['HEAD meli.la/canonical', 'GET meli.la/canonical']);
  });

  it('HEAD recusado (405) cai para GET e valida pelo canonical do produto certo', async () => {
    const { out, seen } = await check('/head405');
    expect(out.status).toBe('VALIDATED');
    expect(seen).toEqual(['HEAD meli.la/head405', 'GET meli.la/head405']);
  });

  it('termina em host fora da lista (mesmo com o id certo na página) => INVALID', async () => {
    const { out } = await check('/evil');
    expect(out.status).toBe('INVALID');
    expect(out.validationNote).toMatch(/evil\.example\.com/);
  });

  it.each([
    ['metadata de nuvem (169.254.169.254)', '/ssrf'],
    ['loopback (127.0.0.1)', '/loopback'],
  ])('redirecionamento para %s é bloqueado pelo SSRF no meio do caminho => INVALID', async (_n, path) => {
    const { out, seen } = await check(path);
    expect(out.status).toBe('INVALID');
    expect(out.validationNote).toMatch(/bloqueado por segurança/);
    expect(seen).toEqual([`HEAD meli.la${path}`]); // o destino interno nunca foi consultado
  });

  it('laço de redirecionamentos => INVALID depois de 5 saltos', async () => {
    const { out, seen } = await check('/loop');
    expect(out.status).toBe('INVALID');
    expect(out.validationNote).toMatch(/redirecionamentos demais/);
    expect(seen).toHaveLength(6);
  });

  it('404 => INVALID; 503, 429 e 403 => PENDING (HEAD e depois GET), nunca VALIDATED', async () => {
    expect((await check('/gone')).out).toMatchObject({ status: 'INVALID', lastError: 'HTTP 404' });
    for (const [path, code] of [['/maint', 503], ['/rate', 429], ['/forbidden', 403]] as const) {
      server.requests.length = 0;
      const { out, seen } = await check(path, { externalId: `MLB${1000000100 + code}` });
      expect(out, path).toMatchObject({ status: 'PENDING', lastError: `HTTP ${code}`, validatedAt: null });
      expect(seen).toEqual([`HEAD meli.la${path}`, `GET meli.la${path}`]);
    }
  });

  it('página que abre mas não identifica o produto => PENDING', async () => {
    const { out } = await check('/noid');
    expect(out.status).toBe('PENDING');
    expect(out.validatedAt).toBeNull();
  });

  it('resposta de HEAD com Content-Length grande (página do produto) NÃO impede a validação', async () => {
    // o HEAD de uma página grande informa o tamanho do corpo que NÃO é lido; isso não é "resposta grande demais"
    const { out } = await check('/bighead');
    expect(out).toMatchObject({ status: 'VALIDATED', resolvedItemId: ID });
  });

  it('GET com corpo acima do limite (5 MB) => PENDING (não confirma, não valida)', async () => {
    const { out } = await check('/hugeget');
    expect(out.status).toBe('PENDING');
    expect(out.lastError).toMatch(/maior que o limite/);
  });

  it('o Host virtual é preservado na requisição e o User-Agent é identificado', async () => {
    await check('/ok');
    const first = server.requests[0]!;
    expect(first.headers.host).toBe('meli.la');
    expect(first.headers['user-agent']).toBe('AchadosVIP/1.0');
    expect(first.headers.authorization).toBeUndefined();
    expect(first.headers.cookie).toBeUndefined();
  });
});

describe('sim: links de afiliado — rede indisponível nunca valida', () => {
  it('servidor fora do ar (conexão recusada) => PENDING', async () => {
    routeVirtualHosts(HOSTS, await closedPort());
    const { out, product } = await check('/ok');
    expect(out.status).toBe('PENDING');
    expect(out.validationNote).toMatch(/rede indisponível/);
    expect(await getValidatedLink(product.id)).toBeNull();
  });

  it('DNS falhando => PENDING (e nenhuma requisição sai)', async () => {
    const dnsDown: typeof simFetcher = (url, opts) =>
      safeFetch(url, {
        ...opts,
        resolver: async () => {
          throw new Error('getaddrinfo ENOTFOUND meli.la');
        },
      });
    const { out, seen } = await check('/ok', { fetcher: dnsDown });
    expect(out.status).toBe('PENDING');
    expect(seen).toEqual([]);
  });

  it('resolver que devolve IP interno para o host => INVALID (rebinding/DNS malicioso)', async () => {
    const poisoned: typeof simFetcher = (url, opts) => safeFetch(url, { ...opts, resolver: async () => [{ address: '10.0.0.5', family: 4 }] });
    const { out, seen } = await check('/ok', { fetcher: poisoned });
    expect(out.status).toBe('INVALID');
    expect(seen).toEqual([]);
  });

  it('o resolver falso é público (documentação): sem ele o teste não passaria pela validação SSRF', async () => {
    expect((await fakePublicResolver())[0]!.address).toBe('93.184.216.34');
  });
});

describe('sim: importação em lote com destinos reais simulados', () => {
  it('cada linha recebe o veredito do seu próprio destino (VALIDATED, INVALID e PENDING no mesmo lote)', async () => {
    const p1 = await seedMlProduct({ externalId: 'MLB1000000001' });
    const p2 = await seedMlProduct({ externalId: 'MLB1000000002' });
    const p3 = await seedMlProduct({ externalId: 'MLB1000000003' });
    const text = [
      `${productUrl('MLB1000000001')} ; https://meli.la/ok`, // ok
      `MLB1000000002 ; https://meli.la/outro`, // leva ao MLB1000000099 (não é o p2)
      `MLB1000000003 ; https://meli.la/maint`, // 503
    ].join('\n');
    const r = await importBatch(text, 'admin-1', { fetcher: simFetcher });
    expect(r).toMatchObject({ imported: 3, validated: 1, pending: 1 });
    expect(r.invalid).toEqual([{ line: 2, reason: 'produto diferente' }]);
    const byProduct = Object.fromEntries((await prisma.affiliateLink.findMany()).map((l) => [l.productId, l.status]));
    expect(byProduct).toEqual({ [p1.id]: 'VALIDATED', [p2.id]: 'INVALID', [p3.id]: 'PENDING' });
    expect((await getValidatedLink(p2.id))).toBeNull();
    expect((await getValidatedLink(p3.id))).toBeNull();
  });
});
