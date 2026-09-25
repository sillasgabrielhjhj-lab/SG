/* ============================================================
   Venax — Motor da plataforma de negociação (100% simulado)
   Nenhum dado real de mercado, pagamento ou saldo é processado.
   Tudo roda localmente no navegador, com localStorage.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const LS_BALANCE = 'venax_balance';
  const LS_HISTORY = 'venax_history';
  const LS_LEDGER = 'venax_ledger';
  const LS_PROFILE = 'venax_profile';
  const LS_AVATAR = 'venax_avatar';
  const LS_PREFS = 'venax_prefs';
  const START_BALANCE = 10000;

  const EXP_STEPS = [15, 30, 60, 120, 300];
  const PROFIT_MAP = { 15: 78, 30: 87, 60: 91, 120: 94, 300: 96 };

  const DEFAULT_TABS = ['EURUSD', 'GBPJPY', 'BTCUSD'];

  const toastStack = document.getElementById('toastStack');

  /* ================= State ================= */
  let balance = Number(localStorage.getItem(LS_BALANCE)) || START_BALANCE;
  let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  let ledger = JSON.parse(localStorage.getItem(LS_LEDGER) || '[]');
  let profile = JSON.parse(localStorage.getItem(LS_PROFILE) || 'null') || { name: '', email: '', country: 'Brasil' };
  let prefs = Object.assign({ sound: true, ma: true, volume: true }, JSON.parse(localStorage.getItem(LS_PREFS) || '{}'));
  let openTabs = [...DEFAULT_TABS];
  let activeId = openTabs[0];
  let amount = 100;
  let expIdx = 1; // 30s
  let pending = null; // { direction, amount, entryPrice, endsAt, priceLine }
  let chart, candleSeries;
  const symbolState = {}; // id -> { sym, candles, tickCount }

  /* ================= Persistence ================= */
  function saveBalance(){ localStorage.setItem(LS_BALANCE, String(balance)); }
  function saveHistory(){ localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(-60))); }
  function saveLedger(){ localStorage.setItem(LS_LEDGER, JSON.stringify(ledger.slice(-80))); }
  function saveProfile(){ localStorage.setItem(LS_PROFILE, JSON.stringify(profile)); }

  function addLedgerEntry(type, delta){
    ledger.push({ type, delta, balance, time: Date.now() });
    saveLedger();
  }

  function setBalance(v){
    balance = Math.max(0, Math.round(v * 100) / 100);
    saveBalance();
    renderBalance();
  }

  function renderBalance(){
    document.getElementById('balanceVal').textContent = VenaxUI.formatBRL(balance);
    const btnHigher = document.getElementById('btnHigher');
    const btnLower = document.getElementById('btnLower');
    const insufficient = balance < amount || amount <= 0;
    if (!pending){
      btnHigher.disabled = insufficient;
      btnLower.disabled = insufficient;
    }
  }

  /* ================= Symbol / chart data ================= */
  function symbolById(id){ return VenaxSim.SYMBOLS.find(s => s.id === id); }

  function ensureSymbolState(id, stepSeconds = 60){
    const sym = symbolById(id);
    if (!symbolState[id]){
      symbolState[id] = {
        sym,
        candles: VenaxSim.genCandles(sym, 140, stepSeconds),
        tickCount: 0,
        stepSeconds,
      };
    }
    return symbolState[id];
  }

  const MA_PERIOD = 20;
  let maSeries, volumeSeries;

  function smaAt(candles, idx, period){
    if (idx < period - 1) return null;
    let sum = 0;
    for (let i = idx - period + 1; i <= idx; i++) sum += candles[i].close;
    return sum / period;
  }

  function computeMaSeries(candles, period){
    const out = [];
    for (let i = 0; i < candles.length; i++){
      const v = smaAt(candles, i, period);
      if (v !== null) out.push({ time: candles[i].time, value: v });
    }
    return out;
  }

  function volumeColor(candle){ return candle.close >= candle.open ? 'rgba(0,227,154,.45)' : 'rgba(255,77,94,.45)'; }

  function initChart(){
    const container = document.getElementById('priceChart');
    chart = LightweightCharts.createChart(container, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9aa8b1', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.045)' }, horzLines: { color: 'rgba(255,255,255,0.045)' } },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      autoSize: false,
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: '#00e39a', downColor: '#ff4d5e', borderVisible: false,
      wickUpColor: '#00e39a', wickDownColor: '#ff4d5e',
    });
    maSeries = chart.addLineSeries({
      color: '#ffb020', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    chart.subscribeCrosshairMove(updateLegend);

    const stage = container.parentElement;
    const resize = () => chart.applyOptions({ width: stage.clientWidth, height: stage.clientHeight });
    new ResizeObserver(resize).observe(stage);
    resize();
  }

  function updateLegend(param){
    const legend = document.getElementById('chartLegend');
    const st = symbolState[activeId];
    if (!st) return;
    let candle = st.candles[st.candles.length - 1];
    if (param && param.time){
      const found = st.candles.find(c => c.time === param.time);
      if (found) candle = found;
    }
    const d = st.sym.decimals;
    const rows = [`<div class="lg-row">
      <span class="lg-o">O <b>${VenaxSim.formatPrice(candle.open, d)}</b></span>
      <span class="lg-h">A <b>${VenaxSim.formatPrice(candle.high, d)}</b></span>
      <span class="lg-l">B <b>${VenaxSim.formatPrice(candle.low, d)}</b></span>
      <span class="lg-c">F <b>${VenaxSim.formatPrice(candle.close, d)}</b></span>
    </div>`];
    if (prefs.ma || prefs.volume){
      const parts = [];
      if (prefs.ma){
        const i = st.candles.indexOf(candle);
        const v = smaAt(st.candles, i, MA_PERIOD);
        parts.push(`<span class="lg-ma">MA20 <b>${v ? VenaxSim.formatPrice(v, d) : '—'}</b></span>`);
      }
      if (prefs.volume) parts.push(`<span class="lg-vol">Vol <b>${Math.round(candle.volume || 0)}</b></span>`);
      rows.push(`<div class="lg-row">${parts.join('')}</div>`);
    }
    legend.innerHTML = rows.join('');
  }

  function setMaVisible(v){ maSeries?.applyOptions({ visible: v }); }
  function setVolumeVisible(v){ volumeSeries?.applyOptions({ visible: v }); }

  function renderTabs(){
    const wrap = document.getElementById('platTabs');
    wrap.innerHTML = openTabs.map(id => {
      const sym = symbolById(id);
      return `<button class="plat-tab ${id === activeId ? 'active' : ''}" data-id="${id}">
        <span class="flag">${sym.flag}</span> ${sym.name} <span class="otc-pill">OTC</span>
      </button>`;
    }).join('') + `<button class="plat-tab-add" id="addTabBtn" title="Adicionar mercado">+</button>`;

    wrap.querySelectorAll('.plat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (pending) return toast('warn', 'Operação em andamento', 'Aguarde o fim da operação atual para trocar de mercado.');
        activeId = btn.dataset.id;
        loadActiveSymbol();
        renderTabs();
      });
    });
    document.getElementById('addTabBtn').addEventListener('click', () => {
      const available = VenaxSim.SYMBOLS.map(s => s.id).filter(id => !openTabs.includes(id));
      if (!available.length) return toast('warn', 'Tudo aberto', 'Todos os mercados simulados já estão nas abas.');
      const next = available[0];
      openTabs.push(next);
      activeId = next;
      loadActiveSymbol();
      renderTabs();
    });
  }

  function loadActiveSymbol(){
    const st = ensureSymbolState(activeId);
    candleSeries.setData(st.candles);
    maSeries.setData(computeMaSeries(st.candles, MA_PERIOD));
    volumeSeries.setData(st.candles.map(c => ({ time: c.time, value: c.volume || 0, color: volumeColor(c) })));
    setMaVisible(prefs.ma);
    setVolumeVisible(prefs.volume);
    chart.timeScale().fitContent();
    updateSymbolHeader();
    randomizeProbabilities();
    updateLegend();
  }

  function updateSymbolHeader(){
    const st = symbolState[activeId];
    const last = st.candles[st.candles.length - 1];
    const first = st.candles[0];
    const chg = ((last.close - first.open) / first.open) * 100;
    document.getElementById('symTitle').innerHTML = `${st.sym.name} <span class="otc-pill">OTC</span>`;
    document.getElementById('symPrice').textContent = VenaxSim.formatPrice(last.close, st.sym.decimals);
    const changeEl = document.getElementById('symChange');
    changeEl.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    changeEl.className = `badge ${chg >= 0 ? 'badge-up' : 'badge-down'}`;
  }

  function randomizeProbabilities(){
    const h = Math.round(VenaxSim.rand(42, 58));
    document.getElementById('probHigher').textContent = `ALTA · ${h}%`;
    document.getElementById('probLower').textContent = `BAIXA · ${100 - h}%`;
  }

  /* ================= Live ticking ================= */
  function tick(){
    const st = symbolState[activeId];
    if (!st) return;
    const last = st.candles[st.candles.length - 1];
    const np = VenaxSim.nextPrice(last.close, st.sym.vol);
    last.close = np;
    last.high = Math.max(last.high, np);
    last.low = Math.min(last.low, np);
    last.volume = (last.volume || 0) + VenaxSim.rand(1, 4);
    candleSeries.update(last);
    volumeSeries.update({ time: last.time, value: last.volume, color: volumeColor(last) });
    const lastMa = smaAt(st.candles, st.candles.length - 1, MA_PERIOD);
    if (lastMa !== null) maSeries.update({ time: last.time, value: lastMa });
    st.tickCount++;

    if (st.tickCount % 5 === 0){
      const newCandle = { time: last.time + st.stepSeconds, open: np, high: np, low: np, close: np, volume: VenaxSim.rand(20, 50) };
      st.candles.push(newCandle);
      if (st.candles.length > 220) st.candles.shift();
      candleSeries.update(newCandle);
      volumeSeries.update({ time: newCandle.time, value: newCandle.volume, color: volumeColor(newCandle) });
      const newMa = smaAt(st.candles, st.candles.length - 1, MA_PERIOD);
      if (newMa !== null) maSeries.update({ time: newCandle.time, value: newMa });
    }
    updateSymbolHeader();
    updateLegend();

    // background ticking keeps all open symbols alive so switching tabs feels continuous
    openTabs.forEach(id => {
      if (id === activeId || !symbolState[id]) return;
      const s = symbolState[id];
      const l = s.candles[s.candles.length - 1];
      const p = VenaxSim.nextPrice(l.close, s.sym.vol);
      l.close = p; l.high = Math.max(l.high, p); l.low = Math.min(l.low, p);
    });
  }

  /* ================= Amount / expiration controls ================= */
  function renderAmount(){
    document.getElementById('amountInput').value = amount;
    renderPayout();
    renderBalance();
  }
  function setAmount(v){
    amount = Math.max(10, Math.min(Math.round(v), Math.max(10, Math.round(balance)) || 10));
    renderAmount();
  }

  function renderExp(){
    const secs = EXP_STEPS[expIdx];
    document.getElementById('expInput').value = secs;
    document.getElementById('expLabel').textContent = formatDuration(secs);
    renderPayout();
  }
  function formatDuration(secs){
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60 ? String(secs % 60).padStart(2, '0') + 's' : ''}`;
  }

  function renderPayout(){
    const secs = EXP_STEPS[expIdx];
    const pct = PROFIT_MAP[secs] || 85;
    const gain = amount * (pct / 100);
    document.getElementById('profitPct').textContent = `+${pct}%`;
    document.getElementById('payoutVal').textContent = `Ganho de ${VenaxUI.formatBRL(gain)}`;
  }

  /* ================= Trading ================= */
  function placeTrade(direction){
    if (pending) return;
    if (amount <= 0 || amount > balance){
      toast('warn', 'Saldo insuficiente', 'Ajuste o valor da operação ou adicione saldo demo.');
      return;
    }
    const st = symbolState[activeId];
    const entryPrice = st.candles[st.candles.length - 1].close;
    const secs = EXP_STEPS[expIdx];
    const endsAt = Date.now() + secs * 1000;

    setBalance(balance - amount);
    addLedgerEntry(direction === 'higher' ? 'trade_open_higher' : 'trade_open_lower', -amount);

    const priceLine = candleSeries.createPriceLine({
      price: entryPrice,
      color: direction === 'higher' ? '#00e39a' : '#ff4d5e',
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Entrada',
    });

    pending = { direction, amount, entryPrice, endsAt, priceLine, symbolId: activeId };

    document.getElementById('btnHigher').disabled = true;
    document.getElementById('btnLower').disabled = true;
    document.getElementById('amountMinus').disabled = true;
    document.getElementById('amountPlus').disabled = true;
    document.getElementById('expMinus').disabled = true;
    document.getElementById('expPlus').disabled = true;
    document.querySelectorAll('.amount-presets button').forEach(b => b.disabled = true);

    const timer = document.getElementById('purchaseTimer');
    const dirEl = document.getElementById('timerDir');
    dirEl.textContent = direction === 'higher' ? 'ALTA' : 'BAIXA';
    dirEl.className = `dir ${direction}`;
    timer.classList.add('show');

    tickCountdown();
  }

  function tickCountdown(){
    if (!pending) return;
    const remaining = Math.max(0, pending.endsAt - Date.now());
    const secs = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    document.getElementById('timerTime').textContent = `${mm}:${ss}`;

    if (remaining <= 0){
      resolveTrade();
    } else {
      requestAnimationFrame(() => setTimeout(tickCountdown, 200));
    }
  }

  function resolveTrade(){
    const st = symbolState[pending.symbolId];
    const exitPrice = st.candles[st.candles.length - 1].close;
    const { direction, amount: amt, entryPrice, priceLine, symbolId } = pending;

    let result;
    if (exitPrice === entryPrice) result = 'draw';
    else if (direction === 'higher') result = exitPrice > entryPrice ? 'win' : 'lose';
    else result = exitPrice < entryPrice ? 'win' : 'lose';

    const pct = PROFIT_MAP[EXP_STEPS[expIdx]] || 85;
    let delta = 0;
    if (result === 'win') delta = amt + amt * (pct / 100);
    else if (result === 'draw') delta = amt;

    if (delta > 0){
      setBalance(balance + delta);
      addLedgerEntry(result === 'win' ? 'trade_win' : 'trade_draw', delta);
    }

    candleSeries.removePriceLine(priceLine);
    document.getElementById('purchaseTimer').classList.remove('show');

    const record = {
      symbol: symbolById(symbolId).name,
      direction, amount: amt, entryPrice, exitPrice, result,
      profit: result === 'win' ? amt * (pct / 100) : (result === 'draw' ? 0 : -amt),
      time: Date.now(),
    };
    history.push(record);
    saveHistory();
    renderHistory();
    renderPortfolio();

    playBeep(result === 'win');
    if (result === 'win'){
      toast('win', 'Operação vencedora', `${record.symbol} · ${direction === 'higher' ? 'Alta' : 'Baixa'} · +${VenaxUI.formatBRL(record.profit)}`);
    } else if (result === 'lose'){
      toast('lose', 'Operação perdedora', `${record.symbol} · ${direction === 'higher' ? 'Alta' : 'Baixa'} · -${VenaxUI.formatBRL(amt)}`);
    } else {
      toast('win', 'Empate', 'Preço de saída igual à entrada — valor devolvido.');
    }

    pending = null;
    document.getElementById('amountMinus').disabled = false;
    document.getElementById('amountPlus').disabled = false;
    document.getElementById('expMinus').disabled = false;
    document.getElementById('expPlus').disabled = false;
    document.querySelectorAll('.amount-presets button').forEach(b => b.disabled = false);
    renderBalance();
  }

  /* ================= History / portfolio drawers ================= */
  function renderHistory(){
    const list = document.getElementById('historyList');
    if (!history.length){
      list.innerHTML = '<p class="history-empty">Nenhuma operação demo ainda. Escolha ALTA ou BAIXA para começar.</p>';
      return;
    }
    list.innerHTML = [...history].reverse().slice(0, 40).map(h => {
      const dirLabel = h.direction === 'higher' ? 'Alta' : 'Baixa';
      const dt = new Date(h.time);
      const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const resultClass = h.result === 'win' ? 'up' : (h.result === 'lose' ? 'down' : '');
      const resultText = h.result === 'win' ? `+${VenaxUI.formatBRL(h.profit)}` : (h.result === 'lose' ? `-${VenaxUI.formatBRL(h.amount)}` : 'Empate');
      return `<div class="history-item">
        <div class="history-dir ${h.direction}">
          <svg viewBox="0 0 20 20" fill="none">${h.direction === 'higher' ? '<path d="M4 14l5-6 4 4 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M4 6l5 6 4-4 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'}</svg>
          <div><div>${h.symbol}</div><div class="history-meta">${dirLabel} · ${time}</div></div>
        </div>
        <span class="history-result ${resultClass}">${resultText}</span>
      </div>`;
    }).join('');
  }

  function renderPortfolio(){
    const wins = history.filter(h => h.result === 'win').length;
    const losses = history.filter(h => h.result === 'lose').length;
    const total = history.length;
    document.getElementById('portfolioBalance').textContent = VenaxUI.formatBRL(balance);
    const pctVsStart = ((balance - START_BALANCE) / START_BALANCE) * 100;
    const pctEl = document.getElementById('portfolioPct');
    pctEl.textContent = `${pctVsStart >= 0 ? '+' : ''}${pctVsStart.toFixed(1)}%`;
    pctEl.style.color = pctVsStart >= 0 ? 'var(--brand-2)' : '#ff8590';

    document.getElementById('statWins').textContent = wins;
    document.getElementById('statLosses').textContent = losses;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statWinsBar').style.width = total ? `${(wins / total) * 100}%` : '0%';
    document.getElementById('statLossesBar').style.width = total ? `${(losses / total) * 100}%` : '0%';
  }

  function renderAnalysis(){
    const momentum = Math.round(VenaxSim.rand(20, 80));
    const vol = Math.round(VenaxSim.rand(20, 80));
    const sent = Math.round(VenaxSim.rand(20, 80));
    setGauge('gMomentum', 'gMomentumBar', momentum, ['Baixo', 'Moderado', 'Alto']);
    setGauge('gVol', 'gVolBar', vol, ['Baixa', 'Moderada', 'Alta']);
    setGauge('gSent', 'gSentBar', sent, ['Vendedor', 'Neutro', 'Comprador']);
  }
  function setGauge(labelId, barId, val, labels){
    const label = val < 34 ? labels[0] : (val < 67 ? labels[1] : labels[2]);
    document.getElementById(labelId).textContent = label;
    document.getElementById(barId).style.width = `${val}%`;
  }

  /* ================= Drawers ================= */
  let openDrawerByKey = () => {};

  function initDrawers(){
    const drawers = {
      portfolio: document.getElementById('drawerPortfolio'),
      history: document.getElementById('drawerHistory'),
      analysis: document.getElementById('drawerAnalysis'),
      help: document.getElementById('drawerHelp'),
      balanceHistory: document.getElementById('drawerBalanceHistory'),
    };
    const sideBtns = document.querySelectorAll('.side-btn');

    function closeAll(){
      Object.values(drawers).forEach(d => d.classList.remove('open'));
      sideBtns.forEach(b => b.classList.remove('active'));
    }
    function open(key, btn){
      const isOpen = drawers[key].classList.contains('open');
      closeAll();
      if (!isOpen){
        drawers[key].classList.add('open');
        if (btn) btn.classList.add('active');
        if (key === 'analysis') renderAnalysis();
        if (key === 'portfolio') renderPortfolio();
        if (key === 'history') renderHistory();
        if (key === 'balanceHistory') renderBalanceHistory();
      }
    }
    sideBtns.forEach(btn => btn.addEventListener('click', () => open(btn.dataset.drawer, btn)));
    document.querySelectorAll('.drawer-close').forEach(btn => btn.addEventListener('click', closeAll));
    openDrawerByKey = (key) => open(key, null);
  }

  /* ================= Deposit / withdraw modals ================= */
  let openDepositModal = () => {};
  let openWithdrawModal = () => {};

  function initDeposit(){
    const modal = document.getElementById('depositModal');
    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');
    document.getElementById('depositBtn').addEventListener('click', open);
    document.getElementById('depositClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    function doDeposit(v){
      setBalance(balance + v);
      addLedgerEntry('deposit', v);
      toast('win', 'Saldo demo adicionado', `+${VenaxUI.formatBRL(v)} adicionados à sua conta demo.`);
      close();
    }
    document.querySelectorAll('.deposit-presets button[data-dep]').forEach(btn => {
      btn.addEventListener('click', () => doDeposit(Number(btn.dataset.dep)));
    });
    document.getElementById('depositConfirm').addEventListener('click', () => {
      const input = document.getElementById('depositCustom');
      const v = Number(input.value);
      if (!v || v <= 0) return toast('warn', 'Valor inválido', 'Informe um valor demo maior que zero.');
      doDeposit(v);
      input.value = '';
    });
    openDepositModal = open;
  }

  function initWithdraw(){
    const modal = document.getElementById('withdrawModal');
    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');
    document.getElementById('openWithdraw').addEventListener('click', () => { document.getElementById('accountMenu').classList.remove('open'); open(); });
    document.getElementById('withdrawClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    function doWithdraw(v){
      if (v > balance) return toast('warn', 'Saldo insuficiente', 'O valor do saque não pode ser maior que o saldo demo.');
      setBalance(balance - v);
      addLedgerEntry('withdraw', -v);
      toast('win', 'Saque realizado', `-${VenaxUI.formatBRL(v)} descontados do seu saldo demo.`);
      close();
    }
    document.querySelectorAll('.deposit-presets button[data-wd]').forEach(btn => {
      btn.addEventListener('click', () => doWithdraw(Number(btn.dataset.wd)));
    });
    document.getElementById('withdrawConfirm').addEventListener('click', () => {
      const input = document.getElementById('withdrawCustom');
      const v = Number(input.value);
      if (!v || v <= 0) return toast('warn', 'Valor inválido', 'Informe um valor demo maior que zero.');
      doWithdraw(v);
      input.value = '';
    });
    openWithdrawModal = open;
  }

  /* ================= Personal data ================= */
  function applyAvatar(dataUrl){
    document.querySelectorAll('.avatar-circle').forEach(el => {
      el.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="">` : (profile.name ? profile.name[0].toUpperCase() : 'V');
    });
  }

  function renderProfile(){
    document.getElementById('accountName').textContent = profile.name || 'Conta Demo';
    document.getElementById('accountEmail').textContent = profile.email || 'demo@venax.app';
    const avatar = localStorage.getItem(LS_AVATAR);
    applyAvatar(avatar);
  }

  function initPersonalData(){
    const modal = document.getElementById('personalDataModal');
    const open = () => {
      document.getElementById('pdName').value = profile.name;
      document.getElementById('pdEmail').value = profile.email;
      document.getElementById('pdCountry').value = profile.country;
      modal.classList.add('open');
    };
    const close = () => modal.classList.remove('open');
    document.getElementById('openPersonalData').addEventListener('click', () => { document.getElementById('accountMenu').classList.remove('open'); open(); });
    document.getElementById('personalDataClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('personalDataForm').addEventListener('submit', (e) => {
      e.preventDefault();
      profile = {
        name: document.getElementById('pdName').value.trim(),
        email: document.getElementById('pdEmail').value.trim(),
        country: document.getElementById('pdCountry').value,
      };
      saveProfile();
      renderProfile();
      toast('win', 'Dados salvos', 'Suas informações foram atualizadas nesta conta demo.');
      close();
    });

    document.getElementById('avatarUpload').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(LS_AVATAR, reader.result);
        applyAvatar(reader.result);
        toast('win', 'Foto atualizada', 'Sua foto de perfil foi salva neste navegador.');
      };
      reader.readAsDataURL(file);
    });
  }

  /* ================= Settings ================= */
  function initSettings(){
    const modal = document.getElementById('settingsModal');
    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');
    document.getElementById('openSettings').addEventListener('click', () => { document.getElementById('accountMenu').classList.remove('open'); open(); });
    document.getElementById('settingsClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    const maToggle = document.getElementById('settingsMaToggle');
    const volToggle = document.getElementById('settingsVolToggle');
    document.getElementById('settingsSoundToggle').classList.toggle('active', prefs.sound);
    maToggle.classList.toggle('active', prefs.ma);
    volToggle.classList.toggle('active', prefs.volume);

    document.getElementById('settingsSoundToggle').addEventListener('click', () => setSoundPref(!prefs.sound));
    maToggle.addEventListener('click', () => {
      prefs.ma = !prefs.ma;
      savePrefs();
      maToggle.classList.toggle('active', prefs.ma);
      setMaVisible(prefs.ma);
    });
    volToggle.addEventListener('click', () => {
      prefs.volume = !prefs.volume;
      savePrefs();
      volToggle.classList.toggle('active', prefs.volume);
      setVolumeVisible(prefs.volume);
    });

    document.getElementById('settingsResetBtn').addEventListener('click', () => {
      close();
      resetAccount();
    });
  }

  function resetAccount(){
    if (pending) return toast('warn', 'Operação em andamento', 'Aguarde o fim da operação atual.');
    if (!confirm('Reiniciar o saldo demo para R$ 10.000,00 e apagar o histórico local?')) return;
    setBalance(START_BALANCE);
    history = [];
    ledger = [];
    saveHistory();
    saveLedger();
    addLedgerEntry('deposit', START_BALANCE);
    renderHistory();
    renderPortfolio();
    toast('win', 'Conta reiniciada', 'Sua conta demo voltou para R$ 10.000,00.');
  }

  /* ================= Balance history ================= */
  const LEDGER_LABELS = {
    deposit: { label: 'Depósito', dir: 'up' },
    withdraw: { label: 'Saque', dir: 'down' },
    trade_open_higher: { label: 'Operação Alta', dir: 'down' },
    trade_open_lower: { label: 'Operação Baixa', dir: 'down' },
    trade_win: { label: 'Operação vencedora', dir: 'up' },
    trade_draw: { label: 'Empate devolvido', dir: 'up' },
  };

  function renderBalanceHistory(){
    const list = document.getElementById('balanceLedgerList');
    const spark = document.getElementById('balanceSpark');
    const entries = ledger.slice(-40);
    if (!entries.length){
      list.innerHTML = '<p class="history-empty">Nenhuma movimentação ainda.</p>';
      spark.innerHTML = '';
      return;
    }
    const vals = entries.map(e => e.balance);
    const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
    const range = (max - min) || 1;
    const w = 300, h = 70;
    const points = vals.map((v, i) => {
      const x = (i / Math.max(vals.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
    const area = `${path} L${w},${h} L0,${h} Z`;
    spark.innerHTML = `
      <path d="${area}" fill="rgba(0,227,154,.12)" stroke="none"></path>
      <path d="${path}" fill="none" stroke="#00e39a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>`;

    list.innerHTML = [...entries].reverse().map(e => {
      const meta = LEDGER_LABELS[e.type] || { label: e.type, dir: e.delta >= 0 ? 'up' : 'down' };
      const time = new Date(e.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const sign = e.delta >= 0 ? '+' : '-';
      return `<div class="ledger-item">
        <div class="ledger-type">
          <span class="ledger-ic ${meta.dir}">
            <svg viewBox="0 0 20 20" fill="none">${meta.dir === 'up' ? '<path d="M4 14l5-6 4 4 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M4 6l5 6 4-4 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'}</svg>
          </span>
          <div><div>${meta.label}</div><div class="history-meta">${time}</div></div>
        </div>
        <span class="ledger-amount ${meta.dir === 'up' ? 'up' : 'down'}">
          ${sign}${VenaxUI.formatBRL(Math.abs(e.delta))}
          <span class="ledger-balance">saldo: ${VenaxUI.formatBRL(e.balance)}</span>
        </span>
      </div>`;
    }).join('');
  }

  /* ================= Account menu ================= */
  function initAccountMenu(){
    const menu = document.getElementById('accountMenu');
    const btn = document.getElementById('balanceBtn');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', () => menu.classList.remove('open'));

    document.getElementById('openDepositFromMenu').addEventListener('click', () => { menu.classList.remove('open'); openDepositModal(); });
    document.getElementById('openBalanceHistory').addEventListener('click', () => { menu.classList.remove('open'); openDrawerByKey('balanceHistory'); });
    document.getElementById('openTradeHistoryFromMenu').addEventListener('click', () => { menu.classList.remove('open'); openDrawerByKey('history'); });

    renderProfile();
  }

  /* ================= Status bar ================= */
  function initStatusBar(){
    const clock = document.getElementById('statusClock');
    setInterval(() => {
      clock.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);

    const soundBtn = document.getElementById('soundBtn');
    soundBtn.classList.toggle('active', prefs.sound);
    soundBtn.addEventListener('click', () => setSoundPref(!prefs.sound));

    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
  }

  function savePrefs(){ localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); }
  function setSoundPref(v){
    prefs.sound = v;
    savePrefs();
    document.getElementById('soundBtn')?.classList.toggle('active', v);
    document.getElementById('settingsSoundToggle')?.classList.toggle('active', v);
  }

  let audioCtx;
  function playBeep(win){
    if (!prefs.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = win ? 880 : 220;
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) { /* audio not available, safe to ignore */ }
  }

  /* ================= Timeframe buttons ================= */
  function initTimeframes(){
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (pending) return toast('warn', 'Operação em andamento', 'Aguarde o fim da operação atual para trocar o timeframe.');
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const map = { '1m': 60, '5m': 300, '15m': 900 };
        const step = map[btn.dataset.tf] || 60;
        const sym = symbolById(activeId);
        symbolState[activeId] = { sym, candles: VenaxSim.genCandles(sym, 140, step), tickCount: 0, stepSeconds: step };
        loadActiveSymbol();
      });
    });
  }

  /* ================= Toast helper ================= */
  function toast(type, title, text){
    VenaxUI.toast(toastStack, { type: type === 'warn' ? 'lose' : type, title, text });
  }

  /* ================= Wire up controls ================= */
  function initControls(){
    document.getElementById('amountMinus').addEventListener('click', () => setAmount(amount - 10));
    document.getElementById('amountPlus').addEventListener('click', () => setAmount(amount + 10));
    document.getElementById('amountInput').addEventListener('change', (e) => setAmount(Number(e.target.value) || 10));
    document.querySelectorAll('.amount-presets button').forEach(btn => {
      btn.addEventListener('click', () => setAmount(Number(btn.dataset.amt)));
    });

    document.getElementById('expMinus').addEventListener('click', () => { expIdx = Math.max(0, expIdx - 1); renderExp(); });
    document.getElementById('expPlus').addEventListener('click', () => { expIdx = Math.min(EXP_STEPS.length - 1, expIdx + 1); renderExp(); });

    document.getElementById('btnHigher').addEventListener('click', () => placeTrade('higher'));
    document.getElementById('btnLower').addEventListener('click', () => placeTrade('lower'));
  }

  /* ================= Boot ================= */
  ensureSymbolState(activeId);
  initChart();
  renderTabs();
  loadActiveSymbol();
  initTimeframes();
  initControls();
  initDrawers();
  initDeposit();
  initWithdraw();
  initPersonalData();
  initSettings();
  initAccountMenu();
  initStatusBar();
  renderAmount();
  renderExp();
  renderBalance();
  renderHistory();
  renderPortfolio();

  setInterval(tick, 1000);
});
