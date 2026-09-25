'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);
  const DAY = 86400000;
  const COLORS = ['#12a150', '#e8590c', '#d6336c', '#7048e8', '#1c7ed6', '#0c8599', '#f08c00', '#212529'];
  const OPEN_STATUSES = ['novo', 'preparando', 'saiu'];

  const state = {
    user: null,
    store: null,
    sub: null,
    app: null,
    products: [],
    orders: [],
    lastOrderId: 0,
    unseen: 0,
    filter: 'abertos',
    editing: null,
    photoId: null,
    photoUrl: null,
    logoId: null,
    logoUrl: null,
    color: '#12a150',
  };

  // --------------------------------------------------------------- início

  async function init() {
    let me;
    try {
      me = await api('GET', '/api/me');
    } catch (err) {
      if (err.status === 401) {
        window.location.href = '/entrar';
        return;
      }
      $('#loading').replaceWith(h('div', { class: 'container empty' }, h('strong', {}, 'Não foi possível abrir o painel'), err.message));
      return;
    }
    if (!me.store) {
      window.location.href = me.user.admin ? '/admin' : '/';
      return;
    }
    state.user = me.user;
    state.store = me.store;
    state.sub = me.subscription;
    state.app = me.app;
    $('#adminLink').hidden = !me.user.admin;

    await Promise.all([loadProducts(), loadOrders()]);
    renderStore();
    fillStoreForm();
    renderPlan();
    renderChecklist();

    $('#loading').remove();
    $('#app').hidden = false;
    const initial = window.location.hash.slice(1);
    showTab(document.getElementById(`tab-${initial}`) ? initial : 'pedidos');

    setInterval(pollOrders, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadOrders().then(renderOrders);
    });
  }

  // ------------------------------------------------------------------ abas

  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = p.id !== `tab-${name}`));
    if (name === 'pedidos') {
      state.unseen = 0;
      renderUnseen();
    }
    if (name === 'assinatura') loadBilling();
    if (name === 'divulgar') renderShare();
    history.replaceState(null, '', `#${name}`);
  }

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ------------------------------------------------------ cabeçalho da loja

  function renderStore() {
    const s = state.store;
    $('#storeName').textContent = s.name;
    $('#storeLink').textContent = s.public_url.replace(/^https?:\/\//, '');
    $('#storeLink').href = s.public_url;
    $('#viewStore').href = s.public_url;
    const toggle = $('#openToggle');
    toggle.checked = s.is_open;
    $('.open-switch').classList.toggle('is-open', s.is_open);
    $('#openLabel').textContent = s.is_open ? 'Loja aberta' : 'Loja fechada';
    $('#openHint').textContent = s.is_open ? 'Recebendo pedidos agora' : 'Clientes veem o cardápio, mas não pedem';
  }

  $('#openToggle').addEventListener('change', async (e) => {
    const isOpen = e.target.checked;
    try {
      await api('POST', '/api/loja/aberta', { is_open: isOpen });
      state.store.is_open = isOpen;
      renderStore();
      toast(isOpen ? 'Loja aberta! Pode receber pedidos.' : 'Loja fechada.');
    } catch (err) {
      e.target.checked = !isOpen;
      toast(err.message, 'error');
    }
  });

  // ------------------------------------------------------ primeiros passos

  function renderChecklist() {
    const s = state.store;
    const shared = storageGet(`pz_shared_${s.id}`, false);
    const n = state.products.length;
    const items = [
      { done: true, label: 'Criar sua conta' },
      {
        done: n >= 3,
        label: `Cadastrar pelo menos 3 produtos (${Math.min(n, 3)}/3)`,
        action: ['Adicionar', () => { showTab('cardapio'); openProduct(null); }],
      },
      {
        done: Boolean(s.pix_key),
        label: 'Configurar sua chave PIX',
        action: ['Configurar', () => { showTab('loja'); $('#pix').scrollIntoView({ behavior: 'smooth' }); }],
      },
      {
        done: state.orders.length > 0,
        label: 'Fazer um pedido de teste na sua loja',
        action: ['Testar', () => window.open(s.public_url, '_blank', 'noopener')],
      },
      { done: shared, label: 'Divulgar o link da loja', action: ['Divulgar', () => showTab('divulgar')] },
    ];
    const done = items.filter((i) => i.done).length;
    $('#onboarding').hidden = done === items.length;
    $('#onboardingProgress').textContent = `${done} de ${items.length}`;
    $('#checklist').replaceChildren(
      ...items.map((item) =>
        h(
          'li',
          { class: item.done ? 'done' : '' },
          h('span', { class: 'tick' }, item.done ? '✓' : ''),
          h('span', { class: 'task' }, item.label),
          !item.done && item.action
            ? h('button', { class: 'btn btn-sm', type: 'button', onclick: item.action[1] }, item.action[0])
            : null
        )
      )
    );
  }

  // --------------------------------------------------------------- pedidos

  async function loadOrders() {
    const { orders } = await api('GET', '/api/pedidos?limit=500');
    const fresh = new Set(state.orders.filter((o) => o._new).map((o) => o.id));
    state.orders = orders.map((o) => Object.assign(o, { _new: fresh.has(o.id) }));
    state.lastOrderId = orders.reduce((max, o) => Math.max(max, o.id), state.lastOrderId);
    renderOrders();
  }

  async function pollOrders() {
    let orders;
    try {
      ({ orders } = await api('GET', `/api/pedidos?after_id=${state.lastOrderId}`));
    } catch (err) {
      if (err.status === 401) window.location.href = '/entrar';
      return;
    }
    if (!orders.length) return;
    orders.forEach((o) => (o._new = true));
    state.orders = [...orders, ...state.orders];
    state.lastOrderId = Math.max(state.lastOrderId, ...orders.map((o) => o.id));
    const onOrders = !$('#tab-pedidos').hidden && !document.hidden;
    if (!onOrders) state.unseen += orders.length;
    beep();
    toast(`Novo pedido #${orders[0].number}: ${money(orders[0].total_cents)}`);
    renderOrders();
    renderUnseen();
    renderChecklist();
    if (document.hidden) document.title = `(${orders.length}) Novo pedido! | ${state.store.name}`;
  }

  function renderUnseen() {
    const badge = $('#newCount');
    badge.hidden = state.unseen === 0;
    badge.textContent = String(state.unseen);
    if (!state.unseen) document.title = `Painel | ${state.app.name}`;
  }

  function statusLabel(o) {
    return {
      novo: 'Novo',
      preparando: 'Preparando',
      saiu: o.fulfillment === 'entrega' ? 'Saiu para entrega' : 'Pronto para retirada',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
    }[o.status];
  }

  const STATUS_BADGE = {
    novo: 'badge-blue',
    preparando: 'badge-amber',
    saiu: 'badge-amber',
    concluido: 'badge-green',
    cancelado: 'badge-red',
  };

  function paymentText(o) {
    if (o.payment_method === 'pix') return 'PIX';
    if (o.payment_method === 'dinheiro') {
      return o.change_for_cents ? `Dinheiro (troco para ${money(o.change_for_cents)})` : 'Dinheiro (sem troco)';
    }
    return 'Cartão na entrega/retirada';
  }

  function customerMessage(o) {
    const first = o.customer_name.split(' ')[0];
    const tag = `#${o.number} (${state.store.name})`;
    switch (o.status) {
      case 'preparando':
        return `Olá, ${first}! Seu pedido ${tag} foi confirmado e já está sendo preparado. 😋`;
      case 'saiu':
        return o.fulfillment === 'entrega'
          ? `Olá, ${first}! Seu pedido ${tag} saiu para entrega! 🛵 Já já chega aí.`
          : `Olá, ${first}! Seu pedido ${tag} está pronto para retirada! 😊`;
      case 'concluido':
        return `Obrigado pela preferência, ${first}! Quando bater a fome de novo, é só pedir por aqui: ${state.store.public_url}`;
      case 'cancelado':
        return `Olá, ${first}. Infelizmente seu pedido ${tag} foi cancelado. Qualquer dúvida, é só chamar.`;
      default:
        return `Olá, ${first}! Recebemos seu pedido ${tag}. Já vamos confirmar!`;
    }
  }

  function nextStep(o) {
    if (o.status === 'novo') return ['preparando', 'Aceitar e preparar'];
    if (o.status === 'preparando') return ['saiu', o.fulfillment === 'entrega' ? 'Saiu para entrega' : 'Pronto para retirada'];
    if (o.status === 'saiu') return ['concluido', 'Concluir pedido'];
    return null;
  }

  async function setStatus(o, status) {
    try {
      const { order } = await api('PUT', `/api/pedidos/${o.id}`, { status });
      const i = state.orders.findIndex((x) => x.id === o.id);
      state.orders[i] = order;
      renderOrders();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function orderCard(o) {
    const next = nextStep(o);
    const isOpen = OPEN_STATUSES.includes(o.status);
    return h(
      'article',
      { class: `order${o._new ? ' is-new' : ''}` },
      h(
        'div',
        { class: 'order-head' },
        h(
          'div',
          { class: 'order-meta' },
          h('strong', {}, `#${o.number}`),
          h('span', { class: 'muted small' }, formatDate(o.created_at, true)),
          h('span', { class: `badge ${STATUS_BADGE[o.status]}` }, statusLabel(o))
        ),
        h('span', { class: 'order-total' }, money(o.total_cents))
      ),
      h('div', { class: 'order-customer' }, o.customer_name, o.customer_phone ? h('span', { class: 'muted' }, ` · ${o.customer_phone}`) : null),
      h(
        'ul',
        { class: 'order-items' },
        o.items.map((i) =>
          h('li', {}, `${i.qty}x ${i.name} `, h('span', { class: 'muted' }, money(i.total_cents)), i.note ? h('em', {}, `Obs: ${i.note}`) : null)
        )
      ),
      h(
        'div',
        { class: 'order-info' },
        h('span', {}, o.fulfillment === 'entrega' ? `🛵 Entregar em: ${o.address}` : '🏪 Retirada no local'),
        h('span', {}, `💳 ${paymentText(o)}`),
        o.delivery_fee_cents ? h('span', { class: 'muted' }, `Taxa de entrega: ${money(o.delivery_fee_cents)}`) : null,
        o.notes ? h('span', {}, `📝 ${o.notes}`) : null
      ),
      h(
        'div',
        { class: 'order-actions' },
        next ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => setStatus(o, next[0]) }, next[1]) : null,
        o.customer_whatsapp
          ? h(
              'a',
              { class: 'btn btn-wa', href: waLink(o.customer_whatsapp, customerMessage(o)), target: '_blank', rel: 'noopener' },
              icon('whatsapp'),
              'Avisar cliente'
            )
          : null,
        isOpen
          ? h(
              'button',
              {
                class: 'btn btn-ghost btn-danger',
                type: 'button',
                onclick: () => window.confirm(`Cancelar o pedido #${o.number}?`) && setStatus(o, 'cancelado'),
              },
              'Cancelar'
            )
          : h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => setStatus(o, 'novo') }, 'Reabrir')
      )
    );
  }

  function renderOrders() {
    const valid = state.orders.filter((o) => o.status !== 'cancelado');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t0 = today.getTime();
    const sum = (list) => list.reduce((acc, o) => acc + o.total_cents, 0);
    const todays = valid.filter((o) => o.created_at >= t0);
    $('#statOrdersToday').textContent = String(todays.length);
    $('#statSalesToday').textContent = money(sum(todays));
    $('#statSalesWeek').textContent = money(sum(valid.filter((o) => o.created_at >= t0 - 6 * DAY)));

    const list = state.orders.filter((o) =>
      state.filter === 'abertos' ? OPEN_STATUSES.includes(o.status) : state.filter === 'finalizados' ? !OPEN_STATUSES.includes(o.status) : true
    );
    const box = $('#orderList');
    if (!list.length) {
      const empty =
        state.filter === 'abertos'
          ? state.orders.length
            ? ['Nenhum pedido em aberto', 'Tudo em dia! Os novos pedidos aparecem aqui na hora.']
            : ['Nenhum pedido ainda', 'Compartilhe o link da sua loja para receber o primeiro pedido.']
          : ['Nada por aqui', 'Os pedidos concluídos e cancelados aparecem aqui.'];
      box.replaceChildren(h('div', { class: 'card empty' }, h('strong', {}, empty[0]), empty[1]));
      return;
    }
    box.replaceChildren(...list.slice(0, 150).map(orderCard));
  }

  document.querySelectorAll('input[name="orderFilter"]').forEach((r) =>
    r.addEventListener('change', () => {
      state.filter = r.value;
      renderOrders();
    })
  );

  // Aviso sonoro: o navegador só libera som depois do primeiro toque na página.
  let audio = null;
  document.addEventListener(
    'pointerdown',
    () => {
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        audio = null;
      }
    },
    { once: true }
  );

  function beep() {
    if (!audio) return;
    const t = audio.currentTime;
    [0, 0.2, 0.4].forEach((delay, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = i === 2 ? 1320 : 880;
      osc.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.35, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.16);
      osc.start(t + delay);
      osc.stop(t + delay + 0.18);
    });
  }

  // -------------------------------------------------------------- cardápio

  async function loadProducts() {
    state.products = (await api('GET', '/api/produtos')).products;
    renderProducts();
  }

  function categories() {
    const seen = [];
    for (const p of state.products) if (!seen.includes(p.category)) seen.push(p.category);
    return seen;
  }

  function thumb(name, url) {
    return h('div', { class: 'thumb' }, url ? h('img', { src: url, alt: '', loading: 'lazy' }) : name.trim().charAt(0).toUpperCase());
  }

  function productPayload(p, overrides) {
    return {
      name: p.name,
      description: p.description,
      category: p.category,
      price_cents: p.price_cents,
      image_id: p.image_id,
      available: p.available,
      ...overrides,
    };
  }

  async function quickToggle(p, input) {
    try {
      await api('PUT', `/api/produtos/${p.id}`, productPayload(p, { available: input.checked }));
      p.available = input.checked;
      renderProducts();
      toast(p.available ? `"${p.name}" disponível` : `"${p.name}" marcado como esgotado`);
    } catch (err) {
      input.checked = !input.checked;
      toast(err.message, 'error');
    }
  }

  async function move(p, dir) {
    const list = [...state.products];
    const i = list.indexOf(p);
    let j = i + dir;
    while (j >= 0 && j < list.length && list[j].category !== p.category) j += dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    state.products = list;
    renderProducts();
    try {
      state.products = (await api('POST', '/api/produtos/ordem', { ids: list.map((x) => x.id) })).products;
    } catch (err) {
      toast(err.message, 'error');
      await loadProducts();
    }
  }

  function productRow(p) {
    const toggle = h('input', { type: 'checkbox', checked: p.available, 'aria-label': `${p.name} disponível` });
    toggle.addEventListener('change', () => quickToggle(p, toggle));
    return h(
      'div',
      { class: `product-row${p.available ? '' : ' is-off'}` },
      thumb(p.name, p.image_url),
      h(
        'div',
        { class: 'product-main', onclick: () => openProduct(p) },
        h('b', {}, p.name),
        h('span', { class: 'price' }, money(p.price_cents)),
        p.available ? null : h('span', { class: 'badge badge-red' }, 'Esgotado')
      ),
      h(
        'div',
        { class: 'product-tools' },
        h('button', { class: 'btn btn-ghost btn-icon move', type: 'button', 'aria-label': 'Subir', onclick: () => move(p, -1) }, icon('up')),
        h('button', { class: 'btn btn-ghost btn-icon move', type: 'button', 'aria-label': 'Descer', onclick: () => move(p, 1) }, icon('down')),
        h('label', { class: 'switch', title: 'Disponível' }, toggle),
        h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': `Editar ${p.name}`, onclick: () => openProduct(p) }, icon('edit'))
      )
    );
  }

  function renderProducts() {
    const n = state.products.length;
    $('#productCount').textContent = n ? `${n} ${n === 1 ? 'produto' : 'produtos'}` : 'Comece adicionando seus produtos';
    const list = $('#productList');
    if (!n) {
      list.replaceChildren(
        h(
          'div',
          { class: 'card empty' },
          h('strong', {}, 'Seu cardápio está vazio'),
          h('p', {}, 'Adicione seus produtos com foto e preço. Leva menos de 1 minuto cada.'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openProduct(null) }, icon('plus'), 'Adicionar primeiro produto')
        )
      );
      return;
    }
    list.replaceChildren(
      ...categories().map((cat) =>
        h(
          'div',
          { class: 'category-block' },
          h('h3', {}, cat),
          h('div', { class: 'product-rows' }, state.products.filter((p) => p.category === cat).map(productRow))
        )
      )
    );
  }

  $('#addProduct').replaceChildren(icon('plus'), 'Adicionar produto');
  $('#addProduct').addEventListener('click', () => openProduct(null));

  // ------------------------------------------------------ produto (modal)

  const dialog = $('#productDialog');
  const pform = $('#productForm');
  const pf = (name) => pform.elements.namedItem(name);

  function renderPhoto() {
    const box = $('#photoPreview');
    box.replaceChildren(state.photoUrl ? h('img', { src: state.photoUrl, alt: '' }) : 'Sem foto');
    $('#photoRemove').hidden = !state.photoUrl;
  }

  function openProduct(p) {
    state.editing = p;
    state.photoId = p ? p.image_id : null;
    state.photoUrl = p ? p.image_url : null;
    $('#productDialogTitle').textContent = p ? 'Editar produto' : 'Novo produto';
    pf('name').value = p ? p.name : '';
    pf('price').value = p ? moneyInput(p.price_cents) : '';
    pf('category').value = p ? p.category : storageGet('pz_last_category', '');
    pf('description').value = p ? p.description : '';
    pf('available').checked = p ? p.available : true;
    $('#categoryList').replaceChildren(...categories().map((c) => h('option', { value: c })));
    $('#deleteProduct').hidden = !p;
    renderPhoto();
    dialog.showModal();
    if (!p) pf('name').focus();
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });

  $('#photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const box = $('#photoPreview');
    box.replaceChildren('Enviando…');
    try {
      const upload = await api('POST', '/api/imagens', { data_url: await resizeImage(file) });
      state.photoId = upload.id;
      state.photoUrl = upload.url;
    } catch (err) {
      toast(err.message, 'error');
    }
    renderPhoto();
  });

  $('#photoRemove').addEventListener('click', () => {
    state.photoId = null;
    state.photoUrl = null;
    renderPhoto();
  });

  pform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = pf('name').value.trim();
    const price = parseMoney(pf('price').value);
    if (!name) return toast('Informe o nome do produto.', 'error');
    if (!Number.isFinite(price) || price <= 0) return toast('Informe o preço, ex: 25,90.', 'error');
    const category = pf('category').value.trim();
    const body = {
      name,
      price_cents: price,
      category,
      description: pf('description').value.trim(),
      image_id: state.photoId,
      available: pf('available').checked,
    };
    const button = $('#saveProduct');
    busy(button, true);
    try {
      if (state.editing) await api('PUT', `/api/produtos/${state.editing.id}`, body);
      else await api('POST', '/api/produtos', body);
      storageSet('pz_last_category', category);
      await loadProducts();
      renderChecklist();
      dialog.close();
      toast(state.editing ? 'Produto atualizado!' : 'Produto adicionado!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      busy(button, false);
    }
  });

  $('#deleteProduct').addEventListener('click', async () => {
    const p = state.editing;
    if (!p || !window.confirm(`Excluir "${p.name}" do cardápio?`)) return;
    try {
      await api('DELETE', `/api/produtos/${p.id}`);
      await loadProducts();
      renderChecklist();
      dialog.close();
      toast('Produto excluído.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ------------------------------------------------------------ minha loja

  const sform = $('#storeForm');
  const sf = (name) => sform.elements.namedItem(name);

  function renderLogo() {
    $('#logoPreview').replaceChildren(state.logoUrl ? h('img', { src: state.logoUrl, alt: '' }) : 'Sem logo');
    $('#logoRemove').hidden = !state.logoUrl;
  }

  function renderColors() {
    const custom = h('input', { type: 'color', value: state.color, 'aria-label': 'Outra cor' });
    custom.addEventListener('input', () => {
      state.color = custom.value;
      renderColors();
    });
    $('#colorSwatches').replaceChildren(
      ...COLORS.map((c) => {
        const swatch = h('button', {
          type: 'button',
          class: 'swatch',
          'aria-label': `Cor ${c}`,
          'aria-pressed': String(c === state.color),
          onclick: () => {
            state.color = c;
            renderColors();
          },
        });
        swatch.style.background = c;
        return swatch;
      }),
      custom
    );
  }

  function fillStoreForm() {
    const s = state.store;
    sf('name').value = s.name;
    sf('slug').value = s.slug;
    $('#slugPrefix').textContent = s.public_url.replace(/^https?:\/\//, '').replace(/[^/]+$/, '');
    sf('description').value = s.description;
    sf('whatsapp').value = s.whatsapp;
    sf('hours').value = s.hours;
    sf('address').value = s.address;
    sf('accepts_delivery').checked = s.accepts_delivery;
    sf('delivery_fee').value = moneyInput(s.delivery_fee_cents);
    sf('accepts_pickup').checked = s.accepts_pickup;
    sf('min_order').value = moneyInput(s.min_order_cents);
    sf('pix_key_type').value = s.pix_key_type || 'telefone';
    sf('pix_key').value = s.pix_key;
    sf('pix_name').value = s.pix_name;
    sf('pix_city').value = s.pix_city;
    sf('accepts_cash').checked = s.accepts_cash;
    sf('accepts_card').checked = s.accepts_card;
    state.logoId = s.logo_image_id;
    state.logoUrl = s.logo_url;
    state.color = s.color;
    renderLogo();
    renderColors();
    $('#deliveryFeeField').hidden = !s.accepts_delivery;
  }

  sf('accepts_delivery').addEventListener('change', (e) => ($('#deliveryFeeField').hidden = !e.target.checked));

  $('#logoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('#logoPreview').replaceChildren('Enviando…');
    try {
      const upload = await api('POST', '/api/imagens', { data_url: await resizeImage(file, 400) });
      state.logoId = upload.id;
      state.logoUrl = upload.url;
      toast('Logo carregada. Clique em "Salvar alterações".');
    } catch (err) {
      toast(err.message, 'error');
    }
    renderLogo();
  });

  $('#logoRemove').addEventListener('click', () => {
    state.logoId = null;
    state.logoUrl = null;
    renderLogo();
  });

  sform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fee = parseMoney(sf('delivery_fee').value);
    const min = parseMoney(sf('min_order').value);
    if (!Number.isFinite(fee) || !Number.isFinite(min)) return toast('Confira os valores de taxa e pedido mínimo.', 'error');
    const body = {
      name: sf('name').value,
      slug: sf('slug').value,
      description: sf('description').value,
      whatsapp: sf('whatsapp').value,
      color: state.color,
      logo_image_id: state.logoId,
      address: sf('address').value,
      hours: sf('hours').value,
      is_open: state.store.is_open,
      accepts_delivery: sf('accepts_delivery').checked,
      accepts_pickup: sf('accepts_pickup').checked,
      delivery_fee_cents: fee,
      min_order_cents: min,
      accepts_cash: sf('accepts_cash').checked,
      accepts_card: sf('accepts_card').checked,
      pix_key_type: sf('pix_key_type').value,
      pix_key: sf('pix_key').value,
      pix_name: sf('pix_name').value,
      pix_city: sf('pix_city').value,
    };
    const button = $('#saveStore');
    busy(button, true);
    try {
      const { store } = await api('PUT', '/api/loja', body);
      state.store = store;
      fillStoreForm();
      renderStore();
      renderChecklist();
      toast('Alterações salvas!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      busy(button, false);
    }
  });

  // -------------------------------------------------------------- divulgar

  function markShared() {
    storageSet(`pz_shared_${state.store.id}`, true);
    renderChecklist();
  }

  function renderShare() {
    const s = state.store;
    const qr = `/qr/${encodeURIComponent(s.slug)}.svg`;
    $('#shareUrl').value = s.public_url;
    const wa = $('#shareWa');
    wa.href = `https://wa.me/?text=${encodeURIComponent(`Agora você pode fazer seu pedido pelo nosso cardápio online! 😋\n${s.public_url}`)}`;
    wa.replaceChildren(icon('whatsapp'), 'Enviar no WhatsApp');
    $('#openStore').href = s.public_url;
    $('#qrImg').src = qr;
    $('#downloadQr').href = qr;
    $('#downloadQr').setAttribute('download', `qrcode-${s.slug}.svg`);
    $('#posterName').textContent = s.name;
    $('#posterQr').src = qr;
    $('#posterUrl').textContent = s.public_url.replace(/^https?:\/\//, '');
  }

  $('#copyLink').addEventListener('click', () => {
    copyText($('#shareUrl').value, 'Link copiado!');
    markShared();
  });
  $('#shareWa').addEventListener('click', markShared);
  $('#printPoster').addEventListener('click', () => {
    document.body.classList.add('printing');
    window.print();
    markShared();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

  // ------------------------------------------------------------ assinatura

  function renderPlan() {
    const s = state.sub;
    const until = formatDate(s.expires_at);
    const days = `${s.days_left} ${s.days_left === 1 ? 'dia' : 'dias'}`;
    let banner = null;
    if (!s.active) {
      banner = ['alert alert-red', 'Sua loja está fora do ar: a assinatura venceu. Os clientes não conseguem ver o cardápio.', 'Reativar agora'];
    } else if (s.trial) {
      banner = [s.days_left <= 3 ? 'alert' : 'alert alert-green', `Teste grátis: faltam ${days}.`, 'Assinar'];
    } else if (s.days_left <= 5) {
      banner = ['alert', `Sua assinatura vence em ${days} (${until}).`, 'Renovar'];
    }
    $('#planBanner').replaceChildren(
      banner
        ? h('div', { class: banner[0] }, h('span', {}, banner[1]), h('button', { class: 'btn btn-sm', type: 'button', onclick: () => showTab('assinatura') }, banner[2]))
        : ''
    );

    const status = !s.active
      ? h('span', { class: 'badge badge-red' }, 'Vencida')
      : s.trial
        ? h('span', { class: 'badge badge-amber' }, 'Teste grátis')
        : h('span', { class: 'badge badge-green' }, 'Ativa');
    const text = !s.active
      ? `Venceu em ${until}. Pague para colocar a loja no ar de novo.`
      : s.trial
        ? `Seu teste vai até ${until} (${days}).`
        : `Ativa até ${until} (${days}).`;
    $('#planCard').replaceChildren(
      h(
        'div',
        { class: 'plan-status' },
        h('div', {}, h('h2', {}, 'Plano ', state.app.name, ' ', status), h('p', { class: 'muted' }, text)),
        h('div', { class: 'plan-price' }, money(s.price_cents), h('small', {}, '/mês'))
      )
    );
  }

  let billingLoaded = false;
  async function loadBilling() {
    if (billingLoaded) return;
    const card = $('#payCard');
    card.replaceChildren(h('div', { class: 'spinner' }));
    let bill;
    try {
      bill = await api('GET', '/api/assinatura/pix');
    } catch (err) {
      card.replaceChildren(h('p', {}, err.message));
      return;
    }
    billingLoaded = true;
    const support = bill.support_url
      ? h('a', { class: 'btn btn-wa btn-block', href: bill.support_url, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'Enviar comprovante no WhatsApp')
      : null;
    if (!bill.enabled) {
      card.replaceChildren(
        h('h2', { class: 'form-title' }, 'Como assinar'),
        h('p', { class: 'muted' }, 'Fale com a gente para ativar sua assinatura. Leva 1 minuto.'),
        support || h('p', {}, 'Entre em contato com o suporte.')
      );
      return;
    }
    card.replaceChildren(
      h('h2', { class: 'form-title' }, `Pagar ${money(bill.amount_cents)} com PIX`),
      h(
        'div',
        { class: 'pay-grid' },
        h('img', { class: 'qr-img', src: bill.qr, alt: 'QR Code PIX da assinatura' }),
        h(
          'div',
          {},
          h(
            'ol',
            { class: 'pay-steps' },
            h('li', {}, 'Abra o app do seu banco e escaneie o QR Code, ou use o PIX Copia e Cola.'),
            h('li', {}, 'Confira o valor e pague.'),
            h('li', {}, 'Envie o comprovante no WhatsApp. Sua loja ganha +30 dias assim que confirmarmos.')
          ),
          h(
            'div',
            { class: 'copy-box' },
            h('input', { type: 'text', readonly: true, value: bill.payload, 'aria-label': 'PIX Copia e Cola' }),
            h('button', { class: 'btn', type: 'button', onclick: () => copyText(bill.payload, 'Código PIX copiado!') }, 'Copiar')
          ),
          h('div', { class: 'share-actions' }, support)
        )
      )
    );
  }

  // ------------------------------------------------------------------ sair

  $('#logout').addEventListener('click', async () => {
    try {
      await api('POST', '/api/sair', {});
    } finally {
      window.location.href = '/';
    }
  });

  init();
})();
