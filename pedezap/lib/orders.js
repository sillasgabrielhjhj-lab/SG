'use strict';

const { bad, text, cents, money } = require('./util');

const ORDER_STATUSES = ['novo', 'preparando', 'saiu', 'concluido', 'cancelado'];

function paymentMethods(store) {
  const methods = [];
  if (store.pix_key) methods.push('pix');
  if (store.accepts_cash) methods.push('dinheiro');
  if (store.accepts_card) methods.push('cartao');
  return methods;
}

function fulfillments(store) {
  const options = [];
  if (store.accepts_delivery) options.push('entrega');
  if (store.accepts_pickup) options.push('retirada');
  return options;
}

// Monta o pedido a partir do carrinho do cliente. Preços e disponibilidade vêm
// sempre do banco: o navegador só diz "qual produto" e "quantos".
function buildOrder(store, productsById, input) {
  if (!store.is_open) throw bad('A loja está fechada no momento.');

  const customerName = text(input.customer_name, { max: 80, label: 'seu nome', required: true });
  const customerPhone = text(input.customer_phone, { max: 30, label: 'o telefone' });

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length) throw bad('Seu carrinho está vazio.');
  if (rawItems.length > 100) throw bad('Pedido com itens demais.');

  const items = [];
  let subtotal = 0;
  for (const raw of rawItems) {
    const product = productsById.get(Number(raw && raw.product_id));
    if (!product) throw bad('Um dos produtos não está mais no cardápio. Atualize a página.');
    if (!product.available) throw bad(`"${product.name}" está esgotado no momento.`);
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw bad('Quantidade inválida.');
    const note = text(raw.note, { max: 140, label: 'a observação do item' });
    const total = product.price_cents * qty;
    subtotal += total;
    items.push({ product_id: product.id, name: product.name, qty, unit_cents: product.price_cents, total_cents: total, note });
  }

  const fulfillment = input.fulfillment;
  if (!fulfillments(store).includes(fulfillment)) throw bad('Escolha entrega ou retirada.');
  const address =
    fulfillment === 'entrega' ? text(input.address, { max: 300, label: 'o endereço de entrega', required: true }) : '';

  const paymentMethod = input.payment_method;
  if (!paymentMethods(store).includes(paymentMethod)) throw bad('Escolha a forma de pagamento.');

  if (subtotal < store.min_order_cents) throw bad(`O pedido mínimo é de ${money(store.min_order_cents)}.`);

  const deliveryFee = fulfillment === 'entrega' ? store.delivery_fee_cents : 0;
  const total = subtotal + deliveryFee;

  let changeFor = null;
  if (paymentMethod === 'dinheiro' && input.change_for_cents) {
    changeFor = cents(input.change_for_cents, { label: 'troco para' });
    if (changeFor < total) throw bad('O valor para troco precisa ser maior que o total do pedido.');
  }

  return {
    customer_name: customerName,
    customer_phone: customerPhone,
    fulfillment,
    address,
    payment_method: paymentMethod,
    change_for_cents: changeFor,
    notes: text(input.notes, { max: 500, label: 'a observação' }),
    items,
    subtotal_cents: subtotal,
    delivery_fee_cents: deliveryFee,
    total_cents: total,
  };
}

function paymentLine(order) {
  if (order.payment_method === 'pix') return 'PIX (envio o comprovante aqui)';
  if (order.payment_method === 'dinheiro') {
    return order.change_for_cents ? `Dinheiro - troco para ${money(order.change_for_cents)}` : 'Dinheiro - sem troco';
  }
  return order.fulfillment === 'entrega' ? 'Cartão na entrega' : 'Cartão na retirada';
}

function whatsappMessage(store, order, appName) {
  const lines = [`*Pedido #${order.number}* - ${store.name}`, ''];
  for (const item of order.items) {
    lines.push(`${item.qty}x ${item.name} - ${money(item.total_cents)}`);
    if (item.note) lines.push(`   _Obs: ${item.note}_`);
  }
  lines.push('', `Subtotal: ${money(order.subtotal_cents)}`);
  if (order.fulfillment === 'entrega') {
    lines.push(`Entrega: ${order.delivery_fee_cents ? money(order.delivery_fee_cents) : 'grátis'}`);
  }
  lines.push(`*Total: ${money(order.total_cents)}*`, '');
  lines.push(`*Cliente:* ${order.customer_name}`);
  if (order.customer_phone) lines.push(`*Telefone:* ${order.customer_phone}`);
  lines.push(order.fulfillment === 'entrega' ? `*Entregar em:* ${order.address}` : '*Vou retirar no local*');
  lines.push(`*Pagamento:* ${paymentLine(order)}`);
  if (order.notes) lines.push(`*Obs:* ${order.notes}`);
  lines.push('', `_Pedido feito pelo ${appName}_`);
  return lines.join('\n');
}

function whatsappUrl(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

module.exports = { ORDER_STATUSES, paymentMethods, fulfillments, buildOrder, whatsappMessage, whatsappUrl };
