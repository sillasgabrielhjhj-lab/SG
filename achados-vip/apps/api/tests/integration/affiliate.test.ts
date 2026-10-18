/**
 * Serviço de afiliados (validateLink, addLink, importBatch, pendentes/CSV, exclusão) com um fetcher falso injetado:
 * o destino dos links é decidido pelo teste. Os redirecionamentos reais do safeFetch ficam em tests/sim/affiliate-redirects.
 * Garantias: nada vira VALIDATED sem confirmação; o sistema NUNCA altera nem gera URLs de afiliado.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/lib/env.js';
import { prisma } from '../../src/lib/db.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { SafeFetchTimeoutError, SsrfBlockedError, TooManyRedirectsError } from '../../src/lib/ssrf.js';
import {
  FORMAT_ONLY_NOTE,
  MAX_IMPORT_LINES,
  addLink,
  countLinksByStatus,
  countPendingProducts,
  deleteLink,
  findCanonicalUrl,
  getValidatedLink,
  importBatch,
  listLinks,
  listPendingProducts,
  parseImportText,
  pendingToCsv,
  productsWithValidatedLink,
  validateLink,
} from '../../src/services/affiliate.js';
import { updateSettings } from '../../src/services/settings.js';
import { fakeFetcher, productPage, productUrl, seedLinkFor, seedManualChannel, seedMlProduct, seedOfferFor, type FakeFetchStep } from '../helpers/affiliate-fixtures.js';
import { closeTestResources, resetDb } from '../helpers/db.js';

afterAll(async () => {
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
});

const SHORT = 'https://meli.la/2aBcDeF';
const ID = 'MLB1000000001';

/** Destino confirmado: o link curto redireciona para a página do produto `mlId`. */
const lands = (mlId: string, url = SHORT): FakeFetchStep => ({ status: 200, url: productUrl(mlId), redirects: [url] });

async function pendingLink(productId: string, url = SHORT) {
  return prisma.affiliateLink.create({ data: { productId, url, status: 'PENDING', kind: 'MANUAL' } });
}

