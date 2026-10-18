/**
 * SIMULADO: o adaptador MercadoLivreApiSource é exercitado contra um servidor HTTP local que imita a API do
 * Mercado Livre (OAuth refresh_token, busca, /items, /users). NENHUMA chamada real ao ML é feita (o sandbox bloqueia
 * api.mercadolibre.com); o comportamento real (ex.: HTTP 403 na busca, rotação do refresh_token) precisa ser
 * validado com credenciais reais pelo botão "Testar fonte".
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MercadoLivreApiSource,
  SourceInvalidResponseError,
  SourceRequestError,
  SourceTimeoutError,
  SourceUnavailableError,
  mapMlItem,
  parseSellerReputation,
  type MercadoLivreOptions,
  type MlCredentials,
} from '../../src/adapters/sources/mercadolivre.js';
import { SourceAuthError, SourceRateLimitError, type FetchContext } from '../../src/domain/types.js';
import { closedPort } from '../helpers/sim-server.js';
import { ML_TEST_CREDS, MlSimulator, mlSearchItem, mlUser } from '../helpers/sim-ml.js';

let sim: MlSimulator;
beforeEach(async () => {
  sim = await MlSimulator.start();
});
afterEach(async () => {
  await sim.close();
});

const CAT = 'MLB1055';
const ctx = (over: Partial<FetchContext> = {}): FetchContext => ({ mlCategoryIds: [CAT], searchTerms: [], limit: 50, ...over });

function source(over: Partial<MercadoLivreOptions> = {}): MercadoLivreApiSource {
  return new MercadoLivreApiSource({
    credentials: { ...ML_TEST_CREDS },
    baseUrl: sim.baseUrl,
    allowPrivate: true, // simulador em localhost (a lib recusa em produção)
    minDelayMs: 0,
    retryBaseDelayMs: 5,
    timeoutMs: 3000,
    ...over,
  });
}
/** Isola a busca: sem /items e sem /users. */
const bare = (over: Partial<MercadoLivreOptions> = {}) => source({ enrichItems: false, lookupSellers: false, ...over });

const ids = (n: number, from = 1): string[] => Array.from({ length: n }, (_, i) => `MLB${1000000000 + from + i}`);
function seedItems(n: number, category = CAT, over: Record<string, unknown> = {}): string[] {
  const list = ids(n);
  for (const id of list) sim.addItem(category, id, over);
  return list;
}

