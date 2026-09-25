'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { openDatabase } = require('../lib/db');
const { createApp } = require('../server');
const { seedDemo } = require('../lib/seed');

const config = {
  appName: 'PedeZap',
  baseUrl: '',
  priceCents: 4990,
  trialDays: 7,
  goalCents: 10_000_000,
  adminEmails: ['dono@pedezap.test'],
  supportWhatsapp: '5581999990000',
  billingPix: { key: '+5581999990000', name: 'Dono do SaaS', city: 'Recife' },
  trustProxy: true,
  seedDemo: true,
};

let server;
let base;
let db;

test.before(async () => {
  db = openDatabase(':memory:');
  await seedDemo(db, config);
  server = http.createServer(createApp({ db, config }));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

let nextIp = 1;

// Cada cliente simula um IP diferente (atrás de proxy) para não esbarrar no rate limit.
function client() {
  let cookie = '';
  const ip = `10.0.0.${nextIp++}`;
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': `203.0.113.9, ${ip}`,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : await res.text() };
  };
}

async function signup(call, email, storeName) {
  const res = await call('POST', '/api/cadastro', {
    name: 'Maria',
    email,
    password: 'senha-forte-123',
    store_name: storeName,
    whatsapp: '(81) 98888-7777',
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

const storeSettings = (overrides = {}) => ({
  name: 'Lanches da Maria',
  slug: 'lanches-da-maria',
  description: 'Os melhores lanches',
  whatsapp: '81988887777',
  color: '#ff6600',
  address: '',
  hours: '',
  is_open: true,
  accepts_delivery: true,
  accepts_pickup: true,
  delivery_fee_cents: 500,
  min_order_cents: 1000,
  accepts_cash: true,
  accepts_card: true,
  pix_key_type: 'telefone',
  pix_key: '(81) 98888-7777',
  pix_name: 'Maria Açaí',
  pix_city: 'Recife',
  logo_image_id: null,
  ...overrides,
});

test('fluxo completo: cadastro, cardápio, pedido pelo WhatsApp com PIX', async () => {
  const owner = client();
  await signup(owner, 'maria@teste.com', 'Lanches da Maria');

  const me = await owner('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.store.slug, 'lanches-da-maria');
  assert.equal(me.data.subscription.active, true);
  assert.equal(me.data.subscription.trial, true);
  assert.equal(me.data.subscription.days_left, 7);

  const saved = await owner('PUT', '/api/loja', storeSettings());
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.store.pix_key, '+5581988887777');

  const burger = await owner('POST', '/api/produtos', { name: 'X-Burguer', category: 'Lanches', price_cents: 2500 });
  assert.equal(burger.status, 201);
  const soda = await owner('POST', '/api/produtos', { name: 'Refri', category: 'Bebidas', price_cents: 600 });
  const soldOut = await owner('POST', '/api/produtos', { name: 'Esgotado', price_cents: 100, available: false });

  const pub = await client()('GET', '/api/lojas/lanches-da-maria');
  assert.equal(pub.data.active, true);
  assert.equal(pub.data.products.length, 3);
  assert.deepEqual(pub.data.store.payment_methods, ['pix', 'dinheiro', 'cartao']);
  assert.equal(pub.data.store.whatsapp, undefined, 'número do lojista não vaza na API pública');

  const customer = client();
  const order = await customer('POST', '/api/lojas/lanches-da-maria/pedidos', {
    customer_name: 'João',
    customer_phone: '81 97777-6666',
    fulfillment: 'entrega',
    address: 'Rua A, 10',
    payment_method: 'pix',
    // price_cents enviado pelo navegador deve ser ignorado
    items: [
      { product_id: burger.data.product.id, qty: 2, note: 'sem cebola', price_cents: 1 },
      { product_id: soda.data.product.id, qty: 1 },
    ],
  });
  assert.equal(order.status, 201, JSON.stringify(order.data));
  assert.equal(order.data.number, 1);
  assert.equal(order.data.total_cents, 2500 * 2 + 600 + 500);
  assert.ok(order.data.whatsapp_url.startsWith('https://wa.me/5581988887777?text='));
  const message = decodeURIComponent(order.data.whatsapp_url.split('text=')[1]);
  assert.match(message, /\*Pedido #1\* - Lanches da Maria/);
  assert.match(message, /2x X-Burguer - R\$ 50,00/);
  assert.match(message, /_Obs: sem cebola_/);
  assert.match(message, /\*Total: R\$ 61,00\*/);
  assert.match(message, /\*Entregar em:\* Rua A, 10/);
  assert.ok(order.data.pix.payload.includes('540561.00'), 'PIX com valor exato do pedido');
  assert.ok(order.data.pix.payload.includes('0507PEDIDO1'));
  assert.ok(order.data.pix.qr.startsWith('data:image/svg+xml;base64,'));

  const sold = await customer('POST', '/api/lojas/lanches-da-maria/pedidos', {
    customer_name: 'João',
    fulfillment: 'retirada',
    payment_method: 'dinheiro',
    items: [{ product_id: soldOut.data.product.id, qty: 20 }],
  });
  assert.equal(sold.status, 400);
  assert.match(sold.data.error, /esgotado/);

  const small = await customer('POST', '/api/lojas/lanches-da-maria/pedidos', {
    customer_name: 'João',
    fulfillment: 'retirada',
    payment_method: 'dinheiro',
    items: [{ product_id: soda.data.product.id, qty: 1 }],
  });
  assert.equal(small.status, 400);
  assert.match(small.data.error, /pedido mínimo/);

  const second = await customer('POST', '/api/lojas/lanches-da-maria/pedidos', {
    customer_name: 'Ana',
    fulfillment: 'retirada',
    payment_method: 'dinheiro',
    change_for_cents: 5000,
    items: [{ product_id: burger.data.product.id, qty: 1 }],
  });
  assert.equal(second.status, 201);
  assert.equal(second.data.number, 2);
  assert.equal(second.data.total_cents, 2500, 'retirada não cobra taxa de entrega');
  assert.equal(second.data.pix, null);

  const list = await owner('GET', '/api/pedidos');
  assert.equal(list.data.orders.length, 2);
  assert.equal(list.data.orders[0].number, 2);
  assert.equal(list.data.orders[1].customer_whatsapp, '5581977776666');

  const updated = await owner('PUT', `/api/pedidos/${list.data.orders[0].id}`, { status: 'preparando' });
  assert.equal(updated.data.order.status, 'preparando');

  await owner('POST', '/api/loja/aberta', { is_open: false });
  const closed = await customer('POST', '/api/lojas/lanches-da-maria/pedidos', {
    customer_name: 'Ana',
    fulfillment: 'retirada',
    payment_method: 'dinheiro',
    items: [{ product_id: burger.data.product.id, qty: 1 }],
  });
  assert.equal(closed.status, 400);
  assert.match(closed.data.error, /fechada/);
});

test('uma loja não mexe nos produtos de outra', async () => {
  const a = client();
  const b = client();
  await signup(a, 'a@teste.com', 'Loja A');
  await signup(b, 'b@teste.com', 'Loja B');
  const product = await a('POST', '/api/produtos', { name: 'Pastel', price_cents: 800 });
  const edit = await b('PUT', `/api/produtos/${product.data.product.id}`, { name: 'Hack', price_cents: 1 });
  assert.equal(edit.status, 404);
  const del = await b('DELETE', `/api/produtos/${product.data.product.id}`);
  assert.equal(del.status, 404);
  const steal = await b('POST', '/api/produtos', { name: 'X', price_cents: 1, image_id: 999 });
  assert.equal(steal.status, 400);
});

test('assinatura vencida tira a loja do ar até o admin confirmar o pagamento', async () => {
  const owner = client();
  await signup(owner, 'vencida@teste.com', 'Pizzaria Vencida');
  const { store } = (await owner('GET', '/api/me')).data;
  db.prepare('UPDATE stores SET plan_expires_at = ? WHERE id = ?').run(Date.now() - 1000, store.id);

  const pub = await client()('GET', `/api/lojas/${store.slug}`);
  assert.equal(pub.data.active, false);
  assert.equal(pub.data.products, undefined);

  const billing = await owner('GET', '/api/assinatura/pix');
  assert.equal(billing.data.enabled, true);
  assert.ok(billing.data.payload.includes('540549.90'));

  const notAdmin = await owner('POST', `/api/admin/lojas/${store.id}/pagamento`, {});
  assert.equal(notAdmin.status, 403);

  const admin = client();
  await signup(admin, 'dono@pedezap.test', 'Loja do Dono');
  const before = (await admin('GET', '/api/admin/resumo')).data;
  const paid = await admin('POST', `/api/admin/lojas/${store.id}/pagamento`, {});
  assert.equal(paid.status, 200);
  assert.ok(paid.data.plan_expires_at > Date.now() + 29 * 86400000);

  const after = (await admin('GET', '/api/admin/resumo')).data;
  assert.equal(after.paying_active, before.paying_active + 1);
  assert.equal(after.mrr_cents, before.mrr_cents + 4990);
  assert.equal((await client()('GET', `/api/lojas/${store.slug}`)).data.active, true);

  const reset = await admin('POST', `/api/admin/lojas/${store.id}/senha`, {});
  assert.equal(reset.status, 200);
  assert.equal((await owner('GET', '/api/me')).status, 401, 'sessões antigas caem ao trocar a senha');
  const relogin = await client()('POST', '/api/entrar', { email: 'vencida@teste.com', password: reset.data.password });
  assert.equal(relogin.status, 200);
});

test('proteções: CSRF, JSON obrigatório, login errado, e-mail duplicado', async () => {
  const owner = client();
  await signup(owner, 'seg@teste.com', 'Loja Segura');

  const crossSite = await owner('POST', '/api/produtos', { name: 'X', price_cents: 1 }, { Origin: 'https://site-malicioso.com' });
  assert.equal(crossSite.status, 403);

  const form = await fetch(base + '/api/entrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=a&password=b',
  });
  assert.equal(form.status, 415);

  const wrong = await client()('POST', '/api/entrar', { email: 'seg@teste.com', password: 'errada-123' });
  assert.equal(wrong.status, 401);

  const dup = await client()('POST', '/api/cadastro', {
    name: 'Outro',
    email: 'SEG@teste.com',
    password: 'senha-forte-123',
    store_name: 'Outra',
    whatsapp: '81988887777',
  });
  assert.equal(dup.status, 409);

  const taken = await owner('PUT', '/api/loja', storeSettings({ slug: 'lanches-da-maria' }));
  assert.equal(taken.status, 409);
  const reserved = await owner('PUT', '/api/loja', storeSettings({ slug: 'admin' }));
  assert.equal(reserved.status, 400);
});

test('páginas: loja pública com prévia para o WhatsApp e demo semeada', async () => {
  const page = await client()('GET', '/loja/demo');
  assert.equal(page.status, 200);
  assert.match(page.data, /<title>Lanchonete Demonstração/);
  assert.match(page.data, /og:title/);

  const demo = await client()('GET', '/api/lojas/demo');
  assert.equal(demo.data.active, true);
  assert.ok(demo.data.products.length >= 5);
  assert.ok(demo.data.store.payment_methods.includes('pix'));

  const missing = await client()('GET', '/loja/nao-existe');
  assert.equal(missing.status, 404);

  const qr = await fetch(base + '/qr/demo.svg');
  assert.equal(qr.headers.get('content-type'), 'image/svg+xml');

  const traversal = await fetch(base + '/static/..%2f..%2fserver.js');
  assert.equal(traversal.status, 404);
});

test('rate limit segura cadastro em massa do mesmo IP', async () => {
  const bot = client();
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const res = await bot('POST', '/api/cadastro', { name: 'Bot', email: `bot${i}@spam.com`, password: '12345678', store_name: `Spam ${i}`, whatsapp: '81988887777' });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});