describe('afiliados: validateLink — destino confirmado', () => {
  it('redirecionamento termina no produto certo => VALIDATED (1 HEAD só), com id resolvido e URL intocada', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const f = fakeFetcher(() => lands(ID));
    const out = await validateLink(link.id, { fetcher: f });
    expect(out).toMatchObject({ status: 'VALIDATED', resolvedItemId: ID, lastError: null, url: SHORT });
    expect(out.validatedAt).toBeInstanceOf(Date);
    expect(out.validationNote).toMatch(/Destino confirmado: MLB1000000001 \(1 redirecionamento/);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ url: SHORT, method: 'HEAD' });
    expect(f.calls[0]!.opts).toMatchObject({ maxRedirects: 5, timeoutMs: 8000 });
  });

  it('HEAD sem o id (ou bloqueado) cai para GET e usa <link rel="canonical">/og:url', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const f = fakeFetcher((_u, o) => (o.method === 'HEAD' ? { status: 200, url: 'https://www.mercadolivre.com.br/landing' } : { status: 200, url: 'https://www.mercadolivre.com.br/landing', html: productPage(ID) }));
    const out = await validateLink(link.id, { fetcher: f });
    expect(out.status).toBe('VALIDATED');
    expect(f.calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);

    const ogOnly = await pendingLink(product.id, 'https://meli.la/og');
    const f2 = fakeFetcher((_u, o) => ({ status: 200, url: 'https://www.mercadolivre.com.br/landing', html: o.method === 'GET' ? `<meta property="og:url" content="${productUrl(ID)}">` : '' }));
    expect((await validateLink(ogOnly.id, { fetcher: f2 })).status).toBe('VALIDATED');
  });

  it('o id também pode estar na cadeia de redirecionamentos (página final sem id)', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const f = fakeFetcher(() => ({ status: 200, url: 'https://www.mercadolivre.com.br/ofertas/aberto', redirects: [SHORT, productUrl(ID)] }));
    expect((await validateLink(link.id, { fetcher: f })).status).toBe('VALIDATED');
  });

  it('produto de catálogo: o destino /p/MLB555 bate com o catalogProductId do produto', async () => {
    const product = await seedMlProduct({ externalId: ID, catalogProductId: 'MLB555' });
    const link = await pendingLink(product.id);
    const f = fakeFetcher(() => ({ status: 200, url: 'https://www.mercadolivre.com.br/produto-x/p/MLB555', redirects: [SHORT] }));
    const out = await validateLink(link.id, { fetcher: f });
    expect(out).toMatchObject({ status: 'VALIDATED', resolvedItemId: 'MLB555' });
  });

  it('a URL do afiliado é guardada exatamente como informada (query, utm e fragmento preservados)', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const url = 'https://www.mercadolivre.com.br/MLB-1000000001-fone?matt_tool=123&matt_word=achadosvip&utm_source=zap#polycard_client=x';
    const out = await addLink(product.id, `  ${url}\n`, 'admin-1', { fetcher: fakeFetcher(() => lands(ID, url)) });
    expect(out.url).toBe(url);
    expect(out).toMatchObject({ status: 'VALIDATED', kind: 'MANUAL', createdBy: 'admin-1' });
  });

  it('link inexistente => NotFoundError', async () => {
    await expect(validateLink('nao-existe', { fetcher: fakeFetcher(() => ({})) })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('afiliados: validateLink — recusas SEM rede (forma e host)', () => {
  const bad: [string, string][] = [
    ['http (sem TLS)', 'http://meli.la/abc'],
    ['host fora da lista', 'https://www.exemplo-malicioso.com/MLB-1000000001'],
    ['domínio que apenas contém o permitido', 'https://mercadolivre.com.br.evil.com/MLB-1000000001'],
    ['credenciais na URL', 'https://usuario:senha@meli.la/abc'],
    ['IP literal', 'https://93.184.216.34/MLB-1000000001'],
    ['IP obfuscado (decimal)', 'https://2130706433/x'],
    ['porta não padrão', 'https://meli.la:8443/abc'],
    ['texto que não é URL', 'isto-nao-e-uma-url'],
    ['com espaço', 'https://meli.la/ab c'],
  ];
  it.each(bad)('%s => INVALID, sem nenhuma consulta de rede', async (_name, url) => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id, url);
    const f = fakeFetcher(() => lands(ID));
    const out = await validateLink(link.id, { fetcher: f });
    expect(out.status).toBe('INVALID');
    expect(out.validatedAt).toBeNull();
    expect(out.lastError).toBeTruthy();
    expect(out.validationNote).toMatch(/^Formato\/host inválido/);
    expect(f.calls).toHaveLength(0);
  });

  it('URL cujo id de anúncio é de OUTRO produto => INVALID sem rede (mostra os dois ids)', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id, 'https://www.mercadolivre.com.br/MLB-1000000099-outra-coisa-_JM?matt_tool=1');
    const f = fakeFetcher(() => lands(ID));
    const out = await validateLink(link.id, { fetcher: f });
    expect(out).toMatchObject({ status: 'INVALID', resolvedItemId: 'MLB1000000099', lastError: 'produto diferente' });
    expect(out.validationNote).toContain('MLB1000000099');
    expect(out.validationNote).toContain(ID);
    expect(f.calls).toHaveLength(0);
  });
});

