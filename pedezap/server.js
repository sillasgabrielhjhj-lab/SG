'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { openDatabase, transaction } = require('./lib/db');
const auth = require('./lib/auth');
const pix = require('./lib/pix');
const { qrDataUri, qrSvg } = require('./lib/qr');
const orders = require('./lib/orders');
const { seedDemo } = require('./lib/seed');
const u = require('./lib/util');

const { HttpError, bad } = u;

const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_DIR = path.join(PUBLIC_DIR, 'static');
const MAX_BODY = 2 * 1024 * 1024;
const MAX_IMAGE = 700 * 1024;
const MAX_PRODUCTS = 500;
const MAX_IMAGES = 2000;
const DAY = 86400000;

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  check(key) {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      throw new HttpError(429, 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
    }
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.hits) if (entry.reset <= now) this.hits.delete(key);
  }
}

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, data) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.startsWith('application/json')) {
      req.resume();
      reject(new HttpError(415, 'Envie os dados como JSON.'));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Arquivo grande demais.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const data = raw ? JSON.parse(raw) : {};
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
        resolve(data);
      } catch {
        reject(bad('Dados inválidos.'));
      }
    });
    req.on('error', reject);
  });
}

function compileRoute(pattern) {
  const keys = [];
  const source = pattern
    .replace(/[.]/g, '\\.')
    .replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+?)';
    });
  return { re: new RegExp(`^${source}/?$`), keys };
}

function isImage(buf, mime) {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf.subarray(0, 4).toString('hex') === '89504e47';
  if (mime === 'image/webp') return buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return false;
}

