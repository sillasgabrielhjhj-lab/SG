'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);
  let appName = 'PedeZap';
  let searchTimer = null;

  async function init() {
    try {
      const me = await api('GET', '/api/me');
      appName = me.app.name;
      if (!me.user.admin) {
        window.location.href = '/painel';
        return;
      }
    } catch (err) {
      if (err.status === 401) window.location.href = '/entrar';
      return;
    }
    await Promise.all([loadSummary(), loadStores()]);
    $('#loading').remove();
    $('#app').hidden = false;
  }

  async function loadSummary() {
    const s = await api('GET', '/api/admin/resumo');
    const pct = Math.min(100, (s.mrr_cents / s.goal_cents) * 100);
    $('#mrr').textContent = money(s.mrr_cents);
    $('#goalText').textContent = `Meta: ${money(s.goal_cents)}/mês`;
    $('#goalBar').setAttribute('aria-valuenow', String(Math.round(pct)));
    $('#goalBar span').style.width = `${pct}%`;
    $('#goalHint').textContent = s.stores_to_goal
      ? `Faltam ${s.stores_to_goal.toLocaleString('pt-BR')} lojas pagantes a ${money(s.price_cents)} para bater a meta (${pct.toFixed(1)}%).`
      : 'Meta batida! 🎉';
    $('#kPaying').textContent = String(s.paying_active);
    $('#kTrials').textContent = String(s.trials_active);
    $('#kExpired').textContent = String(s.expired);
    $('#kRevenue').textContent = money(s.revenue_30d_cents);
    $('#kSignups').textContent = String(s.signups_7d);
    $('#kOrders').textContent = String(s.orders_7d);
    $('#kTotal').textContent = String(s.stores_total);
    $('#kConversion').textContent = s.trials_ended
      ? `${Math.round((Math.min(s.ever_paid, s.trials_ended) / s.trials_ended) * 100)}%`
      : '-';
  }

  function statusBadge(r) {
    if (!r.active) return h('span', { class: 'badge badge-red' }, `Vencida ${formatDate(r.plan_expires_at)}`);
    if (!r.payments_count) return h('span', { class: 'badge badge-amber' }, `Teste até ${formatDate(r.plan_expires_at)}`);
    return h('span', { class: 'badge badge-green' }, `Ativa até ${formatDate(r.plan_expires_at)}`);
  }

  // Mensagem pronta de venda/cobrança, de acordo com a situação da loja.
  function salesMessage(r) {
    const first = r.owner_name.split(' ')[0];
    if (!r.active) {
      return `Oi, ${first}! Aqui é do ${appName}. Vi que a assinatura da ${r.name} venceu e o cardápio saiu do ar. Quer que eu te mande o PIX para reativar agora?`;
    }
    if (!r.payments_count) {
      if (!r.products_count) {
        return `Oi, ${first}! Aqui é do ${appName}. Vi que você criou a loja ${r.name}, mas ainda não cadastrou produtos. Quer ajuda para montar o cardápio? Eu monto com você em 10 minutos.`;
      }
      return `Oi, ${first}! Aqui é do ${appName}. Como está sendo o teste da ${r.name}? Já recebeu pedidos pelo link? Se quiser, te ajudo a divulgar para vender mais.`;
    }
    return `Oi, ${first}! Aqui é do ${appName}. Passando para saber como estão as vendas da ${r.name}. Posso ajudar em algo?`;
  }

  async function confirmPayment(r, button) {
    if (!window.confirm(`Confirmar pagamento da loja "${r.name}" e liberar +30 dias?`)) return;
    busy(button, true);
    try {
      await api('POST', `/api/admin/lojas/${r.id}/pagamento`, {});
      toast('Pagamento registrado. Loja liberada por +30 dias.');
      await Promise.all([loadSummary(), loadStores()]);
    } catch (err) {
      toast(err.message, 'error');
      busy(button, false);
    }
  }

  async function resetPassword(r) {
    if (!window.confirm(`Gerar uma senha nova para ${r.email}? A senha atual deixa de funcionar.`)) return;
    try {
      const { password } = await api('POST', `/api/admin/lojas/${r.id}/senha`, {});
      const message = `Oi, ${r.owner_name.split(' ')[0]}! Sua nova senha do ${appName} é: ${password}\nEntre em ${window.location.origin}/entrar com o e-mail ${r.email}.`;
      window.prompt('Nova senha gerada. Copie e envie para o cliente:', message);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function row(r) {
    const payButton = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, '+30 dias (pago)');
    payButton.addEventListener('click', () => confirmPayment(r, payButton));
    return h(
      'tr',
      {},
      h(
        'td',
        {},
        h('a', { href: r.public_url, target: '_blank', rel: 'noopener' }, h('b', {}, r.name)),
        h('div', { class: 'small muted' }, `${r.owner_name} · ${r.email}`),
        h('div', { class: 'small muted' }, `${r.whatsapp_display} · criada em ${formatDate(r.created_at)}`)
      ),
      h('td', {}, statusBadge(r)),
      h('td', { class: 'num' }, String(r.products_count)),
      h('td', { class: 'num' }, String(r.orders_count)),
      h('td', { class: 'num' }, String(r.payments_count)),
      h(
        'td',
        {},
        payButton,
        h('a', { class: 'btn btn-sm btn-wa', href: waLink(r.whatsapp, salesMessage(r)), target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'Chamar'),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => resetPassword(r) }, 'Nova senha')
      )
    );
  }

  async function loadStores() {
    const q = $('#search').value.trim();
    const { stores } = await api('GET', `/api/admin/lojas?q=${encodeURIComponent(q)}`);
    $('#rows').replaceChildren(
      ...(stores.length
        ? stores.map(row)
        : [h('tr', {}, h('td', { colspan: '6', class: 'empty' }, q ? 'Nenhuma loja encontrada.' : 'Nenhuma loja cadastrada ainda. Hora de vender!'))])
    );
  }

  $('#search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadStores().catch((err) => toast(err.message, 'error')), 250);
  });

  $('#logout').addEventListener('click', async () => {
    try {
      await api('POST', '/api/sair', {});
    } finally {
      window.location.href = '/';
    }
  });

  init();
})();