describe('afiliados: validateLink — produto de destino diferente e destinos problemáticos', () => {
  it('o redirecionamento termina em OUTRO produto => INVALID (nunca VALIDATED)', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const out = await validateLink(link.id, { fetcher: fakeFetcher(() => lands('MLB1000000099')) });
    expect(out).toMatchObject({ status: 'INVALID', resolvedItemId: 'MLB1000000099', lastError: 'produto diferente', validatedAt: null });
    expect(out.validationNote).toMatch(/outro produto/);
  });

  it('host final fora da lista permitida => INVALID', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const out = await validateLink(link.id, { fetcher: fakeFetcher(() => ({ status: 200, url: 'https://loja-falsa.example.net/MLB-1000000001', redirects: [SHORT] })) });
    expect(out.status).toBe('INVALID');
    expect(out.validationNote).toMatch(/fora da lista permitida \(loja-falsa\.example\.net\)/);
  });

  it.each([404, 410])('destino com HTTP %i => INVALID', async (status) => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const out = await validateLink(link.id, { fetcher: fakeFetcher(() => ({ status, url: 'https://www.mercadolivre.com.br/erro' })) });
    expect(out).toMatchObject({ status: 'INVALID', lastError: `HTTP ${status}` });
  });

  it.each([403, 429, 500, 502, 503])('HTTP %i no destino => PENDING ("não foi possível confirmar"), nunca VALIDATED', async (status) => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const out = await validateLink(link.id, { fetcher: fakeFetcher(() => ({ status, url: 'https://www.mercadolivre.com.br/x' })) });
    expect(out.status).toBe('PENDING');
    expect(out.validatedAt).toBeNull();
    expect(out.validationNote).toMatch(/Não foi possível confirmar/);
  });

  it('página abre mas não revela o produto => PENDING', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    const out = await validateLink(link.id, { fetcher: fakeFetcher(() => ({ status: 200, url: 'https://www.mercadolivre.com.br/ofertas', html: '<html>sem id</html>' })) });
    expect(out.status).toBe('PENDING');
    expect(out.lastError).toMatch(/sem id de anúncio/);
  });

  describe('rede indisponível => NUNCA VALIDATED', () => {
    const failures: [string, () => Error][] = [
      ['conexão recusada', () => Object.assign(new Error('connect ECONNREFUSED 93.184.216.34:443'), { code: 'ECONNREFUSED' })],
      ['timeout do safeFetch', () => new SafeFetchTimeoutError(8000)],
      ['falha de DNS', () => new SsrfBlockedError('falha ao resolver o host: meli.la')],
      ['erro qualquer', () => new Error('socket hang up')],
    ];
    it.each(failures)('%s => PENDING com o motivo guardado', async (_n, make) => {
      const product = await seedMlProduct({ externalId: ID });
      const link = await pendingLink(product.id);
      const out = await validateLink(link.id, { fetcher: fakeFetcher(() => make()) });
      expect(out.status).toBe('PENDING');
      expect(out.validatedAt).toBeNull();
      expect(out.lastError).toBeTruthy();
      expect(out.validationNote).toMatch(/rede indisponível/);
      expect(await getValidatedLink(product.id)).toBeNull();
    });
  });

  it('redirecionamento para destino bloqueado pelo SSRF (ou redirecionamentos demais) => INVALID', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const blocked = await validateLink((await pendingLink(product.id)).id, { fetcher: fakeFetcher(() => new SsrfBlockedError('destino bloqueado (169.254.169.254 -> endereço não público)')) });
    expect(blocked).toMatchObject({ status: 'INVALID' });
    expect(blocked.validationNote).toMatch(/bloqueado por segurança/);
    const loop = await validateLink((await pendingLink(product.id, 'https://meli.la/loop')).id, { fetcher: fakeFetcher(() => new TooManyRedirectsError(5)) });
    expect(loop).toMatchObject({ status: 'INVALID' });
    expect(loop.validationNote).toMatch(/redirecionamentos demais/);
  });
});