function createApp({ db, config }) {
  const limits = {
    login: new RateLimiter(10, 10 * 60000),
    signup: new RateLimiter(5, 60 * 60000),
    order: new RateLimiter(20, 10 * 60000),
    upload: new RateLimiter(150, 60 * 60000),
  };
  const sweeper = setInterval(() => {
    for (const limiter of Object.values(limits)) limiter.sweep();
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  }, 10 * 60000);
  sweeper.unref();

  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, handler, ...compileRoute(pattern) });

  // ---------------------------------------------------------------- helpers

  const pageCache = new Map();
  function renderPage(file, vars) {
    let tpl = pageCache.get(file);
    if (!tpl) {
      tpl = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
      pageCache.set(file, tpl);
    }
    const all = {
      APP_NAME: config.appName,
      PRICE: u.money(config.priceCents),
      PRICE_CENTS: String(config.priceCents),
      TRIAL_DAYS: String(config.trialDays),
      YEAR: String(new Date().getFullYear()),
      SUPPORT_URL: config.supportWhatsapp
        ? orders.whatsappUrl(config.supportWhatsapp, `Olá! Quero saber mais sobre o ${config.appName}.`)
        : '/cadastro',
      ...vars,
    };
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in all)) return '';
      return key.startsWith('RAW_') ? all[key] : u.escapeHtml(all[key]);
    });
  }

  function sendPage(ctx, file, vars = {}, status = 200) {
    send(ctx.res, status, renderPage(file, vars), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
  }

  function origin(ctx) {
    if (config.baseUrl) return config.baseUrl;
    return `${ctx.secure ? 'https' : 'http'}://${ctx.req.headers.host || 'localhost'}`;
  }

  const storeUrl = (ctx, slug) => `${origin(ctx)}/loja/${slug}`;
  const imageUrl = (id) => (id ? `/img/${id}` : null);
  const isActive = (store) => store.plan_expires_at > Date.now();

  function currentUser(ctx) {
    if (ctx.user === undefined) ctx.user = auth.sessionUser(db, ctx.cookies[auth.COOKIE]);
    return ctx.user;
  }

  function isAdmin(user) {
    return Boolean(user && config.adminEmails.includes(user.email));
  }

  function requireOwner(ctx) {
    const user = currentUser(ctx);
    if (!user) throw new HttpError(401, 'Faça login para continuar.');
    const store = db.prepare('SELECT * FROM stores WHERE user_id = ?').get(user.id);
    if (!store) throw new HttpError(404, 'Loja não encontrada.');
    return { user, store };
  }

  function requireAdmin(ctx) {
    const user = currentUser(ctx);
    if (!user) throw new HttpError(401, 'Faça login para continuar.');
    if (!isAdmin(user)) throw new HttpError(403, 'Acesso restrito.');
    return user;
  }

  function subscription(store) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM payments WHERE store_id = ?').get(store.id);
    const msLeft = store.plan_expires_at - Date.now();
    return {
      active: msLeft > 0,
      expires_at: store.plan_expires_at,
      days_left: Math.max(0, Math.ceil(msLeft / DAY)),
      trial: n === 0,
      price_cents: config.priceCents,
    };
  }

  function ownerStore(ctx, store) {
    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      description: store.description,
      whatsapp: u.formatPhone(store.whatsapp),
      color: store.color,
      logo_image_id: store.logo_image_id,
      logo_url: imageUrl(store.logo_image_id),
      address: store.address,
      hours: store.hours,
      is_open: Boolean(store.is_open),
      accepts_delivery: Boolean(store.accepts_delivery),
      accepts_pickup: Boolean(store.accepts_pickup),
      delivery_fee_cents: store.delivery_fee_cents,
      min_order_cents: store.min_order_cents,
      accepts_cash: Boolean(store.accepts_cash),
      accepts_card: Boolean(store.accepts_card),
      pix_key_type: store.pix_key_type,
      pix_key: store.pix_key,
      pix_name: store.pix_name,
      pix_city: store.pix_city,
      public_url: storeUrl(ctx, store.slug),
    };
  }

  function publicStore(store) {
    return {
      slug: store.slug,
      name: store.name,
      description: store.description,
      color: store.color,
      logo_url: imageUrl(store.logo_image_id),
      address: store.address,
      hours: store.hours,
      is_open: Boolean(store.is_open),
      delivery_fee_cents: store.delivery_fee_cents,
      min_order_cents: store.min_order_cents,
      fulfillments: orders.fulfillments(store),
      payment_methods: orders.paymentMethods(store),
    };
  }

  function publicProduct(p) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price_cents: p.price_cents,
      image_url: imageUrl(p.image_id),
      available: Boolean(p.available),
    };
  }

  function ownedImageId(store, value) {
    if (value === null || value === undefined || value === '') return null;
    const id = Number(value);
    const row = Number.isInteger(id) && db.prepare('SELECT id FROM images WHERE id = ? AND store_id = ?').get(id, store.id);
    if (!row) throw bad('Imagem inválida. Envie a foto de novo.');
    return id;
  }

  function deleteImageIfUnused(storeId, imageId) {
    if (!imageId) return;
    const used =
      db.prepare('SELECT 1 FROM products WHERE image_id = ? LIMIT 1').get(imageId) ||
      db.prepare('SELECT 1 FROM stores WHERE logo_image_id = ? LIMIT 1').get(imageId);
    if (!used) db.prepare('DELETE FROM images WHERE id = ? AND store_id = ?').run(imageId, storeId);
  }

  function storePix(store, amountCents, txid) {
    const payload = pix.buildPixPayload({
      key: store.pix_key,
      name: store.pix_name || store.name,
      city: store.pix_city,
      amountCents,
      txid,
    });
    return { payload, qr: qrDataUri(payload) };
  }

  function login(ctx, userId) {
    const session = auth.createSession(db, userId);
    ctx.res.setHeader('Set-Cookie', auth.sessionCookie(session.token, session.expiresAt, ctx.secure));
  }

  function freeSlug(base, exceptStoreId = 0) {
    const taken = (slug) => db.prepare('SELECT 1 FROM stores WHERE slug = ? AND id != ?').get(slug, exceptStoreId);
    if (!taken(base)) return base;
    for (let i = 2; i < 100; i++) {
      const candidate = `${base.slice(0, 36)}-${i}`;
      if (!taken(candidate)) return candidate;
    }
    return `${base.slice(0, 30)}-${Date.now().toString(36)}`;
  }

  // ------------------------------------------------------------------ pages

  route('GET', '/', (ctx) => sendPage(ctx, 'index.html'));
  route('GET', '/entrar', (ctx) => sendPage(ctx, 'auth.html', { MODE: 'entrar', TITLE: 'Entrar' }));
  route('GET', '/cadastro', (ctx) => sendPage(ctx, 'auth.html', { MODE: 'cadastro', TITLE: 'Criar conta grátis' }));
  route('GET', '/painel', (ctx) => sendPage(ctx, 'painel.html'));
  route('GET', '/admin', (ctx) => sendPage(ctx, 'admin.html'));
  route('GET', '/healthz', (ctx) => send(ctx.res, 200, 'ok', { 'Content-Type': 'text/plain' }));

  route('GET', '/loja/:slug', (ctx) => {
    const store = db.prepare('SELECT * FROM stores WHERE slug = ?').get(ctx.params.slug);
    if (!store) throw new HttpError(404, 'Essa loja não existe. Confira o link.');
    const logo = store.logo_image_id ? `${origin(ctx)}${imageUrl(store.logo_image_id)}` : '';
    sendPage(ctx, 'loja.html', {
      STORE_NAME: store.name,
      STORE_DESCRIPTION: store.description || `Faça seu pedido online no ${store.name}.`,
      STORE_URL: storeUrl(ctx, store.slug),
      STORE_COLOR: store.color,
      RAW_OG_IMAGE: logo ? `<meta property="og:image" content="${u.escapeHtml(logo)}">` : '',
    });
  });

  route('GET', '/img/:id', (ctx) => {
    const row = db.prepare('SELECT mime, data FROM images WHERE id = ?').get(Number(ctx.params.id));
    if (!row) throw new HttpError(404, 'Imagem não encontrada.');
    send(ctx.res, 200, Buffer.from(row.data), {
      'Content-Type': row.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });

  route('GET', '/qr/:slug.svg', (ctx) => {
    const store = db.prepare('SELECT slug FROM stores WHERE slug = ?').get(ctx.params.slug);
    if (!store) throw new HttpError(404, 'Loja não encontrada.');
    send(ctx.res, 200, qrSvg(storeUrl(ctx, store.slug)), {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    });
  });

  // ------------------------------------------------------------------- auth

  route('POST', '/api/cadastro', async (ctx) => {
    limits.signup.check(ctx.ip);
    const b = ctx.body;
    const name = u.text(b.name, { max: 80, label: 'seu nome', required: true });
    const email = u.validateEmail(b.email);
    const password = String(b.password || '');
    if (password.length < 8) throw bad('A senha precisa ter pelo menos 8 caracteres.');
    if (password.length > 200) throw bad('Senha longa demais.');
    const storeName = u.text(b.store_name, { max: 60, label: 'o nome da loja', required: true });
    const whatsapp = u.normalizeWhatsapp(b.whatsapp);

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, 'Já existe uma conta com esse e-mail. Entre na sua conta.');
    }

    let base = u.slugify(storeName);
    if (base.length < 3) base = `loja-${base}`.replace(/-$/, '');
    try {
      u.validateSlug(base);
    } catch {
      base = `${base}-loja`;
    }

    const passwordHash = await auth.hashPassword(password);
    const now = Date.now();
    const userId = transaction(db, () => {
      const user = db
        .prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(email, name, passwordHash, now);
      db.prepare(
        `INSERT INTO stores (user_id, slug, name, whatsapp, pix_name, plan_expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(user.lastInsertRowid, freeSlug(base), storeName, whatsapp, storeName, now + config.trialDays * DAY, now);
      return user.lastInsertRowid;
    });
    login(ctx, userId);
    return { ok: true };
  });

  route('POST', '/api/entrar', async (ctx) => {
    limits.login.check(ctx.ip);
    const email = String(ctx.body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    const ok = user && (await auth.verifyPassword(String(ctx.body.password || ''), user.password_hash));
    if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');
    login(ctx, user.id);
    return { ok: true, admin: isAdmin({ email }) };
  });

  route('POST', '/api/sair', (ctx) => {
    auth.destroySession(db, ctx.cookies[auth.COOKIE]);
    ctx.res.setHeader('Set-Cookie', auth.sessionCookie('', 0, ctx.secure));
    return { ok: true };
  });

  route('GET', '/api/me', (ctx) => {
    const user = currentUser(ctx);
    if (!user) throw new HttpError(401, 'Faça login para continuar.');
    const store = db.prepare('SELECT * FROM stores WHERE user_id = ?').get(user.id);
    return {
      user: { name: user.name, email: user.email, admin: isAdmin(user) },
      store: store ? ownerStore(ctx, store) : null,
      subscription: store ? subscription(store) : null,
      app: {
        name: config.appName,
        price_cents: config.priceCents,
        billing_pix: Boolean(config.billingPix.key),
        support_whatsapp: config.supportWhatsapp || null,
      },
    };
  });

  // ------------------------------------------------------------ owner: loja

  route('PUT', '/api/loja', (ctx) => {
    const { store } = requireOwner(ctx);
    const b = ctx.body;
    const slug = u.validateSlug(b.slug);
    if (db.prepare('SELECT 1 FROM stores WHERE slug = ? AND id != ?').get(slug, store.id)) {
      throw new HttpError(409, 'Esse endereço já está em uso por outra loja.');
    }

    const acceptsDelivery = u.flag(b.accepts_delivery);
    const acceptsPickup = u.flag(b.accepts_pickup);
    if (!acceptsDelivery && !acceptsPickup) throw bad('Ative entrega, retirada ou as duas.');

    const pixType = String(b.pix_key_type || '');
    const pixKey = String(b.pix_key || '').trim() ? pix.normalizePixKey(pixType, b.pix_key) : '';
    const acceptsCash = u.flag(b.accepts_cash);
    const acceptsCard = u.flag(b.accepts_card);
    if (!pixKey && !acceptsCash && !acceptsCard) throw bad('Ative pelo menos uma forma de pagamento.');

    const logoId = ownedImageId(store, b.logo_image_id);
    const values = {
      slug,
      name: u.text(b.name, { max: 60, label: 'o nome da loja', required: true }),
      description: u.text(b.description, { max: 300, label: 'a descrição' }),
      whatsapp: u.normalizeWhatsapp(b.whatsapp),
      color: u.validateColor(b.color),
      logo_image_id: logoId,
      address: u.text(b.address, { max: 200, label: 'o endereço' }),
      hours: u.text(b.hours, { max: 120, label: 'o horário' }),
      is_open: u.flag(b.is_open),
      accepts_delivery: acceptsDelivery,
      accepts_pickup: acceptsPickup,
      delivery_fee_cents: u.cents(b.delivery_fee_cents, { label: 'taxa de entrega', max: 100000 }),
      min_order_cents: u.cents(b.min_order_cents, { label: 'pedido mínimo', max: 100000 }),
      accepts_cash: acceptsCash,
      accepts_card: acceptsCard,
      pix_key_type: pixKey ? pixType : '',
      pix_key: pixKey,
      pix_name: u.text(b.pix_name, { max: 60, label: 'o nome do recebedor PIX' }),
      pix_city: u.text(b.pix_city, { max: 40, label: 'a cidade do PIX' }),
    };
    const columns = Object.keys(values);
    db.prepare(`UPDATE stores SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...columns.map((c) => values[c]),
      store.id
    );
    if (store.logo_image_id !== logoId) deleteImageIfUnused(store.id, store.logo_image_id);
    const updated = db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id);
    return { store: ownerStore(ctx, updated) };
  });

  // Abrir/fechar a loja com um toque, sem reenviar o formulário inteiro.
  route('POST', '/api/loja/aberta', (ctx) => {
    const { store } = requireOwner(ctx);
    db.prepare('UPDATE stores SET is_open = ? WHERE id = ?').run(u.flag(ctx.body.is_open), store.id);
    return { is_open: Boolean(ctx.body.is_open) };
  });

  // -------------------------------------------------------- owner: produtos

  function productInput(store, b) {
    return {
      name: u.text(b.name, { max: 80, label: 'o nome do produto', required: true }),
      description: u.text(b.description, { max: 300, label: 'a descrição' }),
      category: u.text(b.category, { max: 40, label: 'a categoria' }) || 'Cardápio',
      price_cents: u.cents(b.price_cents, { label: 'o preço', max: 10_000_000 }),
      image_id: ownedImageId(store, b.image_id),
      available: b.available === undefined ? 1 : u.flag(b.available),
    };
  }

  const listProducts = (storeId) =>
    db.prepare('SELECT * FROM products WHERE store_id = ? ORDER BY position, id').all(storeId).map(ownerProduct);

  function ownerProduct(p) {
    return { ...publicProduct(p), image_id: p.image_id };
  }

  route('GET', '/api/produtos', (ctx) => {
    const { store } = requireOwner(ctx);
    return { products: listProducts(store.id) };
  });

  route('POST', '/api/produtos', (ctx) => {
    const { store } = requireOwner(ctx);
    const { n, maxPos } = db
      .prepare('SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS maxPos FROM products WHERE store_id = ?')
      .get(store.id);
    if (n >= MAX_PRODUCTS) throw bad(`Limite de ${MAX_PRODUCTS} produtos atingido.`);
    const p = productInput(store, ctx.body);
    const result = db
      .prepare(
        `INSERT INTO products (store_id, name, description, category, price_cents, image_id, available, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(store.id, p.name, p.description, p.category, p.price_cents, p.image_id, p.available, maxPos + 1, Date.now());
    ctx.res.statusCode = 201;
    return { product: ownerProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid)) };
  });

  function ownedProduct(store, id) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND store_id = ?').get(Number(id), store.id);
    if (!product) throw new HttpError(404, 'Produto não encontrado.');
    return product;
  }

  route('PUT', '/api/produtos/:id', (ctx) => {
    const { store } = requireOwner(ctx);
    const current = ownedProduct(store, ctx.params.id);
    const p = productInput(store, ctx.body);
    db.prepare(
      `UPDATE products SET name = ?, description = ?, category = ?, price_cents = ?, image_id = ?, available = ?
       WHERE id = ?`
    ).run(p.name, p.description, p.category, p.price_cents, p.image_id, p.available, current.id);
    if (current.image_id !== p.image_id) deleteImageIfUnused(store.id, current.image_id);
    return { product: ownerProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(current.id)) };
  });

  route('DELETE', '/api/produtos/:id', (ctx) => {
    const { store } = requireOwner(ctx);
    const current = ownedProduct(store, ctx.params.id);
    db.prepare('DELETE FROM products WHERE id = ?').run(current.id);
    deleteImageIfUnused(store.id, current.image_id);
    return { ok: true };
  });

  route('POST', '/api/produtos/ordem', (ctx) => {
    const { store } = requireOwner(ctx);
    const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids.map(Number) : [];
    const update = db.prepare('UPDATE products SET position = ? WHERE id = ? AND store_id = ?');
    transaction(db, () => ids.forEach((id, i) => update.run(i, id, store.id)));
    return { products: listProducts(store.id) };
  });

  route('POST', '/api/imagens', (ctx) => {
    const { store } = requireOwner(ctx);
    limits.upload.check(`store:${store.id}`);
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(ctx.body.data_url || ''));
    if (!match) throw bad('Imagem inválida. Use uma foto JPG, PNG ou WEBP.');
    const data = Buffer.from(match[2], 'base64');
    if (data.length > MAX_IMAGE) throw bad('Foto grande demais. Tente outra imagem.');
    if (!isImage(data, match[1])) throw bad('Esse arquivo não parece ser uma imagem.');
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM images WHERE store_id = ?').get(store.id);
    if (n >= MAX_IMAGES) throw bad('Limite de imagens atingido.');
    const result = db
      .prepare('INSERT INTO images (store_id, mime, data, created_at) VALUES (?, ?, ?, ?)')
      .run(store.id, match[1], data, Date.now());
    ctx.res.statusCode = 201;
    return { id: result.lastInsertRowid, url: imageUrl(result.lastInsertRowid) };
  });

  // --------------------------------------------------------- owner: pedidos

  function ownerOrder(row) {
    let customerWhatsapp = null;
    try {
      customerWhatsapp = row.customer_phone ? u.normalizeWhatsapp(row.customer_phone) : null;
    } catch {
      customerWhatsapp = null;
    }
    return {
      id: row.id,
      number: row.number,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      customer_whatsapp: customerWhatsapp,
      fulfillment: row.fulfillment,
      address: row.address,
      payment_method: row.payment_method,
      change_for_cents: row.change_for_cents,
      notes: row.notes,
      items: JSON.parse(row.items_json),
      subtotal_cents: row.subtotal_cents,
      delivery_fee_cents: row.delivery_fee_cents,
      total_cents: row.total_cents,
      status: row.status,
      created_at: row.created_at,
    };
  }

  route('GET', '/api/pedidos', (ctx) => {
    const { store } = requireOwner(ctx);
    const limit = Math.min(Math.max(Number(ctx.query.get('limit')) || 100, 1), 500);
    const afterId = Number(ctx.query.get('after_id')) || 0;
    const rows = db
      .prepare('SELECT * FROM orders WHERE store_id = ? AND id > ? ORDER BY id DESC LIMIT ?')
      .all(store.id, afterId, limit);
    return { orders: rows.map(ownerOrder) };
  });

  route('PUT', '/api/pedidos/:id', (ctx) => {
    const { store } = requireOwner(ctx);
    const status = String(ctx.body.status || '');
    if (!orders.ORDER_STATUSES.includes(status)) throw bad('Status inválido.');
    const result = db
      .prepare('UPDATE orders SET status = ? WHERE id = ? AND store_id = ?')
      .run(status, Number(ctx.params.id), store.id);
    if (!result.changes) throw new HttpError(404, 'Pedido não encontrado.');
    return { order: ownerOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(ctx.params.id))) };
  });

  // ------------------------------------------------------ owner: assinatura

  route('GET', '/api/assinatura/pix', (ctx) => {
    const { store } = requireOwner(ctx);
    const support = config.supportWhatsapp
      ? orders.whatsappUrl(
          config.supportWhatsapp,
          `Olá! Paguei a assinatura do ${config.appName} da loja "${store.name}" (${storeUrl(ctx, store.slug)}). Segue o comprovante:`
        )
      : null;
    if (!config.billingPix.key) return { enabled: false, support_url: support };
    const payload = pix.buildPixPayload({
      key: config.billingPix.key,
      name: config.billingPix.name,
      city: config.billingPix.city,
      amountCents: config.priceCents,
      txid: `PZ${store.id}`,
    });
    return { enabled: true, amount_cents: config.priceCents, payload, qr: qrDataUri(payload), support_url: support };
  });

  // --------------------------------------------------------- loja pública

  route('GET', '/api/lojas/:slug', (ctx) => {
    const store = db.prepare('SELECT * FROM stores WHERE slug = ?').get(ctx.params.slug);
    if (!store) throw new HttpError(404, 'Essa loja não existe. Confira o link.');
    const app = { name: config.appName, url: `${origin(ctx)}/?ref=${encodeURIComponent(store.slug)}` };
    if (!isActive(store)) return { active: false, store: { name: store.name }, app };
    const products = db
      .prepare('SELECT * FROM products WHERE store_id = ? ORDER BY position, id')
      .all(store.id)
      .map(publicProduct);
    return { active: true, store: publicStore(store), products, app };
  });

  route('POST', '/api/lojas/:slug/pedidos', (ctx) => {
    limits.order.check(ctx.ip);
    const store = db.prepare('SELECT * FROM stores WHERE slug = ?').get(ctx.params.slug);
    if (!store) throw new HttpError(404, 'Essa loja não existe.');
    if (!isActive(store)) throw new HttpError(403, 'Essa loja não está recebendo pedidos no momento.');

    const productsById = new Map(
      db.prepare('SELECT * FROM products WHERE store_id = ?').all(store.id).map((p) => [p.id, p])
    );
    const draft = orders.buildOrder(store, productsById, ctx.body);

    const order = transaction(db, () => {
      const { next_order_number: number } = db
        .prepare('SELECT next_order_number FROM stores WHERE id = ?')
        .get(store.id);
      db.prepare('UPDATE stores SET next_order_number = ? WHERE id = ?').run(number + 1, store.id);
      db.prepare(
        `INSERT INTO orders (store_id, number, customer_name, customer_phone, fulfillment, address, payment_method,
           change_for_cents, notes, items_json, subtotal_cents, delivery_fee_cents, total_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        store.id,
        number,
        draft.customer_name,
        draft.customer_phone,
        draft.fulfillment,
        draft.address,
        draft.payment_method,
        draft.change_for_cents,
        draft.notes,
        JSON.stringify(draft.items),
        draft.subtotal_cents,
        draft.delivery_fee_cents,
        draft.total_cents,
        Date.now()
      );
      return { ...draft, number };
    });

    const message = orders.whatsappMessage(store, order, config.appName);
    ctx.res.statusCode = 201;
    return {
      number: order.number,
      total_cents: order.total_cents,
      whatsapp_url: orders.whatsappUrl(store.whatsapp, message),
      pix: order.payment_method === 'pix' ? storePix(store, order.total_cents, `PEDIDO${order.number}`) : null,
    };
  });

  // ----------------------------------------------------------------- admin

  route('GET', '/api/admin/resumo', (ctx) => {
    requireAdmin(ctx);
    const now = Date.now();
    const count = (sql, ...args) => db.prepare(sql).get(...args).n;
    const paying = count(
      `SELECT COUNT(*) AS n FROM stores s WHERE slug != 'demo' AND plan_expires_at > ?
       AND EXISTS (SELECT 1 FROM payments p WHERE p.store_id = s.id)`,
      now
    );
    const mrr = paying * config.priceCents;
    return {
      stores_total: count("SELECT COUNT(*) AS n FROM stores WHERE slug != 'demo'"),
      paying_active: paying,
      trials_active: count(
        `SELECT COUNT(*) AS n FROM stores s WHERE slug != 'demo' AND plan_expires_at > ?
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.store_id = s.id)`,
        now
      ),
      expired: count("SELECT COUNT(*) AS n FROM stores WHERE slug != 'demo' AND plan_expires_at <= ?", now),
      signups_7d: count("SELECT COUNT(*) AS n FROM stores WHERE slug != 'demo' AND created_at > ?", now - 7 * DAY),
      orders_7d: count(
        `SELECT COUNT(*) AS n FROM orders o JOIN stores s ON s.id = o.store_id
         WHERE s.slug != 'demo' AND o.created_at > ?`,
        now - 7 * DAY
      ),
      revenue_30d_cents: db
        .prepare('SELECT COALESCE(SUM(amount_cents), 0) AS n FROM payments WHERE created_at > ?')
        .get(now - 30 * DAY).n,
      // Conversão: das lojas que já passaram do teste grátis, quantas pagaram alguma vez.
      ever_paid: count(
        `SELECT COUNT(*) AS n FROM stores s WHERE slug != 'demo'
         AND EXISTS (SELECT 1 FROM payments p WHERE p.store_id = s.id)`
      ),
      trials_ended: count(
        "SELECT COUNT(*) AS n FROM stores WHERE slug != 'demo' AND created_at < ?",
        now - config.trialDays * DAY
      ),
      mrr_cents: mrr,
      price_cents: config.priceCents,
      goal_cents: config.goalCents,
      stores_to_goal: Math.max(0, Math.ceil((config.goalCents - mrr) / config.priceCents)),
    };
  });

  route('GET', '/api/admin/lojas', (ctx) => {
    requireAdmin(ctx);
    const q = String(ctx.query.get('q') || '').trim();
    const like = `%${q}%`;
    const rows = db
      .prepare(
        `SELECT s.id, s.slug, s.name, s.whatsapp, s.plan_expires_at, s.created_at, u.email, u.name AS owner_name,
           (SELECT COUNT(*) FROM payments p WHERE p.store_id = s.id) AS payments_count,
           (SELECT MAX(created_at) FROM payments p WHERE p.store_id = s.id) AS last_payment_at,
           (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) AS products_count,
           (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) AS orders_count
         FROM stores s JOIN users u ON u.id = s.user_id
         WHERE s.slug != 'demo' AND (? = '' OR s.name LIKE ? OR s.slug LIKE ? OR u.email LIKE ?)
         ORDER BY s.created_at DESC LIMIT 500`
      )
      .all(q, like, like, like);
    return {
      stores: rows.map((r) => ({
        ...r,
        whatsapp_display: u.formatPhone(r.whatsapp),
        active: r.plan_expires_at > Date.now(),
        public_url: storeUrl(ctx, r.slug),
      })),
    };
  });

  route('POST', '/api/admin/lojas/:id/pagamento', (ctx) => {
    requireAdmin(ctx);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(ctx.params.id));
    if (!store) throw new HttpError(404, 'Loja não encontrada.');
    const days = ctx.body.days === undefined ? 30 : Number(ctx.body.days);
    if (!Number.isInteger(days) || days < 1 || days > 400) throw bad('Dias inválidos.');
    const amount =
      ctx.body.amount_cents === undefined ? config.priceCents : u.cents(ctx.body.amount_cents, { label: 'valor' });
    const note = u.text(ctx.body.note, { max: 200, label: 'a observação' });
    const now = Date.now();
    const expiresAt = Math.max(now, store.plan_expires_at) + days * DAY;
    transaction(db, () => {
      db.prepare('INSERT INTO payments (store_id, amount_cents, days, note, created_at) VALUES (?, ?, ?, ?, ?)').run(
        store.id,
        amount,
        days,
        note,
        now
      );
      db.prepare('UPDATE stores SET plan_expires_at = ? WHERE id = ?').run(expiresAt, store.id);
    });
    return { plan_expires_at: expiresAt };
  });

  route('POST', '/api/admin/lojas/:id/senha', async (ctx) => {
    requireAdmin(ctx);
    const store = db.prepare('SELECT user_id FROM stores WHERE id = ?').get(Number(ctx.params.id));
    if (!store) throw new HttpError(404, 'Loja não encontrada.');
    const password = auth.randomPassword();
    const hash = await auth.hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, store.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(store.user_id);
    return { password };
  });

  // ---------------------------------------------------------------- server

  function serveStatic(ctx) {
    const file = path.normalize(path.join(STATIC_DIR, decodeURIComponent(ctx.url.pathname.slice('/static/'.length))));
    if (!file.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new HttpError(404, 'Arquivo não encontrado.');
    }
    send(ctx.res, 200, fs.readFileSync(file), {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=300',
    });
  }

  function clientIp(req) {
    if (config.trustProxy && req.headers['x-forwarded-for']) {
      const hops = String(req.headers['x-forwarded-for']).split(',');
      return hops[hops.length - 1].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  // Bloqueia requisições de escrita vindas de outros sites (CSRF).
  function checkOrigin(ctx) {
    const header = ctx.req.headers.origin;
    if (!header) return;
    let host;
    try {
      host = new URL(header).host;
    } catch {
      throw new HttpError(403, 'Origem inválida.');
    }
    const allowed = [ctx.req.headers.host];
    if (config.baseUrl) allowed.push(new URL(config.baseUrl).host);
    if (!allowed.includes(host)) throw new HttpError(403, 'Origem inválida.');
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const ctx = {
      req,
      res,
      url,
      query: url.searchParams,
      params: {},
      body: {},
      cookies: auth.parseCookies(req.headers.cookie),
      ip: clientIp(req),
      secure:
        config.baseUrl.startsWith('https://') ||
        (config.trustProxy && req.headers['x-forwarded-proto'] === 'https'),
      user: undefined,
    };
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);

    try {
      const method = req.method === 'HEAD' ? 'GET' : req.method;
      if (method === 'GET' && url.pathname.startsWith('/static/')) return serveStatic(ctx);

      let match = null;
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(url.pathname);
        if (m) {
          match = r;
          r.keys.forEach((key, i) => (ctx.params[key] = decodeURIComponent(m[i + 1])));
          break;
        }
      }
      if (!match) throw new HttpError(404, 'Página não encontrada.');

      if (method !== 'GET') {
        checkOrigin(ctx);
        ctx.body = method === 'DELETE' ? {} : await readJson(req);
      }
      const result = await match.handler(ctx);
      if (result !== undefined && !res.headersSent) json(res, res.statusCode || 200, result);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : err instanceof pix.PixError ? 400 : 500;
      if (status === 500) console.error(err);
      const message = status === 500 ? 'Erro interno. Tente de novo em instantes.' : err.message;
      if (res.headersSent) return res.end();
      if (url.pathname.startsWith('/api/')) return json(res, status, { error: message });
      sendPage(ctx, 'erro.html', { TITLE: status === 404 ? 'Não encontrado' : 'Ops!', MESSAGE: message }, status);
    }
  };
}

async function main() {
  const config = require('./lib/config');
  const db = openDatabase(path.join(config.dataDir, 'pedezap.db'));
  if (config.seedDemo) await seedDemo(db, config);
  const server = http.createServer(createApp({ db, config }));
  server.listen(config.port, () => {
    console.log(`${config.appName} rodando em http://localhost:${config.port}`);
  });
  const shutdown = () => server.close(() => {
    db.close();
    process.exit(0);
  });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createApp };
