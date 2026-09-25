'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);
  const slug = decodeURIComponent(window.location.pathname.split('/')[2] || '');
  const CART_KEY = `pz_cart_${slug}`;

  const PAYMENT = {
    pix: ['PIX', 'QR Code e copia e cola com o valor certo'],
    dinheiro: ['Dinheiro', 'Informe se precisa de troco'],
    cartao: ['Cartão', 'Crédito ou débito na maquininha'],
  };

  const state = { store: null, products: [], byId: new Map(), cart: [], item: null, qty: 1, search: '' };

  // ------------------------------------------------------------- carregar

  async function init() {
    let data;
    try {
      data = await api('GET', `/api/lojas/${encodeURIComponent(slug)}`);
    } catch (err) {
      showUnavailable('Loja não encontrada', err.message);
      return;
    }
    $('#loading').remove();
    if (!data.active) {
      document.title = data.store.name;
      showUnavailable(data.store.name, 'Este cardápio está temporariamente fora do ar. Tente novamente mais tarde.');
      return;
    }
    state.store = data.store;
    state.products = data.products;
    state.byId = new Map(data.products.map((p) => [p.id, p]));
    state.cart = storageGet(CART_KEY, []).filter((line) => {
      const p = state.byId.get(line.product_id);
      return p && p.available && Number.isInteger(line.qty) && line.qty > 0;
    });

    applyBrand(state.store.color);
    renderHeader();
    renderMenu();
    renderCartBar();

    const powered = $('#poweredBy');
    powered.href = data.app.url;
    powered.replaceChildren(h('img', { src: '/static/favicon.svg', alt: '' }), 'Faça seu cardápio digital com o ', h('b', {}, data.app.name));

    $('#shop').hidden = false;
  }

  function showUnavailable(title, text) {
    const loading = $('#loading');
    if (loading) loading.remove();
    $('#unavailableTitle').textContent = title;
    $('#unavailableText').textContent = text;
    $('#unavailable').hidden = false;
  }

  function applyBrand(color) {
    const root = document.documentElement.style;
    root.setProperty('--brand', color);
    root.setProperty('--on-brand', readableOn(color));
    root.setProperty('--brand-soft', `color-mix(in srgb, ${color} 12%, white)`);
  }

  // ------------------------------------------------------------ cabeçalho

  function renderHeader() {
    const s = state.store;
    $('#shopName').textContent = s.name;
    $('#shopDesc').textContent = s.description;
    $('#shopDesc').hidden = !s.description;
    $('#shopLogo').replaceChildren(s.logo_url ? h('img', { src: s.logo_url, alt: `Logo ${s.name}` }) : s.name.trim().charAt(0).toUpperCase());

    const chips = [
      h('li', { class: s.is_open ? 'is-open' : 'is-closed' }, h('span', { class: 'dot' }), s.is_open ? 'Aberto agora' : 'Fechado'),
    ];
    if (s.hours) chips.push(h('li', {}, `🕒 ${s.hours}`));
    if (s.fulfillments.includes('entrega')) {
      chips.push(h('li', {}, `🛵 Entrega ${s.delivery_fee_cents ? money(s.delivery_fee_cents) : 'grátis'}`));
    }
    if (s.fulfillments.includes('retirada')) chips.push(h('li', {}, '🏪 Retirada'));
    if (s.min_order_cents) chips.push(h('li', {}, `Pedido mínimo ${money(s.min_order_cents)}`));
    if (s.payment_methods.includes('pix')) chips.push(h('li', {}, '⚡ Aceita PIX'));
    $('#shopChips').replaceChildren(...chips);
    $('#closedBanner').hidden = s.is_open;
  }

  // ------------------------------------------------------------- cardápio

  function normalize(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function categories(products) {
    const seen = [];
    for (const p of products) if (!seen.includes(p.category)) seen.push(p.category);
    return seen;
  }

  function qtyInCart(productId) {
    return state.cart.filter((l) => l.product_id === productId).reduce((acc, l) => acc + l.qty, 0);
  }

  function menuItem(p) {
    const inCart = qtyInCart(p.id);
    return h(
      'button',
      { class: 'menu-item', type: 'button', disabled: !p.available, onclick: () => openItem(p) },
      h(
        'div',
        { class: 'menu-item-text' },
        h('b', {}, p.name),
        p.description ? h('p', {}, p.description) : null,
        h('span', { class: 'menu-item-price' }, money(p.price_cents)),
        !p.available ? h('span', { class: 'sold-out' }, 'Esgotado') : null,
        inCart ? h('span', { class: 'in-cart' }, `${inCart} no carrinho`) : null
      ),
      h(
        'div',
        { class: `menu-item-media${p.image_url ? '' : ' no-photo'}` },
        p.image_url ? h('img', { src: p.image_url, alt: '', loading: 'lazy' }) : null,
        p.available ? h('span', { class: 'add-dot', 'aria-hidden': 'true' }, icon('plus')) : null
      )
    );
  }

  function renderMenu() {
    const q = normalize(state.search.trim());
    const products = q
      ? state.products.filter((p) => normalize(`${p.name} ${p.description} ${p.category}`).includes(q))
      : state.products;
    const cats = categories(products);
    const menu = $('#menu');

    $('#catNav').hidden = q !== '' || cats.length < 2;
    $('#catNavInner').replaceChildren(
      ...cats.map((cat, i) => h('a', { href: `#cat-${i}`, class: i === 0 ? 'active' : '', dataset: { index: String(i) } }, cat))
    );

    if (!state.products.length) {
      menu.replaceChildren(h('p', { class: 'no-results' }, 'O cardápio ainda está sendo montado. Volte em breve!'));
      return;
    }
    if (!products.length) {
      menu.replaceChildren(h('p', { class: 'no-results' }, `Nada encontrado para "${state.search.trim()}".`));
      return;
    }
    menu.replaceChildren(
      ...cats.map((cat, i) =>
        h(
          'section',
          { class: 'menu-section', id: `cat-${i}`, dataset: { index: String(i) } },
          h('h2', {}, cat),
          products.filter((p) => p.category === cat).map(menuItem)
        )
      )
    );
    observeSections();
  }

  let observer = null;
  function observeSections() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = entry.target.dataset.index;
          document.querySelectorAll('.cat-nav a').forEach((a) => {
            const active = a.dataset.index === index;
            a.classList.toggle('active', active);
            if (active) a.scrollIntoView({ block: 'nearest', inline: 'center' });
          });
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    document.querySelectorAll('.menu-section').forEach((s) => observer.observe(s));
  }

  $('#search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderMenu();
  });

  // --------------------------------------------------------------- produto

  const itemDialog = $('#itemDialog');
  $('#itemMinus').append(icon('minus'));
  $('#itemPlus').append(icon('plus'));

  function renderItemQty() {
    $('#itemQty').textContent = String(state.qty);
    $('#itemAdd').textContent = `Adicionar · ${money(state.item.price_cents * state.qty)}`;
  }

  function openItem(p) {
    state.item = p;
    state.qty = 1;
    $('#itemMedia').replaceChildren(p.image_url ? h('img', { src: p.image_url, alt: p.name }) : '');
    $('#itemName').textContent = p.name;
    $('#itemDesc').textContent = p.description;
    $('#itemPrice').textContent = money(p.price_cents);
    $('#itemNote').value = '';
    renderItemQty();
    itemDialog.showModal();
  }

  $('#itemMinus').addEventListener('click', () => {
    state.qty = Math.max(1, state.qty - 1);
    renderItemQty();
  });
  $('#itemPlus').addEventListener('click', () => {
    state.qty = Math.min(99, state.qty + 1);
    renderItemQty();
  });

  $('#itemAdd').addEventListener('click', () => {
    const note = $('#itemNote').value.trim();
    const existing = state.cart.find((l) => l.product_id === state.item.id && l.note === note);
    if (existing) existing.qty = Math.min(99, existing.qty + state.qty);
    else state.cart.push({ product_id: state.item.id, qty: state.qty, note });
    saveCart();
    itemDialog.close();
    toast(`${state.qty}x ${state.item.name} no carrinho`);
  });

  // -------------------------------------------------------------- carrinho

  function saveCart() {
    storageSet(CART_KEY, state.cart);
    renderCartBar();
    renderMenu();
  }

  function subtotal() {
    return state.cart.reduce((acc, l) => acc + state.byId.get(l.product_id).price_cents * l.qty, 0);
  }

  function renderCartBar() {
    const count = state.cart.reduce((acc, l) => acc + l.qty, 0);
    $('#cartBar').hidden = count === 0;
    $('#cartCount').textContent = String(count);
    $('#cartTotal').textContent = money(subtotal());
  }

  const cartDialog = $('#cartDialog');
  const form = $('#checkout');
  const cf = (name) => form.elements.namedItem(name);

  function cartLine(line, index) {
    const p = state.byId.get(line.product_id);
    const change = (delta) => {
      line.qty += delta;
      if (line.qty <= 0) state.cart.splice(index, 1);
      saveCart();
      if (!state.cart.length) cartDialog.close();
      else renderCheckout();
    };
    return h(
      'li',
      { class: 'cart-line' },
      h('div', { class: 'cart-line-text' }, h('b', {}, p.name), line.note ? h('em', {}, `Obs: ${line.note}`) : null, h('span', { class: 'cart-line-price' }, money(p.price_cents * line.qty))),
      h(
        'div',
        { class: 'stepper sm' },
        h('button', { type: 'button', 'aria-label': `Remover um ${p.name}`, onclick: () => change(-1) }, icon(line.qty === 1 ? 'trash' : 'minus')),
        h('span', {}, String(line.qty)),
        h('button', { type: 'button', 'aria-label': `Adicionar um ${p.name}`, onclick: () => change(1) }, icon('plus'))
      )
    );
  }

  function selected(name) {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
  }

  function renderOptions() {
    const s = state.store;
    const saved = storageGet('pz_customer', {});
    const current = selected('fulfillment') || saved.fulfillment;
    const fulfillment = s.fulfillments.includes(current) ? current : s.fulfillments[0];
    $('#fulfillmentSeg').replaceChildren(
      ...s.fulfillments.map((f) =>
        h(
          'label',
          {},
          h('input', { type: 'radio', name: 'fulfillment', value: f, checked: f === fulfillment }),
          h('span', {}, f === 'entrega' ? `🛵 Entrega${s.delivery_fee_cents ? ` (${money(s.delivery_fee_cents)})` : ' grátis'}` : '🏪 Retirar no local')
        )
      )
    );
    const currentPay = selected('payment_method');
    $('#paySeg').replaceChildren(
      ...s.payment_methods.map((m) =>
        h(
          'label',
          {},
          h('input', { type: 'radio', name: 'payment_method', value: m, checked: m === currentPay }),
          h('span', {}, PAYMENT[m][0], h('small', {}, PAYMENT[m][1]))
        )
      )
    );
  }

  function renderCheckout() {
    const s = state.store;
    $('#cartLines').replaceChildren(...state.cart.map(cartLine));
    const fulfillment = selected('fulfillment');
    const isDelivery = fulfillment === 'entrega';
    $('#addressField').hidden = !isDelivery;
    const pickup = $('#pickupInfo');
    pickup.hidden = isDelivery || !s.address;
    pickup.textContent = s.address ? `📍 Retirada em: ${s.address}` : '';
    $('#changeField').hidden = selected('payment_method') !== 'dinheiro';

    const sub = subtotal();
    const fee = isDelivery ? s.delivery_fee_cents : 0;
    const rows = [['Subtotal', money(sub)]];
    if (isDelivery) rows.push(['Entrega', fee ? money(fee) : 'Grátis']);
    $('#totals').replaceChildren(
      ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
      h('dt', { class: 'grand' }, 'Total'),
      h('dd', { class: 'grand' }, money(sub + fee))
    );

    const button = $('#placeOrder');
    const belowMin = sub < s.min_order_cents;
    button.disabled = !s.is_open || belowMin;
    button.textContent = !s.is_open
      ? 'Loja fechada no momento'
      : belowMin
        ? `Pedido mínimo: ${money(s.min_order_cents)}`
        : `Fazer pedido · ${money(sub + fee)}`;
  }

  $('#openCart').addEventListener('click', () => {
    const saved = storageGet('pz_customer', {});
    if (!cf('customer_name').value) cf('customer_name').value = saved.name || '';
    if (!cf('customer_phone').value) cf('customer_phone').value = saved.phone || '';
    if (!cf('address').value) cf('address').value = saved.address || '';
    $('#checkoutError').hidden = true;
    renderOptions();
    renderCheckout();
    cartDialog.showModal();
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'fulfillment' || e.target.name === 'payment_method') renderCheckout();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#checkoutError');
    error.hidden = true;
    const fulfillment = selected('fulfillment');
    const payment = selected('payment_method');
    const change = parseMoney(cf('change_for').value);
    const problem = !cf('customer_name').value.trim()
      ? 'Informe seu nome.'
      : fulfillment === 'entrega' && !cf('address').value.trim()
        ? 'Informe o endereço de entrega.'
        : !payment
          ? 'Escolha a forma de pagamento.'
          : payment === 'dinheiro' && !Number.isFinite(change)
            ? 'Valor de troco inválido.'
            : null;
    if (problem) {
      error.textContent = problem;
      error.hidden = false;
      error.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const body = {
      customer_name: cf('customer_name').value.trim(),
      customer_phone: cf('customer_phone').value.trim(),
      fulfillment,
      address: fulfillment === 'entrega' ? cf('address').value.trim() : '',
      payment_method: payment,
      change_for_cents: payment === 'dinheiro' && change ? change : null,
      notes: cf('notes').value.trim(),
      items: state.cart.map((l) => ({ product_id: l.product_id, qty: l.qty, note: l.note })),
    };

    const button = $('#placeOrder');
    busy(button, true);
    button.textContent = 'Enviando pedido…';
    try {
      const result = await api('POST', `/api/lojas/${encodeURIComponent(slug)}/pedidos`, body);
      storageSet('pz_customer', { name: body.customer_name, phone: body.customer_phone, address: cf('address').value.trim(), fulfillment });
      state.cart = [];
      saveCart();
      cf('notes').value = '';
      cf('change_for').value = '';
      cartDialog.close();
      showDone(result);
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      error.scrollIntoView({ behavior: 'smooth', block: 'center' });
      renderCheckout();
    } finally {
      button.removeAttribute('aria-busy');
    }
  });

  // ---------------------------------------------------------- pedido feito

  const doneDialog = $('#doneDialog');

  function showDone(result) {
    $('#doneTitle').textContent = `Pedido #${result.number} anotado!`;
    const wa = $('#doneWa');
    wa.href = result.whatsapp_url;
    wa.replaceChildren(icon('whatsapp'), 'Enviar pedido no WhatsApp');
    const pix = $('#donePix');
    pix.hidden = !result.pix;
    if (result.pix) {
      $('#donePixTitle').textContent = `Pague ${money(result.total_cents)} com PIX`;
      $('#donePixQr').src = result.pix.qr;
      $('#donePixCode').value = result.pix.payload;
    }
    doneDialog.showModal();
  }

  $('#donePixCopy').addEventListener('click', () => copyText($('#donePixCode').value, 'Código PIX copiado! Cole no app do banco.'));

  // Fechar modais: botão × e clique fora.
  [itemDialog, cartDialog, doneDialog].forEach((dialog) =>
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    })
  );

  init();
})();