describe('afiliados: validateLink — configuração, revalidação e produtos de teste', () => {
  it('resolveRedirects=false: VALIDATED apenas por formato, com a ressalva explícita e sem rede', async () => {
    await updateSettings({ affiliate: { resolveRedirects: false } });
    const product = await seedMlProduct({ externalId: ID });
    const f = fakeFetcher(() => lands('MLB1000000099'));
    const out = await validateLink((await pendingLink(product.id)).id, { fetcher: f });
    expect(out).toMatchObject({ status: 'VALIDATED', validationNote: FORMAT_ONLY_NOTE });
    expect(out.validationNote).toMatch(/NÃO foi confirmado/);
    expect(f.calls).toHaveLength(0);
    // mesmo assim a forma e o id da própria URL continuam sendo checados
    expect((await validateLink((await pendingLink(product.id, 'https://evil.com/x')).id, { fetcher: f })).status).toBe('INVALID');
    expect((await validateLink((await pendingLink(product.id, 'https://www.mercadolivre.com.br/MLB-999-x')).id, { fetcher: f })).status).toBe('INVALID');
  });

  it('revalidar um link já CONFIRMADO que falha só por indisponibilidade mantém a validação anterior (com aviso)', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    await validateLink(link.id, { fetcher: fakeFetcher(() => lands(ID)) });
    const again = await validateLink(link.id, { fetcher: fakeFetcher(() => new Error('socket hang up')) });
    expect(again.status).toBe('VALIDATED');
    expect(again.lastError).toBe('socket hang up');
    expect(again.validationNote).toMatch(/mantida a validação anterior/);
    expect(await getValidatedLink(product.id)).not.toBeNull();
  });

  it('...mas uma revalidação que descobre OUTRO produto derruba a validação (INVALID)', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    await validateLink(link.id, { fetcher: fakeFetcher(() => lands(ID)) });
    const again = await validateLink(link.id, { fetcher: fakeFetcher(() => lands('MLB1000000099')) });
    expect(again.status).toBe('INVALID');
    expect(again.validatedAt).toBeNull();
    expect(await getValidatedLink(product.id)).toBeNull();
  });

  it('...e um link validado só "por formato" NÃO é preservado quando a confirmação passa a ser exigida e a rede falha', async () => {
    await updateSettings({ affiliate: { resolveRedirects: false } });
    const product = await seedMlProduct({ externalId: ID });
    const link = await pendingLink(product.id);
    expect((await validateLink(link.id)).status).toBe('VALIDATED');
    await updateSettings({ affiliate: { resolveRedirects: true } });
    const again = await validateLink(link.id, { fetcher: fakeFetcher(() => new Error('sem rede')) });
    expect(again.status).toBe('PENDING');
    expect(await getValidatedLink(product.id)).toBeNull();
  });

  it('produto de TESTE (fixture) nunca tem link validado em produção', async () => {
    const product = await seedMlProduct({ externalId: ID, source: 'fixture' });
    const link = await pendingLink(product.id);
    const f = fakeFetcher(() => lands(ID));
    const original = env.isProduction;
    (env as { isProduction: boolean }).isProduction = true;
    try {
      const out = await validateLink(link.id, { fetcher: f });
      expect(out).toMatchObject({ status: 'INVALID', lastError: 'produto de teste' });
      expect(f.calls).toHaveLength(0);
      await seedLinkFor(product.id, { status: 'VALIDATED' });
      expect(await getValidatedLink(product.id)).toBeNull(); // defesa em profundidade
      expect((await productsWithValidatedLink([product.id])).size).toBe(0);
    } finally {
      (env as { isProduction: boolean }).isProduction = original;
    }
    // fora de produção o fixture segue o fluxo normal
    expect((await validateLink(link.id, { fetcher: f })).status).toBe('VALIDATED');
  });

  it('findCanonicalUrl lê canonical e og:url em qualquer ordem de atributos/aspas', () => {
    expect(findCanonicalUrl(`<link href='https://a.com/x' rel='canonical'>`)).toBe('https://a.com/x');
    expect(findCanonicalUrl(`<link rel="canonical" href="https://a.com/y">`)).toBe('https://a.com/y');
    expect(findCanonicalUrl(`<meta property="og:url" content="https://a.com/z">`)).toBe('https://a.com/z');
    expect(findCanonicalUrl('<html>nada</html>')).toBeNull();
  });
});

