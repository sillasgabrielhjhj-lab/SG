// API SIMULADA (somente para testes de fumaça do painel). Dados FICTÍCIOS: nunca usar em produção.
// Uso: node tests/sim/mock-api.mjs [porta]   (padrão 4010)
import http from 'node:http';

const PORT = Number(process.argv[2] || 4010);
const SID = 'sim-session-token';
const CSRF = 'sim-csrf-token';
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const H = 3600_000;
const D = 24 * H;

const state = {
  password: 'senha-simulada-123',
  settings: {
    monitoring: { enabled: true, intervalMinutes: 10, maxItemsPerCategory: 50, source: 'fixture', minPriceDropPct: 3 },
    scoring: {
      weights: { discount: 25, savings: 10, historical: 20, seller: 10, availability: 8, demand: 8, category: 5, recency: 6, listingQuality: 8 },
      thresholds: { exceptional: 90, excellent: 75, good: 60 },
      minScoreToPublish: 75,
      minHistoryObservations: 3,
    },
    publishing: {
      autoPublish: false, minIntervalMinutes: 30, maxPerHour: 2, maxPerDay: 12, maxPerCategoryPerDay: 4, republishAfterDays: 7,
      republishMinAdditionalDropPct: 10, maxAttempts: 5, quietHours: { enabled: true, start: '00:00', end: '07:00', timezone: 'America/Sao_Paulo' },
    },
    affiliate: { requireValidatedLink: true, allowedHosts: ['mercadolivre.com.br', 'meli.la'], resolveRedirects: true },
    messages: { disclosure: 'Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado.', showInstallments: true, groupName: 'ACHADOS VIP' },
    alerts: { stuckJobMinutes: 15, stuckPublicationMinutes: 10 },
    retention: { logDays: 30, priceHistoryDays: 365 },
  },
  categories: [
    { id: 'c1', key: 'smartphones', name: 'Celulares (SIM)', enabled: true, relevance: 80, dailyLimit: null, minScore: null, mlCategoryIds: ['MLB1055'], searchTerms: [] },
    { id: 'c2', key: 'casa', name: 'Casa (SIM)', enabled: false, relevance: 50, dailyLimit: 3, minScore: 70, mlCategoryIds: [], searchTerms: [] },
  ],
  channels: [
    { id: 'ch1', type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila manual (SIM)', enabled: true, config: {}, credentialId: null, status: 'CONNECTED', statusDetail: 'Fila local', lastCheckedAt: iso(H), automatic: false },
    { id: 'ch2', type: 'TELEGRAM', name: 'Canal Telegram (SIM)', enabled: false, config: { chatId: '@sim' }, credentialId: 'cr1', status: 'AUTH_REQUIRED', statusDetail: 'Token inválido (simulado)', lastCheckedAt: iso(2 * H), automatic: true },
  ],
  credentials: [{ id: 'cr1', provider: 'telegram', name: 'principal', hint: 'ab12', status: 'UNKNOWN' }],
  offers: [
    mkOffer('o1', 'Smartphone Simulado 128GB', 189900, 249900, 32, true, 88, 'APPROVED', true),
    mkOffer('o2', 'Fone Bluetooth Simulado com cancelamento de ruído', 29900, 59900, null, false, 61, 'DISCOVERED', true),
    mkOffer('o3', 'Air Fryer Simulada 5L', 34900, null, null, false, 40, 'DISCOVERED', false),
  ],
  links: [
    { id: 'l1', productId: 'p1', productTitle: 'Smartphone Simulado 128GB', url: 'https://meli.la/sim1', kind: 'IMPORTED', status: 'VALIDATED', validatedAt: iso(D), validationNote: 'ok', lastError: null, createdAt: iso(2 * D) },
    { id: 'l2', productId: 'p2', productTitle: 'Fone Bluetooth Simulado', url: 'https://meli.la/sim2', kind: 'MANUAL', status: 'INVALID', validatedAt: null, validationNote: null, lastError: 'Destino não corresponde ao produto', createdAt: iso(D) },
  ],
  pubs: [
    pub('pu1', 'SENT', 'ch2', 'Canal Telegram (SIM)', 'TELEGRAM', 'Smartphone Simulado 128GB', 1),
    pub('pu2', 'MANUAL_READY', 'ch1', 'Fila manual (SIM)', 'WHATSAPP_MANUAL_QUEUE', 'Smartphone Simulado 128GB', 0),
    pub('pu3', 'FAILED', 'ch2', 'Canal Telegram (SIM)', 'TELEGRAM', 'Fone Bluetooth Simulado', 2, 'HTTP 401 Unauthorized'),
    pub('pu4', 'PENDING', 'ch2', 'Canal Telegram (SIM)', 'TELEGRAM', 'Air Fryer Simulada', 0),
  ],
  notifications: [
    { id: 'n1', level: 'WARN', type: 'integration_auth_required', title: 'Telegram: autenticação necessária (SIM)', body: 'Token inválido', read: false, createdAt: iso(H) },
  ],
  csrfFailures: 0,
};

function mkOffer(id, title, price, orig, pct, verified, score, status, link) {
  return {
    id, status, tier: score >= 75 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : 'BELOW', kind: 'COMMON', score,
    scoreBreakdown: { discount: { points: verified ? 20 : 0, max: 25, note: verified ? 'ok' : 'sem referência verificada' }, historical: { points: 0, max: 20, note: 'sem dado' }, seller: { points: 7, max: 10, note: 'reputação verde' } },
    priceCents: price, originalPriceCents: verified ? orig : null, discountPct: pct, savingsCents: verified ? orig - price : null, discountVerified: verified, couponCode: null,
    discoveredAt: iso(3 * H), hasValidatedLink: link,
    product: { id: 'p' + id.slice(1), title, thumbnail: 'https://http2.mlstatic.com/sim.jpg', permalink: 'https://produto.mercadolivre.com.br/MLB-123-sim', sellerName: 'Loja Simulada', category: { id: 'c1', name: 'Celulares (SIM)' } },
    _orig: orig,
  };
}
function pub(id, status, channelId, channelName, channelType, productTitle, attempts, lastError = null) {
  return {
    id, offerId: 'o1', channelId, channelName, channelType, status, template: 'COMMON', productTitle,
    messageText: `🔥 ${productTitle}\nPor R$ 1.899,00\nhttps://meli.la/sim1\n\nOferta sujeita à disponibilidade e alteração de preço. Link de afiliado.`,
    imageUrl: 'https://http2.mlstatic.com/sim.jpg', scheduledFor: null, sentAt: status === 'SENT' ? iso(H) : null, attemptsCount: attempts, lastError, createdAt: iso(2 * H),
    attempts: Array.from({ length: attempts }, (_, i) => ({ id: `${id}-a${i}`, startedAt: iso(H + i * 1000), finishedAt: iso(H), success: status === 'SENT', httpStatus: status === 'SENT' ? 200 : 401, error: status === 'SENT' ? null : 'HTTP 401', response: null })),
  };
}
const dto = ({ _orig, ...o }) => o;

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const err = (res, status, code, message, details) => send(res, status, { error: { code, message, ...(details ? { details } : {}) } });
const page = (items, q) => {
  const p = Number(q.get('page') || 1), ps = Number(q.get('pageSize') || 20);
  return { items: items.slice((p - 1) * ps, p * ps), total: items.length, page: p, pageSize: ps };
};
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r({}); } }); });
const merge = (t, p) => { for (const [k, v] of Object.entries(p)) { if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object') merge(t[k], v); else t[k] = v; } return t; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  const q = url.searchParams;
  const method = req.method;
  const authed = (req.headers.cookie || '').includes(`achados_sid=${SID}`);
  const body = method === 'GET' ? {} : await readBody(req);

  if (path === '/api/auth/login' && method === 'POST') {
    if (body.password !== state.password) return err(res, 401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    return send(res, 200, { user: { id: 'u1', email: body.email, role: 'ADMIN' }, csrfToken: CSRF }, { 'Set-Cookie': `achados_sid=${SID}; Path=/; HttpOnly; SameSite=Strict` });
  }
  if (path === '/__sim/state') return send(res, 200, { csrfFailures: state.csrfFailures, settings: state.settings });
  if (!path.startsWith('/api/')) return err(res, 404, 'NOT_FOUND', 'Rota inexistente.');
  if (!authed) return err(res, 401, 'UNAUTHORIZED', 'Não autenticado.');
  if (method !== 'GET' && req.headers['x-csrf-token'] !== CSRF) { state.csrfFailures++; return err(res, 403, 'CSRF_INVALID', 'Token CSRF inválido.'); }

  if (path === '/api/auth/me') return send(res, 200, { user: { id: 'u1', email: 'admin@sim.local', role: 'ADMIN' }, csrfToken: CSRF });
  if (path === '/api/auth/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': 'achados_sid=; Path=/; Max-Age=0' });
  if (path === '/api/auth/change-password') {
    if (body.currentPassword !== state.password) return err(res, 401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.');
    state.password = body.newPassword; return send(res, 200, { ok: true });
  }
  if (path === '/api/dashboard') {
    return send(res, 200, {
      monitoring: { enabled: state.settings.monitoring.enabled, status: 'SUCCEEDED', lastRunAt: iso(5 * 60_000), lastSuccessAt: iso(5 * 60_000), lastError: null, intervalMinutes: state.settings.monitoring.intervalMinutes },
      autoPublish: state.settings.publishing.autoPublish,
      integrations: state.channels.map((c) => ({ id: c.id, type: c.type, name: c.name, enabled: c.enabled, status: c.status, statusDetail: c.statusDetail, lastCheckedAt: c.lastCheckedAt })),
      source: { name: 'fixture (SIMULADO)', status: 'CONNECTED', detail: 'Fonte de teste' },
      today: { discovered: 12, approved: 4, published: 2, pending: 1, failed: 1 },
      pendingAffiliateLinks: 2, unreadNotifications: state.notifications.filter((n) => !n.read).length,
      series: Array.from({ length: 14 }, (_, i) => ({ date: new Date(now - (13 - i) * D).toISOString().slice(0, 10), discovered: (i * 7) % 15, approved: (i * 3) % 8, published: i % 4 })),
      jobs: [{ name: 'discovery', status: 'SUCCEEDED', lastRunAt: iso(5 * 60_000), lastSuccessAt: iso(5 * 60_000), lastError: null, nextRunAt: new Date(now + 5 * 60_000).toISOString() }],
    });
  }
  if (path === '/api/reports/summary') return send(res, 200, { period: {}, found: 120, approved: 30, published: 12, failed: 2, byCategory: [{ categoryId: 'c1', name: 'Celulares (SIM)', found: 80, qualified: 20, published: 9 }], recentPriceDrops: [], affiliateMetrics: { available: false, reason: 'Sem fonte autorizada de cliques/vendas/comissões.' } });
  if (path === '/api/notifications' && method === 'GET') return send(res, 200, state.notifications);
  if (path === '/api/notifications/read-all') { state.notifications.forEach((n) => (n.read = true)); return send(res, 200, { ok: true, count: 1 }); }
  let m;
  if ((m = path.match(/^\/api\/notifications\/(.+)\/read$/))) { const n = state.notifications.find((x) => x.id === m[1]); if (n) n.read = true; return send(res, 200, { ok: true }); }

  if (path === '/api/offers' && method === 'GET') {
    let items = state.offers.slice();
    if (q.get('status')) items = items.filter((o) => o.status === q.get('status'));
    if (q.get('q')) items = items.filter((o) => o.product.title.toLowerCase().includes(q.get('q').toLowerCase()));
    if (q.get('minScore')) items = items.filter((o) => o.score >= Number(q.get('minScore')));
    return send(res, 200, page(items.map(dto), q));
  }
  if ((m = path.match(/^\/api\/offers\/([^/]+)$/)) && method === 'GET') {
    const o = state.offers.find((x) => x.id === m[1]); if (!o) return err(res, 404, 'NOT_FOUND', 'Oferta não encontrada.');
    const base = o.priceCents;
    return send(res, 200, {
      ...dto(o),
      priceHistory: [0, 1, 2, 3, 4].map((i) => ({ priceCents: base + (4 - i) * 3000, originalPriceCents: o._orig, observedAt: iso((5 - i) * D), source: 'fixture' })),
      affiliateLinks: o.hasValidatedLink ? [state.links[0]] : [],
      publications: state.pubs.filter((p) => p.offerId === o.id).map(({ attempts, ...p }) => p),
      messagePreview: o.hasValidatedLink ? { whatsapp: `*${o.product.title}*\nPor R$ x`, telegram: `<b>${o.product.title}</b>\nPor R$ x` } : null,
    });
  }
  if ((m = path.match(/^\/api\/offers\/([^/]+)\/(approve|reject|publish)$/))) {
    const o = state.offers.find((x) => x.id === m[1]); if (!o) return err(res, 404, 'NOT_FOUND', 'Oferta não encontrada.');
    if (m[2] === 'approve') { o.status = 'APPROVED'; return send(res, 200, dto(o)); }
    if (m[2] === 'reject') { o.status = 'REJECTED'; return send(res, 200, dto(o)); }
    if (!o.hasValidatedLink) return err(res, 409, 'NO_VALIDATED_LINK', 'Publicação bloqueada: o produto não tem link de afiliado validado.');
    if (state.settings.publishing.quietHours.enabled && body.channelId === 'quiet') return err(res, 409, 'OUT_OF_WINDOW', 'Fora da janela.');
    o.status = 'QUEUED';
    return send(res, 200, { offer: dto(o), publications: [state.pubs[1]].map(({ attempts, ...p }) => p) });
  }

  if (path === '/api/affiliate/status') return send(res, 200, { generation: { available: false, reason: 'Não existe API oficial para gerar links de afiliado; use importação em lote.' }, credentialsConfigured: false, counts: { pending: 1, validated: 1, invalid: 1 } });
  if (path === '/api/affiliate/links' && method === 'GET') { let items = state.links.slice(); if (q.get('status')) items = items.filter((l) => l.status === q.get('status')); if (q.get('productId')) items = items.filter((l) => l.productId === q.get('productId')); return send(res, 200, page(items, q)); }
  if (path === '/api/affiliate/links' && method === 'POST') { const l = { id: 'l' + (state.links.length + 1), productId: body.productId, productTitle: 'Produto simulado', url: body.url, kind: 'MANUAL', status: 'VALIDATED', validatedAt: iso(0), validationNote: 'ok', lastError: null, createdAt: iso(0) }; state.links.push(l); return send(res, 200, l); }
  if (path === '/api/affiliate/links/import') return send(res, 200, { imported: 2, validated: 1, invalid: [{ line: 3, reason: 'Host não permitido: evil.example' }], unmatched: [{ line: 4, reason: 'MLB999 não encontrado' }] });
  if ((m = path.match(/^\/api\/affiliate\/links\/([^/]+)\/validate$/))) { const l = state.links.find((x) => x.id === m[1]); l.status = 'VALIDATED'; return send(res, 200, l); }
  if ((m = path.match(/^\/api\/affiliate\/links\/([^/]+)$/)) && method === 'DELETE') { state.links = state.links.filter((x) => x.id !== m[1]); return send(res, 200, { ok: true }); }
  if (path === '/api/affiliate/pending') return send(res, 200, [{ productId: 'p3', title: 'Air Fryer Simulada 5L', permalink: 'https://produto.mercadolivre.com.br/MLB-9-sim', offerId: 'o3', score: 40 }]);
  if (path === '/api/affiliate/pending.csv') { res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="p.csv"' }); return res.end('id;titulo;url_ml;score\np3;Air Fryer;https://x;40\n'); }

  if (path === '/api/publications' && method === 'GET') { const items = state.pubs.filter((p) => !q.get('status') || p.status === q.get('status')).map(({ attempts, ...p }) => p); return send(res, 200, page(items, q)); }
  if (path === '/api/publications/manual-queue') return send(res, 200, state.pubs.filter((p) => p.status === 'MANUAL_READY').map(({ attempts, ...p }) => p));
  if ((m = path.match(/^\/api\/publications\/([^/]+)$/)) && method === 'GET') { const p = state.pubs.find((x) => x.id === m[1]); return p ? send(res, 200, p) : err(res, 404, 'NOT_FOUND', 'Publicação não encontrada.'); }
  if ((m = path.match(/^\/api\/publications\/([^/]+)\/(retry|cancel|mark-sent)$/))) { const p = state.pubs.find((x) => x.id === m[1]); p.status = m[2] === 'retry' ? 'FAILED' : m[2] === 'cancel' ? 'CANCELLED' : 'SENT'; return send(res, 200, p); }

  if (path === '/api/settings' && method === 'GET') return send(res, 200, state.settings);
  if (path === '/api/settings' && method === 'PUT') { merge(state.settings, body); return send(res, 200, state.settings); }
  if (path === '/api/categories') return send(res, 200, state.categories);
  if ((m = path.match(/^\/api\/categories\/([^/]+)$/)) && method === 'PATCH') { const c = state.categories.find((x) => x.id === m[1]); Object.assign(c, body); return send(res, 200, c); }
  if (path === '/api/automation/run-discovery' || path === '/api/automation/run-publisher') return send(res, 200, { queued: true, jobId: 'job-sim-1' });

  if (path === '/api/integrations') return send(res, 200, { source: { name: 'fixture (SIMULADO)', status: 'CONNECTED', detail: 'Fonte de teste local', lastCheckedAt: iso(H) }, channels: state.channels, credentials: state.credentials, modes: [
    { key: 'A', label: 'Modo A — WhatsApp Groups API', status: 'Não configurado', explanation: 'Grupos criados via API, máx. 8 participantes.' },
    { key: 'B', label: 'Modo B — Fila manual', status: 'Ativo', explanation: 'Você publica manualmente.' },
    { key: 'C', label: 'Modo C — Telegram / Webhook', status: 'Autenticação necessária', explanation: 'Automação para audiência grande.' } ] });
  if (path === '/api/integrations/credentials') { const c = { id: 'cr' + (state.credentials.length + 1), provider: body.provider, name: body.name, hint: String(Object.values(body.values)[0]).slice(-4) }; state.credentials.push(c); return send(res, 200, c); }
  if (path === '/api/integrations/channels' && method === 'POST') { const c = { id: 'ch' + (state.channels.length + 1), ...body, credentialId: body.credentialId ?? null, enabled: !!body.enabled, status: 'UNKNOWN', statusDetail: null, lastCheckedAt: null, automatic: body.type !== 'WHATSAPP_MANUAL_QUEUE' }; state.channels.push(c); return send(res, 200, c); }
  if ((m = path.match(/^\/api\/integrations\/channels\/([^/]+)$/))) { const c = state.channels.find((x) => x.id === m[1]); if (method === 'PATCH') { Object.assign(c, body); return send(res, 200, c); } if (method === 'DELETE') { state.channels = state.channels.filter((x) => x.id !== m[1]); return send(res, 200, { ok: true }); } }
  if ((m = path.match(/^\/api\/integrations\/channels\/([^/]+)\/test$/))) { const c = state.channels.find((x) => x.id === m[1]); c.status = 'AUTH_REQUIRED'; c.lastCheckedAt = iso(0); return send(res, 200, { ok: false, status: 'AUTH_REQUIRED', detail: 'Token rejeitado (resposta SIMULADA)' }); }
  if (path === '/api/integrations/source/test') return send(res, 200, { ok: true, status: 'CONNECTED', detail: 'Fonte fixture respondeu (SIMULADO)' });

  if (path === '/api/logs') return send(res, 200, page([{ id: 'g1', level: 'ERROR', scope: 'publishing', message: 'Falha ao enviar (simulado)', meta: { httpStatus: 401, token: '[REDACTED]' }, createdAt: iso(H) }, { id: 'g2', level: 'INFO', scope: 'discovery', message: 'Busca concluída (simulado)', meta: null, createdAt: iso(2 * H) }].filter((l) => !q.get('level') || l.level === q.get('level')), q));
  if (path === '/api/audit') return send(res, 200, page([{ id: 'a1', userId: 'u1', userEmail: 'admin@sim.local', action: 'settings.update', entity: 'settings', entityId: '1', before: { publishing: { autoPublish: false } }, after: { publishing: { autoPublish: true } }, ip: '127.0.0.1', createdAt: iso(H) }], q));
  return err(res, 404, 'NOT_FOUND', 'Rota inexistente.');
});

server.listen(PORT, '127.0.0.1', () => console.log(`[SIMULADO] mock API em http://127.0.0.1:${PORT}`));