describe('sim: MercadoLivreApiSource — OAuth (refresh_token => access_token)', () => {
  it('troca o refresh_token por access_token, usa Bearer na API e reaproveita o token em cache', async () => {
    seedItems(2);
    const src = bare();
    await src.fetchListings(ctx());
    await src.fetchListings(ctx());

    const tokens = sim.calls('token');
    expect(tokens).toHaveLength(1); // cache: uma única renovação para duas buscas
    expect(tokens[0]!.method).toBe('POST');
    expect(String(tokens[0]!.headers['content-type'])).toContain('application/x-www-form-urlencoded');
    const form = tokens[0]!.form();
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'refresh_token',
      client_id: ML_TEST_CREDS.clientId,
      client_secret: ML_TEST_CREDS.clientSecret,
      refresh_token: ML_TEST_CREDS.refreshToken,
    });
    const searches = sim.calls('search');
    expect(searches).toHaveLength(2);
    expect(searches.every((r) => r.headers.authorization === 'Bearer AT-1')).toBe(true);
  });

  it('o refresh_token é de uso único: cada renovação entrega o novo a onRefreshTokenRotated e o usa na seguinte', async () => {
    seedItems(1);
    sim.accessTtlSec = 30; // abaixo da margem de segurança (60 s): toda chamada renova
    const rotated: MlCredentials[] = [];
    const src = bare({ onRefreshTokenRotated: (c) => void rotated.push(c) });
    await src.fetchListings(ctx());
    await src.fetchListings(ctx());
    await src.fetchListings(ctx());

    expect(sim.calls('token')).toHaveLength(3);
    expect(rotated.map((c) => c.refreshToken)).toEqual(['RT-1', 'RT-2', 'RT-3']);
    expect(rotated.every((c) => c.clientId === ML_TEST_CREDS.clientId && c.clientSecret === ML_TEST_CREDS.clientSecret)).toBe(true);
    // o simulador recusa refresh_token reutilizado: o sucesso das 3 chamadas prova que o novo foi usado
    expect(sim.calls('token').map((r) => r.form().get('refresh_token'))).toEqual(['RT-0', 'RT-1', 'RT-2']);
  });

  it('falha ao persistir o refresh_token novo não derruba a coleta', async () => {
    seedItems(1);
    const src = bare({
      onRefreshTokenRotated: () => {
        throw new Error('banco indisponível');
      },
    });
    await expect(src.fetchListings(ctx())).resolves.toHaveLength(1);
  });

  it('chamadas concorrentes compartilham uma única renovação de token', async () => {
    seedItems(3);
    const src = bare();
    await Promise.all([src.fetchListingsByIds([ids(1)[0]!]), src.fetchListingsByIds([ids(2, 2)[1]!]), src.fetchListings(ctx())]);
    expect(sim.calls('token')).toHaveLength(1);
  });

  it('refresh_token inválido (400 invalid_grant) => SourceAuthError, sem chamar a API e sem vazar segredos', async () => {
    seedItems(1);
    const src = bare({ credentials: { ...ML_TEST_CREDS, refreshToken: 'RT-revogado-xyz' } });
    const err = await src.fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceAuthError);
    const msg = (err as Error).message;
    expect(msg).toMatch(/renovar o token/i);
    expect(msg).not.toContain(ML_TEST_CREDS.clientSecret);
    expect(msg).not.toContain('RT-revogado-xyz');
    expect(sim.calls('search')).toHaveLength(0);
  });

  it('invalid_grant + reloadCredentials com refresh_token mais novo (outro processo rotacionou) => recarrega e segue', async () => {
    seedItems(1);
    sim.refreshToken = 'RT-OUTRO-PROCESSO';
    let reloads = 0;
    const src = bare({
      reloadCredentials: async () => {
        reloads++;
        return { ...ML_TEST_CREDS, refreshToken: 'RT-OUTRO-PROCESSO' };
      },
    });
    await expect(src.fetchListings(ctx())).resolves.toHaveLength(1);
    expect(reloads).toBe(1);
    expect(sim.calls('token').map((r) => r.form().get('refresh_token'))).toEqual(['RT-0', 'RT-OUTRO-PROCESSO']);
  });

  it('invalid_grant e a recarga devolve o MESMO token => SourceAuthError (não insiste)', async () => {
    const src = bare({ credentials: { ...ML_TEST_CREDS, refreshToken: 'RT-velho' }, reloadCredentials: async () => ({ ...ML_TEST_CREDS, refreshToken: 'RT-velho' }) });
    await expect(src.fetchListings(ctx())).rejects.toBeInstanceOf(SourceAuthError);
    expect(sim.calls('token')).toHaveLength(1);
  });

  it('token revogado (401 na API) => renova UMA vez e repete; se continuar 401 => SourceAuthError', async () => {
    seedItems(1);
    const src = bare();
    await src.fetchListings(ctx());
    sim.revokeAllTokens();
    await expect(src.fetchListings(ctx())).resolves.toHaveLength(1);
    expect(sim.calls('token')).toHaveLength(2);

    sim.script('search', { status: 401, body: { message: 'invalid_token' } }, { status: 401, body: { message: 'invalid_token' } });
    const err = await src.fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceAuthError);
    expect((err as Error).message).toMatch(/401/);
  });

  it('403 na busca => SourceAuthError imediato (sem retentativas e sem tentar contornar)', async () => {
    seedItems(1);
    sim.script('search', { status: 403, body: { message: 'forbidden', blocked_by: 'PolicyAgent' } });
    const err = await bare().fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceAuthError);
    expect((err as Error).message).toMatch(/403/);
    expect(sim.calls('search')).toHaveLength(1);
    expect(sim.calls('token')).toHaveLength(1);
  });

  it('sem credenciais => SourceAuthError sem nenhuma requisição; healthCheck => AUTH_REQUIRED', async () => {
    const src = new MercadoLivreApiSource({ credentials: null, baseUrl: sim.baseUrl, allowPrivate: true });
    await expect(src.fetchListings(ctx())).rejects.toBeInstanceOf(SourceAuthError);
    await expect(src.fetchListing('MLB1')).rejects.toBeInstanceOf(SourceAuthError);
    expect(await src.healthCheck()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect(sim.requests).toHaveLength(0);
  });

  it('resposta de token sem access_token => SourceInvalidResponseError', async () => {
    sim.script('token', { status: 200, body: { token_type: 'Bearer' } });
    await expect(bare().fetchListings(ctx())).rejects.toBeInstanceOf(SourceInvalidResponseError);
  });

  it('429 ao renovar o token => SourceRateLimitError com Retry-After; 5xx => retentativas e SourceUnavailableError', async () => {
    sim.script('token', { status: 429, headers: { 'retry-after': '30' }, body: {} });
    const rl = await bare().fetchListings(ctx()).catch((e: unknown) => e);
    expect(rl).toBeInstanceOf(SourceRateLimitError);
    expect((rl as SourceRateLimitError).retryAfterMs).toBe(30_000);

    sim.clearTraffic();
    sim.script('token', { status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} });
    await expect(bare().fetchListings(ctx())).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(sim.calls('token')).toHaveLength(3); // 1 + maxRetries (2)
  });

  it('a lib recusa destinos privados por padrão (proteção SSRF): sem allowPrivate nada chega ao simulador', async () => {
    const src = new MercadoLivreApiSource({ credentials: { ...ML_TEST_CREDS }, baseUrl: sim.baseUrl, maxRetries: 0, minDelayMs: 0 });
    const err = await src.fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceUnavailableError);
    expect(sim.requests).toHaveLength(0);
  });
});