describe('afiliados: addLink, getValidatedLink e deleteLink', () => {
  it('addLink: mesmo (produto, URL) não duplica — reaproveita e revalida; URL diferente cria outro', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const down = fakeFetcher(() => new Error('sem rede'));
    const first = await addLink(product.id, SHORT, 'u1', { fetcher: down });
    expect(first.status).toBe('PENDING');
    const second = await addLink(product.id, SHORT, 'u1', { fetcher: fakeFetcher(() => lands(ID)) });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('VALIDATED');
    const other = await addLink(product.id, 'https://meli.la/outro', 'u1', { fetcher: fakeFetcher(() => lands(ID, 'https://meli.la/outro')) });
    expect(other.id).not.toBe(first.id);
    expect(await prisma.affiliateLink.count()).toBe(2);
  });

  it('addLink valida a entrada: URL vazia/longa demais => ValidationError; produto inexistente => NotFoundError', async () => {
    const product = await seedMlProduct({ externalId: ID });
    await expect(addLink(product.id, '   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(addLink(product.id, `https://meli.la/${'a'.repeat(5000)}`)).rejects.toBeInstanceOf(ValidationError);
    await expect(addLink('produto-que-nao-existe', SHORT)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.affiliateLink.count()).toBe(0);
  });

  it('getValidatedLink só devolve VALIDATED (o mais recente) e respeita a lista de hosts atual', async () => {
    const product = await seedMlProduct({ externalId: ID });
    await seedLinkFor(product.id, { status: 'PENDING', url: 'https://meli.la/pendente' });
    await seedLinkFor(product.id, { status: 'INVALID', url: 'https://meli.la/invalido' });
    expect(await getValidatedLink(product.id)).toBeNull();
    expect((await productsWithValidatedLink([product.id])).size).toBe(0);

    await seedLinkFor(product.id, { url: 'https://meli.la/antigo', validatedAt: new Date('2026-01-01T00:00:00Z') });
    const recent = await seedLinkFor(product.id, { url: 'https://www.mercadolivre.com.br/novo', validatedAt: new Date('2026-06-01T00:00:00Z') });
    expect((await getValidatedLink(product.id))?.id).toBe(recent.id);

    // o host deixou de ser permitido: o link validado antes não é mais utilizável
    await updateSettings({ affiliate: { allowedHosts: ['mercadolivre.com.br', 'www.mercadolivre.com.br'] } });
    const stillOk = await getValidatedLink(product.id);
    expect(stillOk?.id).toBe(recent.id);
    await updateSettings({ affiliate: { allowedHosts: ['meli.la'] } });
    expect((await getValidatedLink(product.id))?.url).toBe('https://meli.la/antigo');
    await updateSettings({ affiliate: { allowedHosts: ['outro.com'] } });
    expect(await getValidatedLink(product.id)).toBeNull();
    expect((await productsWithValidatedLink([product.id])).size).toBe(0);
  });

  it('deleteLink: exclui link não usado; BLOQUEIA (409 LINK_IN_USE) link usado em publicação; 404 se não existe', async () => {
    const product = await seedMlProduct({ externalId: ID });
    const free = await seedLinkFor(product.id, { url: 'https://meli.la/livre' });
    await deleteLink(free.id);
    expect(await prisma.affiliateLink.findUnique({ where: { id: free.id } })).toBeNull();

    const used = await seedLinkFor(product.id, { url: 'https://meli.la/usado' });
    const offer = await seedOfferFor(product.id, { status: 'APPROVED' });
    const channel = await seedManualChannel();
    await prisma.publication.create({
      data: { offerId: offer.id, channelId: channel.id, status: 'SENT', template: 'COMMON', messageText: 'x', affiliateLinkId: used.id, idempotencyKey: `${offer.id}:${channel.id}`, sentAt: new Date() },
    });
    const err = await deleteLink(used.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err).toMatchObject({ status: 409, code: 'LINK_IN_USE' });
    expect(await prisma.affiliateLink.findUnique({ where: { id: used.id } })).not.toBeNull();

    await expect(deleteLink('nao-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('listLinks filtra por status/produto e pagina; countLinksByStatus agrega', async () => {
    const a = await seedMlProduct({ externalId: 'MLB1000000001' });
    const b = await seedMlProduct({ externalId: 'MLB1000000002' });
    await seedLinkFor(a.id, { status: 'VALIDATED' });
    await seedLinkFor(a.id, { status: 'PENDING' });
    await seedLinkFor(b.id, { status: 'INVALID' });
    await seedLinkFor(b.id, { status: 'INVALID' });
    expect(await countLinksByStatus()).toEqual({ pending: 1, validated: 1, invalid: 2 });
    expect((await listLinks({ status: 'INVALID', page: 1, pageSize: 10 })).total).toBe(2);
    expect((await listLinks({ productId: a.id, page: 1, pageSize: 10 })).items.map((l) => l.productTitle)).toEqual([a.title, a.title]);
    const page = await listLinks({ page: 2, pageSize: 3 });
    expect(page).toMatchObject({ total: 4, page: 2, pageSize: 3 });
    expect(page.items).toHaveLength(1);
  });
});

describe('afiliados: importBatch — formatos de entrada', () => {
  async function setup() {
    const p1 = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Fone JBL' });
    const p2 = await seedMlProduct({ externalId: 'MLB1000000002', title: 'Cafeteira Arno' });
    const p3 = await seedMlProduct({ externalId: 'MLB1000000003', title: 'Tênis Corrida', catalogProductId: 'MLB555' });
    const p4 = await seedMlProduct({ externalId: 'MLB1000000004', title: 'Tênis Corrida (outro anúncio)', catalogProductId: 'MLB555' });
    return { p1, p2, p3, p4 };
  }
  /** Cada link curto leva ao produto cujo id está nele: https://meli.la/mlb1000000001 => MLB1000000001. */
  const byUrl = () =>
    fakeFetcher((url) => {
      const m = /meli\.la\/(?:mlb)?(\d+)/i.exec(url);
      if (!m) return new Error('sem rede');
      return m[1] === '555' ? { status: 200, url: 'https://www.mercadolivre.com.br/tenis/p/MLB555', redirects: [url] } : lands(`MLB${m[1]}`, url);
    });

  it('"URL_ML ; URL_AFILIADO" e "MLB123 ; URL_AFILIADO" (qualquer caixa, com/sem hífen)', async () => {
    const { p1, p2, p3 } = await setup();
    const text = [
      `${p1.permalink} ; https://meli.la/mlb1000000001`,
      'mlb-1000000002;https://meli.la/mlb1000000002',
      'MLB1000000003 ; https://meli.la/mlb1000000003',
    ].join('\n');
    const f = byUrl();
    const r = await importBatch(text, 'admin-1', { fetcher: f });
    expect(r).toMatchObject({ imported: 3, validated: 3, invalid: [], unmatched: [], pending: 0, duplicates: 0 });
    const links = await prisma.affiliateLink.findMany({ orderBy: { url: 'asc' } });
    expect(links.map((l) => [l.productId, l.kind, l.status, l.createdBy])).toEqual([
      [p1.id, 'IMPORTED', 'VALIDATED', 'admin-1'],
      [p2.id, 'IMPORTED', 'VALIDATED', 'admin-1'],
      [p3.id, 'IMPORTED', 'VALIDATED', 'admin-1'],
    ]);
  });

  it('CSV com vírgula, ponto e vírgula e TAB; células entre aspas; cabeçalho, BOM, CRLF, comentários e linhas vazias', async () => {
    await setup();
    const text = [
      '﻿url_ml,url_afiliado', // BOM + cabeçalho
      '',
      '# comentário',
      'MLB1000000001,https://meli.la/mlb1000000001',
      '"MLB1000000002";"https://meli.la/mlb1000000002"',
    ].join('\r\n');
    const r1 = await importBatch(text, undefined, { fetcher: byUrl() });
    expect(r1).toMatchObject({ imported: 2, validated: 2 });

    const tab = 'MLB1000000003\thttps://meli.la/mlb1000000003';
    expect(await importBatch(tab, undefined, { fetcher: byUrl() })).toMatchObject({ imported: 1, validated: 1 });
  });

  it('exportação de pendentes + coluna de afiliado preenchida (id;titulo;url_ml;score;url_afiliado) é aceita', async () => {
    const { p1 } = await setup();
    await seedOfferFor(p1.id, { score: 77 });
    const csv = pendingToCsv(await listPendingProducts());
    const filled = csv.replace(/\r\n$/, `;https://meli.la/mlb1000000001\r\n`).replace('id;titulo;url_ml;score', 'id;titulo;url_ml;score;url_afiliado');
    const parsed = parseImportText(filled);
    expect(parsed).toEqual([{ line: 2, ref: { type: 'productId', value: p1.id }, url: 'https://meli.la/mlb1000000001' }]);
    expect(await importBatch(filled, 'admin', { fetcher: byUrl() })).toMatchObject({ imported: 1, validated: 1 });
  });

  it('referência pelo id interno do produto (cuid)', async () => {
    const { p2 } = await setup();
    const r = await importBatch(`${p2.id};https://meli.la/mlb1000000002`, undefined, { fetcher: byUrl() });
    expect(r).toMatchObject({ imported: 1, validated: 1 });
  });

  it('id de CATÁLOGO vale para todos os anúncios daquele produto', async () => {
    const { p3, p4 } = await setup();
    const r = await importBatch('MLB555;https://meli.la/mlb555', undefined, { fetcher: byUrl() });
    expect(r).toMatchObject({ imported: 2, validated: 2 });
    expect((await prisma.affiliateLink.findMany()).map((l) => l.productId).sort()).toEqual([p3.id, p4.id].sort());
  });

  it('números de linha originais em unmatched/invalid; produto não descoberto, sem URL, sem referência, host inválido e produto diferente', async () => {
    await setup();
    const text = [
      'url_ml;url_afiliado', // 1: cabeçalho (ignorado)
      'MLB1000000001;https://meli.la/mlb1000000001', // 2: ok
      'MLB9999999999;https://meli.la/mlb9999999999', // 3: produto não descoberto
      'MLB1000000002', // 4: sem URL de afiliado
      'https://meli.la/mlb1000000002', // 5: sem referência do produto
      'MLB1000000002;https://evil.example.com/x', // 6: host não permitido (a URL tem https mas o host não)
      'MLB1000000002;https://meli.la/mlb1000000001', // 7: leva a OUTRO produto
    ].join('\n');
    const r = await importBatch(text, undefined, { fetcher: byUrl() });
    expect(r.imported).toBe(3); // linhas 2, 6 e 7 viraram registros (6 e 7 INVALID)
    expect(r.validated).toBe(1);
    expect(r.unmatched).toEqual([{ line: 3, reason: expect.stringContaining('MLB9999999999') }]);
    expect(r.invalid.map((i) => i.line)).toEqual([4, 5, 6, 7]);
    expect(r.invalid[0]!.reason).toMatch(/sem URL de afiliado/i);
    expect(r.invalid[1]!.reason).toMatch(/sem referência do produto/i);
    expect(r.invalid[2]!.reason).toMatch(/Host não permitido/);
    expect(r.invalid[3]!.reason).toBe('produto diferente');
    expect(await prisma.affiliateLink.count({ where: { status: 'VALIDATED' } })).toBe(1);
  });

  it('duplicados: a mesma linha duas vezes no texto e reimportar depois não geram novos registros', async () => {
    await setup();
    const line = 'MLB1000000001;https://meli.la/mlb1000000001';
    const r1 = await importBatch(`${line}\n${line}\nmlb1000000001 ; https://meli.la/mlb1000000001`, undefined, { fetcher: byUrl() });
    expect(r1).toMatchObject({ imported: 1, validated: 1, duplicates: 2 });
    const r2 = await importBatch(line, undefined, { fetcher: byUrl() });
    expect(r2).toMatchObject({ imported: 0, validated: 0, duplicates: 1 });
    expect(await prisma.affiliateLink.count()).toBe(1);
  });

  it('reimportar REVALIDA o que ficou pendente (rede caiu na primeira vez)', async () => {
    await setup();
    const line = 'MLB1000000001;https://meli.la/mlb1000000001';
    const down = await importBatch(line, undefined, { fetcher: fakeFetcher(() => new Error('sem rede')) });
    expect(down).toMatchObject({ imported: 1, validated: 0, pending: 1, invalid: [] });
    expect((await prisma.affiliateLink.findFirstOrThrow()).status).toBe('PENDING');
    const up = await importBatch(line, undefined, { fetcher: byUrl() });
    expect(up).toMatchObject({ imported: 0, duplicates: 1, validated: 1, pending: 0 });
    expect((await prisma.affiliateLink.findFirstOrThrow()).status).toBe('VALIDATED');
  });

  it('NUNCA altera a URL importada (parâmetros de afiliado intactos)', async () => {
    await setup();
    const url = 'https://meli.la/mlb1000000001?matt_tool=99&matt_word=achados&ref=x%20y';
    await importBatch(`MLB1000000001;${url}`, undefined, { fetcher: byUrl() });
    expect((await prisma.affiliateLink.findFirstOrThrow()).url).toBe(url);
    expect(await getValidatedLink((await prisma.product.findFirstOrThrow({ where: { externalId: 'MLB1000000001' } })).id)).toMatchObject({ url });
  });

  it('texto vazio, só cabeçalho/comentários => tudo zero; acima de 1000 linhas => ValidationError', async () => {
    await setup();
    const zero = { imported: 0, validated: 0, invalid: [], unmatched: [], pending: 0, duplicates: 0 };
    expect(await importBatch('')).toEqual(zero);
    expect(await importBatch('url_ml;url_afiliado\n# nada\n\n')).toEqual(zero);
    const many = Array.from({ length: MAX_IMPORT_LINES + 1 }, (_, i) => `MLB${i + 1};https://meli.la/${i}`).join('\n');
    await expect(importBatch(many)).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.affiliateLink.count()).toBe(0);
  });

  it('parseImportText: com 2 URLs na linha a última é a do afiliado; título com ";" entre aspas não quebra a linha', () => {
    const rows = parseImportText('"Fone; JBL ""Tune""";https://produto.mercadolivre.com.br/MLB-1000000001-x;https://meli.la/abc');
    expect(rows).toEqual([{ line: 1, ref: { type: 'mlId', value: 'MLB1000000001' }, url: 'https://meli.la/abc' }]);
    expect(parseImportText('só uma linha de lixo\nMLB1;https://meli.la/a')).toHaveLength(1); // 1ª linha sem URL/id é tratada como cabeçalho
  });
});

describe('afiliados: pendentes (produtos qualificados sem link validado) e CSV', () => {
  async function scenario() {
    const best = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Melhor oferta' });
    await seedOfferFor(best.id, { status: 'DISCOVERED', score: 70 });
    await seedOfferFor(best.id, { status: 'APPROVED', score: 92 }); // a melhor oferta do produto é a listada
    const approved = await seedMlProduct({ externalId: 'MLB1000000002', title: 'Aprovada' });
    await seedOfferFor(approved.id, { status: 'APPROVED', score: 85 });
    const queued = await seedMlProduct({ externalId: 'MLB1000000003', title: 'Na fila com link pendente' });
    await seedOfferFor(queued.id, { status: 'QUEUED', score: 60 });
    await seedLinkFor(queued.id, { status: 'PENDING' });
    await seedLinkFor(queued.id, { status: 'INVALID' });
    // fora da lista:
    const withLink = await seedMlProduct({ externalId: 'MLB1000000004', title: 'Já tem link' });
    await seedOfferFor(withLink.id, { status: 'APPROVED', score: 99 });
    await seedLinkFor(withLink.id, { status: 'VALIDATED' });
    const closed = await seedMlProduct({ externalId: 'MLB1000000005', title: 'Ofertas encerradas' });
    for (const status of ['REJECTED', 'EXPIRED', 'PUBLISHED', 'SUSPENDED'] as const) await seedOfferFor(closed.id, { status, score: 95 });
    const suspended = await seedMlProduct({ externalId: 'MLB1000000006', title: 'Produto suspenso', status: 'SUSPENDED' });
    await seedOfferFor(suspended.id, { status: 'DISCOVERED', score: 95 });
    const fixture = await seedMlProduct({ externalId: 'MLB1000000007', title: '[FIXTURE] Produto de teste', source: 'fixture' });
    await seedOfferFor(fixture.id, { status: 'DISCOVERED', score: 50 });
    return { best, approved, queued, fixture };
  }

  it('lista só produtos ativos com oferta aberta (DISCOVERED/APPROVED/QUEUED) e sem link validado, pela melhor pontuação', async () => {
    const { best, approved, queued, fixture } = await scenario();
    const rows = await listPendingProducts();
    expect(rows.map((r) => r.score)).toEqual([92, 85, 60, 50]);
    expect(rows.map((r) => r.productId)).toEqual([best.id, approved.id, queued.id, fixture.id]); // o fixture (teste) só aparece fora de produção
    expect(rows[0]).toMatchObject({ title: 'Melhor oferta', permalink: best.permalink });
    expect(rows[0]!.offerId).toBeTruthy();
    expect(await countPendingProducts()).toBe(rows.length);
  });

  it('em produção os produtos de teste (fixture) não aparecem', async () => {
    const { fixture } = await scenario();
    const original = env.isProduction;
    (env as { isProduction: boolean }).isProduction = true;
    try {
      const rows = await listPendingProducts();
      expect(rows.map((r) => r.productId)).not.toContain(fixture.id);
      expect(rows).toHaveLength(3);
      expect(await countPendingProducts()).toBe(3);
    } finally {
      (env as { isProduction: boolean }).isProduction = original;
    }
  });

  it('o produto sai da lista quando ganha um link VALIDADO', async () => {
    const { best } = await scenario();
    const before = await countPendingProducts();
    await seedLinkFor(best.id, { status: 'VALIDATED' });
    expect((await listPendingProducts()).map((r) => r.productId)).not.toContain(best.id);
    expect(await countPendingProducts()).toBe(before - 1);
  });

  it('respeita o limite', async () => {
    await scenario();
    expect(await listPendingProducts(2)).toHaveLength(2);
  });

  it('CSV: BOM, cabeçalho id;titulo;url_ml;score, CRLF, aspas escapadas e proteção contra fórmulas', async () => {
    const p = await seedMlProduct({ externalId: 'MLB1000000001', title: 'Fone; "Pro" Max' });
    const evil = await seedMlProduct({ externalId: 'MLB1000000002', title: '=HYPERLINK("http://x","clique")' });
    const neg = await seedMlProduct({ externalId: 'MLB1000000003', title: '-2+3 Cabo' });
    await seedOfferFor(p.id, { score: 90 });
    await seedOfferFor(evil.id, { score: 80 });
    await seedOfferFor(neg.id, { score: 70 });
    const csv = pendingToCsv(await listPendingProducts());
    expect(csv.startsWith('﻿id;titulo;url_ml;score\r\n')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(`${p.id};"Fone; ""Pro"" Max";${p.permalink};90`);
    expect(lines[2]).toContain(`'=HYPERLINK`); // título começa com apóstrofo: não executa como fórmula
    expect(lines[2]!.split(';')[1]).toMatch(/^"?'=HYPERLINK/);
    expect(lines[3]).toContain(`'-2+3 Cabo`);
    expect(pendingToCsv([])).toBe('﻿id;titulo;url_ml;score\r\n');
  });
});