describe('sim: MercadoLivreApiSource — busca paginada por categoria', () => {
  it('pagina até esgotar os resultados (offset/limit corretos) e devolve todos os itens', async () => {
    seedItems(7);
    const out = await bare({ pageSize: 3 }).fetchListings(ctx({ limit: 10 }));
    expect(out).toHaveLength(7);
    const searches = sim.calls('search');
    expect(searches.map((r) => [r.query.get('category'), r.query.get('offset'), r.query.get('limit')])).toEqual([
      [CAT, '0', '3'],
      [CAT, '3', '3'],
      [CAT, '6', '3'],
    ]);
    expect(new Set(out.map((l) => l.externalId)).size).toBe(7);
  });

  it('respeita o limite pedido (para de paginar e pede só o necessário na última página)', async () => {
    seedItems(20);
    const out = await bare({ pageSize: 3 }).fetchListings(ctx({ limit: 5 }));
    expect(out).toHaveLength(5);
    expect(sim.calls('search').map((r) => [r.query.get('offset'), r.query.get('limit')])).toEqual([
      ['0', '3'],
      ['3', '2'],
    ]);
  });

  it('o tamanho de página nunca passa de 50 (máximo da API)', async () => {
    seedItems(60);
    await bare({ pageSize: 500 }).fetchListings(ctx({ limit: 120 }));
    expect(Math.max(...sim.calls('search').map((r) => Number(r.query.get('limit'))))).toBeLessThanOrEqual(50);
  });

  it('várias categorias e termos: divide o orçamento, consulta cada um e remove duplicados entre consultas', async () => {
    sim.addItem('MLB1', 'MLB1000000001', { title: 'Fone Bluetooth JBL Tune' });
    sim.addItem('MLB1', 'MLB1000000002', { title: 'Cafeteira Arno' });
    sim.addItem('MLB2', 'MLB1000000003', { title: 'Tênis Corrida' });
    const out = await bare().fetchListings({ mlCategoryIds: ['MLB1', 'MLB2'], searchTerms: ['fone'], limit: 30 });
    const searches = sim.calls('search');
    expect(searches).toHaveLength(3);
    expect(searches.map((r) => r.query.get('category') ?? `q:${r.query.get('q')}`)).toEqual(['MLB1', 'MLB2', 'q:fone']);
    expect(out.map((l) => l.externalId).sort()).toEqual(['MLB1000000001', 'MLB1000000002', 'MLB1000000003']); // o "fone" já veio por MLB1
  });

  it('sem categoria nem termos: não chama a API', async () => {
    expect(await bare().fetchListings({ mlCategoryIds: [], searchTerms: [], limit: 10 })).toEqual([]);
    expect(sim.requests).toHaveLength(0);
  });

  it('categoria inválida (400) é ignorada com aviso se as outras funcionam; se todas falham => SourceRequestError', async () => {
    sim.addItem('MLB2', 'MLB1000000009');
    sim.badCategories.add('MLB0');
    const src = bare();
    const out = await src.fetchListings({ mlCategoryIds: ['MLB0', 'MLB2'], searchTerms: [], limit: 10 });
    expect(out).toHaveLength(1);
    expect(src.lastWarnings.join(' ')).toMatch(/MLB0.*ignorada/);

    const err = await src.fetchListings({ mlCategoryIds: ['MLB0'], searchTerms: [], limit: 10 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRequestError);
    expect((err as SourceRequestError).status).toBe(400);
  });
});

describe('sim: MercadoLivreApiSource — mapeamento SOMENTE de campos presentes', () => {
  it('item mínimo: nada é inventado (sem original_price, cupom, parcelas, relâmpago, estoque, vendedor, fotos)', async () => {
    sim.items.set('MLB1000000001', {
      id: 'MLB1000000001',
      category: CAT,
      search: { id: 'MLB1000000001', title: 'Produto mínimo', price: 99.9, permalink: 'https://produto.mercadolivre.com.br/MLB-1000000001-produto-minimo-_JM', category_id: CAT },
    });
    const [l] = await source().fetchListings(ctx());
    expect(l).toBeDefined();
    expect(l!.priceCents).toBe(9990);
    expect(l).toMatchObject({
      source: 'mercadolivre',
      externalId: 'MLB1000000001',
      advertisedOriginalPriceCents: null,
      availableQuantity: null,
      soldQuantity: null,
      seller: null,
      coupon: null,
      installments: null,
      quality: null,
      thumbnail: null,
      imageUrl: null,
      catalogProductId: null,
      condition: null,
    });
    expect('flashDeal' in l!).toBe(false);
    expect(sim.calls('users')).toHaveLength(0); // sem vendedor, nada a consultar
  });

  it('item completo: preço em centavos, preço "de" anunciado, parcelas, frete grátis, fotos, garantia, relâmpago', async () => {
    sim.addItem(CAT, 'MLB1000000001', {
      price: 199.9,
      original_price: 299.9,
      catalog_product_id: 'MLB555',
      tags: ['lightning_deal', 'good_quality_picture'],
      installments: { quantity: 12, amount: 16.66, rate: 0 },
      warranty: 'Garantia do vendedor: 90 dias',
      pictures: [{ secure_url: 'https://http2.mlstatic.com/D_NQ_NP_A.jpg' }, { url: 'http://http2.mlstatic.com/D_NQ_NP_B.jpg' }, { secure_url: 'https://http2.mlstatic.com/D_NQ_NP_C.jpg' }],
    });
    const [l] = await bare().fetchListings(ctx());
    expect(l).toMatchObject({
      priceCents: 19990,
      advertisedOriginalPriceCents: 29990,
      catalogProductId: 'MLB555',
      flashDeal: true,
      installments: { quantity: 12, amountCents: 1666, interestFree: true },
      availableQuantity: 30,
      soldQuantity: 800,
      thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_1-I.jpg', // http => https
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_A.jpg',
      condition: 'new',
      mlCategoryId: CAT,
      quality: { pictureCount: 3, hasWarranty: true, freeShipping: true, listingType: 'gold_special' },
      seller: { id: '999', name: 'LOJA_TESTE' },
    });
    expect(l!.coupon).toBeNull();
  });

  it('parcelas: com juros quando rate > 0; sem "rate" na resposta o parcelamento é omitido (nunca presumido)', () => {
    const base = mlSearchItem('MLB1000000001');
    expect(mapMlItem({ ...base, installments: { quantity: 6, amount: 40, rate: 1.99 } })!.installments).toEqual({ quantity: 6, amountCents: 4000, interestFree: false });
    expect(mapMlItem({ ...base, installments: { quantity: 6, amount: 40 } })!.installments).toBeNull();
    expect(mapMlItem({ ...base, installments: { quantity: 0, amount: 40, rate: 0 } })!.installments).toBeNull();
    expect(mapMlItem({ ...base, installments: null })!.installments).toBeNull();
  });

  it('original_price só vira "preço de" anunciado quando é MAIOR que o preço; deal_ids e sale_price não viram relâmpago/cupom/preço', () => {
    const base = mlSearchItem('MLB1000000001', { price: 100 });
    expect(mapMlItem({ ...base, original_price: 100 })!.advertisedOriginalPriceCents).toBeNull();
    expect(mapMlItem({ ...base, original_price: 80 })!.advertisedOriginalPriceCents).toBeNull();
    const l = mapMlItem({ ...base, deal_ids: ['MLB1234'], sale_price: { amount: 10 }, coupon: { code: 'CUPOM10' }, tags: ['deal_of_the_day'] })!;
    expect(l.priceCents).toBe(10000);
    expect('flashDeal' in l).toBe(false);
    expect(l.coupon).toBeNull();
  });

  it('arredonda corretamente valores com ponto flutuante (19,99 => 1999 centavos)', () => {
    expect(mapMlItem(mlSearchItem('MLB1000000001', { price: 19.99 }))!.priceCents).toBe(1999);
    expect(mapMlItem(mlSearchItem('MLB1000000001', { price: 1299.9 }))!.priceCents).toBe(129990);
    expect(mapMlItem(mlSearchItem('MLB1000000001', { price: 0.1 + 0.2 }))!.priceCents).toBe(30);
  });

  it('descarta itens sem o mínimo (id, título, permalink, preço) ou que não estão ativos; garantia "sem garantia" => false', () => {
    const base = mlSearchItem('MLB1000000001');
    expect(mapMlItem({ ...base, price: undefined })).toBeNull();
    expect(mapMlItem({ ...base, price: '199,90' })).toBeNull(); // string não é número: não adivinha
    expect(mapMlItem({ ...base, title: '  ' })).toBeNull();
    expect(mapMlItem({ ...base, permalink: undefined })).toBeNull();
    expect(mapMlItem({ ...base, status: 'paused' })).toBeNull();
    expect(mapMlItem({ ...base, status: 'closed' })).toBeNull();
    expect(mapMlItem({ ...base, status: 'active' })).not.toBeNull();
    expect(mapMlItem('x')).toBeNull();
    expect(mapMlItem(null)).toBeNull();
    expect(mapMlItem({ ...base, warranty: 'Sem garantia' })!.quality?.hasWarranty).toBe(false);
  });

  it('reputação: formatos do ML (level_id "5_green", fração ou %) e valores desconhecidos => sem dado', () => {
    expect(parseSellerReputation({ level_id: '5_green', power_seller_status: 'gold', transactions: { completed: 120, ratings: { positive: 0.97 } } })).toEqual({
      reputationLevel: 'green',
      powerSellerStatus: 'gold',
      completedTransactions: 120,
      positiveRatio: 0.97,
    });
    expect(parseSellerReputation({ level_id: '3_yellow', transactions: { ratings: { positive: 94 } } })).toEqual({ reputationLevel: 'yellow', positiveRatio: 0.94 });
    expect(parseSellerReputation({ level_id: 'nivel_novo' })).toEqual({});
    expect(parseSellerReputation({ transactions: { ratings: { positive: 1500 } } })).toEqual({});
    expect(parseSellerReputation(null)).toEqual({});
    expect(parseSellerReputation('x')).toEqual({});
  });
});

describe('sim: MercadoLivreApiSource — multiget /items e reputação do vendedor', () => {
  it('complementa a busca com /items (fotos, garantia, estoque atualizado) em lotes de 20', async () => {
    const list = seedItems(25);
    const first = sim.items.get(list[0]!)!;
    first.detail = {
      available_quantity: 7,
      warranty: 'Garantia de fábrica: 12 meses',
      pictures: [{ secure_url: 'https://http2.mlstatic.com/D_NQ_NP_X.jpg' }, { secure_url: 'https://http2.mlstatic.com/D_NQ_NP_Y.jpg' }],
    };
    const out = await source({ lookupSellers: false }).fetchListings(ctx({ limit: 50 }));
    expect(out).toHaveLength(25);

    const multigets = sim.calls('items');
    expect(multigets.map((r) => (r.query.get('ids') ?? '').split(',').length)).toEqual([20, 5]);
    const l = out.find((x) => x.externalId === list[0])!;
    expect(l.availableQuantity).toBe(7);
    expect(l.imageUrl).toBe('https://http2.mlstatic.com/D_NQ_NP_X.jpg');
    expect(l.quality).toMatchObject({ pictureCount: 2, hasWarranty: true });
  });

  it('item que o multiget diz não existir (404) sai do resultado; 403 por item mantém só os dados da busca', async () => {
    const [a, b, c] = seedItems(3) as [string, string, string];
    sim.items.get(b)!.detail = null; // 404 em /items
    sim.items.get(c)!.multigetCode = 403;
    const out = await source({ lookupSellers: false }).fetchListings(ctx());
    expect(out.map((l) => l.externalId).sort()).toEqual([a, c].sort());
  });

  it('falha do complemento (HTTP 500 em /items) não derruba a busca: mantém dados da busca e avisa', async () => {
    seedItems(2);
    sim.script('items', { status: 500, body: {} });
    const src = source({ lookupSellers: false, maxRetries: 0 });
    const out = await src.fetchListings(ctx());
    expect(out).toHaveLength(2);
    expect(src.lastWarnings.join(' ')).toMatch(/complemento via \/items ignorado/);
  });

  it('erro de autenticação no multiget NÃO é engolido', async () => {
    seedItems(2);
    sim.script('items', { status: 403, body: {} });
    await expect(source({ lookupSellers: false }).fetchListings(ctx())).rejects.toBeInstanceOf(SourceAuthError);
  });

  it('reputação do vendedor vem de /users/{id} (uma consulta por vendedor) e fica em cache', async () => {
    sim.addItem(CAT, 'MLB1000000001', { seller: { id: 999, nickname: 'LOJA_A' } });
    sim.addItem(CAT, 'MLB1000000002', { seller: { id: 999, nickname: 'LOJA_A' } });
    sim.addItem(CAT, 'MLB1000000003', { seller: { id: 777, nickname: 'LOJA_B' } });
    sim.sellers.set('999', mlUser(999));
    sim.sellers.set('777', mlUser(777, { seller_reputation: { level_id: '3_yellow', transactions: { completed: 30, ratings: { positive: 0.9 } } } }));
    const src = source({ enrichItems: false });
    const out = await src.fetchListings(ctx());
    expect(sim.calls('users').map((r) => r.path).sort()).toEqual(['/users/777', '/users/999']);
    const a = out.find((l) => l.externalId === 'MLB1000000001')!;
    const b = out.find((l) => l.externalId === 'MLB1000000003')!;
    expect(a.seller).toEqual({ id: '999', name: 'LOJA_A', reputationLevel: 'green', powerSellerStatus: 'platinum', positiveRatio: 0.99, completedTransactions: 8000 });
    expect(b.seller).toEqual({ id: '777', name: 'LOJA_B', reputationLevel: 'yellow', positiveRatio: 0.9, completedTransactions: 30 });

    await src.fetchListings(ctx());
    expect(sim.calls('users')).toHaveLength(2); // segunda coleta: tudo do cache
  });

  it('reputação já embutida na busca dispensa /users', async () => {
    sim.addItem(CAT, 'MLB1000000001', { seller: { id: 999, nickname: 'LOJA_A', seller_reputation: { level_id: '4_light_green', transactions: { completed: 900 } } } });
    const [l] = await source({ enrichItems: false }).fetchListings(ctx());
    expect(sim.calls('users')).toHaveLength(0);
    expect(l!.seller).toMatchObject({ id: '999', reputationLevel: 'light_green', completedTransactions: 900 });
  });

  it('/users 403 (sem permissão) é opcional: coleta segue sem reputação, avisa e não insiste por um tempo', async () => {
    sim.addItem(CAT, 'MLB1000000001', { seller: { id: 999, nickname: 'LOJA_A' } });
    sim.addItem(CAT, 'MLB1000000002', { seller: { id: 888, nickname: 'LOJA_C' } });
    sim.sellers.set('999', 403);
    sim.sellers.set('888', mlUser(888));
    const src = source({ enrichItems: false });
    const out = await src.fetchListings(ctx());
    expect(out).toHaveLength(2);
    expect(out.every((l) => l.seller?.reputationLevel === undefined)).toBe(true);
    expect(out[0]!.seller).toMatchObject({ id: '999', name: 'LOJA_A' });
    expect(src.lastWarnings.join(' ')).toMatch(/reputação de vendedores indisponível/);
    expect(sim.calls('users')).toHaveLength(1);

    await src.fetchListings(ctx());
    expect(sim.calls('users')).toHaveLength(1); // bloqueio de 10 min: nenhuma nova consulta
  });

  it('/users 404 ou corpo inválido: o item continua, apenas sem reputação (nunca inventada)', async () => {
    sim.addItem(CAT, 'MLB1000000001', { seller: { id: 999, nickname: 'LOJA_A' } });
    sim.addItem(CAT, 'MLB1000000002', { seller: { id: 888, nickname: 'LOJA_C' } });
    // 999 inexistente (404); 888 devolve HTML
    sim.script('users', { status: 404, body: { message: 'User not found' } }, { status: 200, raw: '<html>erro</html>' });
    const src = source({ enrichItems: false, maxRetries: 0 });
    const out = await src.fetchListings(ctx());
    expect(out).toHaveLength(2);
    expect(out.every((l) => l.seller && l.seller.reputationLevel === undefined && l.seller.positiveRatio === undefined)).toBe(true);
  });
});

describe('sim: MercadoLivreApiSource — revalidação (fetchListing / fetchListingsByIds)', () => {
  it('fetchListing devolve o preço ATUAL do anúncio e a reputação do vendedor', async () => {
    sim.addItem(CAT, 'MLB1000000001', { price: 199.9, seller_id: 999 });
    sim.items.get('MLB1000000001')!.search = mlSearchItem('MLB1000000001', { price: 199.9, seller: undefined, seller_id: 999 });
    sim.sellers.set('999', mlUser(999));
    sim.setPrice('MLB1000000001', 149.9);
    const l = await source().fetchListing('MLB1000000001');
    expect(l).toMatchObject({ externalId: 'MLB1000000001', priceCents: 14990 });
    expect(sim.calls('items')[0]!.query.get('ids')).toBe('MLB1000000001');
  });

  it('anúncio inexistente (404), pausado ou fechado => null (indisponível)', async () => {
    sim.addItem(CAT, 'MLB1000000002', { status: 'paused' });
    sim.addItem(CAT, 'MLB1000000003', { status: 'closed' });
    sim.addItem(CAT, 'MLB1000000004', {}, { multigetCode: 403 });
    const src = source({ lookupSellers: false });
    expect(await src.fetchListing('MLB1000000001')).toBeNull(); // nunca existiu
    expect(await src.fetchListing('MLB1000000002')).toBeNull();
    expect(await src.fetchListing('MLB1000000003')).toBeNull();
    expect(await src.fetchListing('MLB1000000004')).toBeNull(); // sem acesso ao item: não afirma nada
  });

  it('item sem estoque continua sendo devolvido com availableQuantity 0 (quem decide é a política de publicação)', async () => {
    sim.addItem(CAT, 'MLB1000000001', { available_quantity: 0 });
    const l = await source({ lookupSellers: false }).fetchListing('MLB1000000001');
    expect(l?.availableQuantity).toBe(0);
  });

  it('fetchListingsByIds quebra em lotes de 20; resposta que não é lista => SourceInvalidResponseError; erro 5xx por item => SourceUnavailableError', async () => {
    const list = seedItems(45);
    const src = source({ lookupSellers: false }); // mesma instância: o refresh_token do simulador é de uso único
    const out = await src.fetchListingsByIds(list);
    expect(out).toHaveLength(45);
    expect(sim.calls('items')).toHaveLength(3);

    sim.script('items', { status: 200, body: { message: 'formato inesperado' } });
    await expect(src.fetchListingsByIds([list[0]!])).rejects.toBeInstanceOf(SourceInvalidResponseError);

    sim.items.get(list[1]!)!.multigetCode = 503;
    await expect(src.fetchListingsByIds([list[1]!])).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});

describe('sim: MercadoLivreApiSource — erros HTTP, limites, retentativas e timeout', () => {
  it('429 com Retry-After acima do tolerado => SourceRateLimitError (retryAfterMs) sem insistir', async () => {
    seedItems(1);
    sim.script('search', { status: 429, headers: { 'retry-after': '7' }, body: { message: 'too many requests' } });
    const err = await bare({ maxRetryAfterWaitMs: 100 }).fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRateLimitError);
    expect((err as SourceRateLimitError).retryAfterMs).toBe(7000);
    expect(sim.calls('search')).toHaveLength(1);
  });

  it('429 sem Retry-After => SourceRateLimitError sem retryAfterMs', async () => {
    seedItems(1);
    sim.script('search', { status: 429, body: {} });
    const err = await bare().fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRateLimitError);
    expect((err as SourceRateLimitError).retryAfterMs).toBeUndefined();
  });

  it('429 com Retry-After curto: espera o prazo informado e repete com sucesso', async () => {
    seedItems(2);
    sim.script('search', { status: 429, headers: { 'retry-after': '1' }, body: {} });
    const t0 = Date.now();
    const out = await bare({ maxRetryAfterWaitMs: 5000 }).fetchListings(ctx());
    expect(out).toHaveLength(2);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900);
    expect(sim.calls('search')).toHaveLength(2);
  });

  it('429 em /items durante a coleta é propagado (limite de taxa afeta todas as categorias)', async () => {
    seedItems(2);
    sim.script('items', { status: 429, headers: { 'retry-after': '60' }, body: {} });
    await expect(source({ lookupSellers: false, maxRetryAfterWaitMs: 10 }).fetchListings(ctx())).rejects.toBeInstanceOf(SourceRateLimitError);
  });

  it('5xx transitório: retenta com backoff exponencial e depois funciona', async () => {
    seedItems(2);
    sim.script('search', { status: 500, body: {} }, { status: 502, body: {} });
    const t0 = Date.now();
    const out = await bare({ retryBaseDelayMs: 40 }).fetchListings(ctx());
    expect(out).toHaveLength(2);
    expect(sim.calls('search')).toHaveLength(3);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110); // 40ms + 80ms de espera entre as tentativas
  });

  it('5xx persistente: esgota as retentativas e lança SourceUnavailableError (sem vazar o corpo do erro)', async () => {
    seedItems(1);
    const body = { message: 'Authorization: Bearer SEGREDO-NO-CORPO' };
    sim.script('search', { status: 503, body }, { status: 503, body }, { status: 503, body });
    const err = await bare().fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceUnavailableError);
    expect((err as SourceUnavailableError).status).toBe(503);
    expect((err as Error).message).not.toContain('SEGREDO-NO-CORPO');
    expect(sim.calls('search')).toHaveLength(3);
  });

  it('timeout: retenta e lança SourceTimeoutError (também um SourceUnavailableError)', async () => {
    seedItems(1);
    sim.script('search', { hang: true }, { hang: true });
    const err = await bare({ timeoutMs: 150, maxRetries: 1 }).fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceTimeoutError);
    expect(err).toBeInstanceOf(SourceUnavailableError);
    expect(sim.calls('search')).toHaveLength(2);
  });

  it('timeout seguido de recuperação: a retentativa funciona', async () => {
    seedItems(1);
    sim.script('search', { hang: true });
    const out = await bare({ timeoutMs: 150, maxRetries: 1 }).fetchListings(ctx());
    expect(out).toHaveLength(1);
  });

  it('servidor fora do ar (conexão recusada) => SourceUnavailableError', async () => {
    const port = await closedPort();
    const err = await bare({ baseUrl: `http://127.0.0.1:${port}`, maxRetries: 1 }).fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceUnavailableError);
    expect(err).not.toBeInstanceOf(SourceAuthError);
  });

  it('JSON inválido na busca (HTML 200) ou sem "results" => SourceInvalidResponseError', async () => {
    seedItems(1);
    const src = bare();
    sim.script('search', { status: 200, raw: '<html><body>manutenção</body></html>' });
    await expect(src.fetchListings(ctx())).rejects.toBeInstanceOf(SourceInvalidResponseError);
    sim.script('search', { status: 200, body: { paging: { total: 1 } } });
    await expect(src.fetchListings(ctx())).rejects.toBeInstanceOf(SourceInvalidResponseError);
    sim.script('search', { status: 200, body: 'null' });
    await expect(src.fetchListings(ctx())).rejects.toBeInstanceOf(SourceInvalidResponseError);
  });

  it('entradas malformadas dentro de "results" são ignoradas sem derrubar as boas', async () => {
    seedItems(1);
    sim.script('search', {
      status: 200,
      body: { paging: { total: 4 }, results: [null, 'x', { id: 'MLB9', title: 'sem preço', permalink: 'https://produto.mercadolivre.com.br/MLB-9' }, mlSearchItem('MLB1000000001')] },
    });
    const out = await bare().fetchListings(ctx());
    expect(out.map((l) => l.externalId)).toEqual(['MLB1000000001']);
  });

  it('demais 4xx (ex.: 404 na busca) => SourceRequestError com o status', async () => {
    seedItems(1);
    sim.script('search', { status: 404, body: { message: 'not found' } });
    const err = await bare().fetchListings(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRequestError);
    expect((err as SourceRequestError).status).toBe(404);
  });
});

describe('sim: MercadoLivreApiSource — healthCheck', () => {
  it('CONNECTED quando o token é válido e a busca responde', async () => {
    seedItems(1);
    expect(await source().healthCheck()).toMatchObject({ ok: true, status: 'CONNECTED' });
  });

  it('403 na busca (relato real de 2025) => AUTH_REQUIRED com a causa; 401 persistente também', async () => {
    const src = source(); // mesma instância: o refresh_token do simulador é de uso único
    sim.script('search', { status: 403, body: { message: 'forbidden' } });
    const r = await src.healthCheck();
    expect(r).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect(r.detail).toMatch(/403/);

    sim.script('search', { status: 401, body: {} }, { status: 401, body: {} });
    const r2 = await src.healthCheck();
    expect(r2).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect(r2.detail).toMatch(/401/);
  });

  it('refresh_token recusado => AUTH_REQUIRED; 5xx => ERROR (não é problema de autenticação)', async () => {
    expect(await source({ credentials: { ...ML_TEST_CREDS, refreshToken: 'RT-errado' } }).healthCheck()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect(sim.calls('search')).toHaveLength(0);
    sim.script('search', { status: 500, body: {} }, { status: 500, body: {} }, { status: 500, body: {} });
    const r = await source().healthCheck();
    expect(r).toMatchObject({ ok: false, status: 'ERROR' });
    expect(r.detail).toMatch(/indispon/i);
  });
});
