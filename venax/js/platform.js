/* ============================================================
   Venax — Motor da plataforma de negociação (100% simulado)
   Nenhum dado real de mercado, pagamento ou saldo é processado.
   Tudo roda localmente no navegador, com localStorage.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const LS_BALANCE = 'venax_balance';
  const LS_HISTORY = 'venax_history';
  const START_BALANCE = 10000;

  const EXP_STEPS = [15, 30, 60, 120, 300];
  const PROFIT_MAP = { 15: 78, 30: 87, 60: 91, 120: 94, 300: 96 };

  const DEFAULT_TABS = ['EURUSD', 'GBPJPY', 'BTCUSD'];

  const toastStack = document.getElementById('toastStack');

  /* ================= State ================= */
  let balance = Number(localStorage.getItem(LS_BALANCE)) || START_BALANCE;
  let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  let openTabs = [...DEFAULT_TABS];
  let activeId = openTabs[0];
  let amount = 100;
  let expIdx = 1; // 30s
  let pending = null; // { direction, amount, entryPrice, endsAt, priceLine }
  let soundOn = true;
  let chart, candleSeries;
  const symbolState = {}; // id -> { sym, candles, tickCount }

  /* ================= Persistence ================= */
  function saveBalance(){ localStorage.setItem(LS_BALANCE, String(balance)); }
  function saveHistory(){ localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(-60))); }

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

  function initChart(){
    const container = document.getElementById('priceChart');
    chart = LightweightCharts.createChart(container, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9aa8b1', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.045)' }, horzLines: { color: 'rgba(255,255,255,0.045)' } },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      autoSize: false,
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: '#00e39a', downColor: '#ff4d5e', borderVisible: false,
      wickUpColor: '#00e39a', wickDownColor: '#ff4d5e',
    });

    const stage = container.parentElement;
    const resize = () => chart.applyOptions({ width: stage.clientWidth, height: stage.clientHeight });
    new ResizeObserver(resize).observe(stage);
    resize();
  }

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
    chart.timeScale().fitContent();
    updateSymbolHeader();
    randomizeProbabilities();
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
    candleSeries.update(last);
    st.tickCount++;

    if (st.tickCount % 5 === 0){
      const newCandle = { time: last.time + st.stepSeconds, open: np, high: np, low: np, close: np };
      st.candles.push(newCandle);
      if (st.candles.length > 220) st.candles.shift();
      candleSeries.update(newCandle);
    }
    updateSymbolHeader();

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

    if (delta > 0) setBalance(balance + delta);

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
  function initDrawers(){
    const drawers = { portfolio: document.getElementById('drawerPortfolio'), history: document.getElementById('drawerHistory'), analysis: document.getElementById('drawerAnalysis'), help: document.getElementById('drawerHelp') };
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
        btn.classList.add('active');
        if (key === 'analysis') renderAnalysis();
        if (key === 'portfolio') renderPortfolio();
        if (key === 'history') renderHistory();
      }
    }
    sideBtns.forEach(btn => btn.addEventListener('click', () => open(btn.dataset.drawer, btn)));
    document.querySelectorAll('.drawer-close').forEach(btn => btn.addEventListener('click', closeAll));
  }

  /* ================= Deposit modal ================= */
  function initDeposit(){
    const modal = document.getElementById('depositModal');
    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');
    document.getElementById('depositBtn').addEventListener('click', open);
    document.getElementById('depositClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.querySelectorAll('.deposit-presets button').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = Number(btn.dataset.dep);
        setBalance(balance + v);
        toast('win', 'Saldo demo adicionado', `+${VenaxUI.formatBRL(v)} adicionados à sua conta demo.`);
        close();
      });
    });
    document.getElementById('depositConfirm').addEventListener('click', () => {
      const input = document.getElementById('depositCustom');
      const v = Number(input.value);
      if (!v || v <= 0) return toast('warn', 'Valor inválido', 'Informe um valor demo maior que zero.');
      setBalance(balance + v);
      toast('win', 'Saldo demo adicionado', `+${VenaxUI.formatBRL(v)} adicionados à sua conta demo.`);
      input.value = '';
      close();
    });
  }

  /* ================= Account menu ================= */
  function initAccountMenu(){
    const menu = document.getElementById('accountMenu');
    const btn = document.getElementById('balanceBtn');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', () => menu.classList.remove('open'));
    document.getElementById('resetBalanceBtn').addEventListener('click', () => {
      if (pending) return toast('warn', 'Operação em andamento', 'Aguarde o fim da operação atual.');
      if (!confirm('Reiniciar o saldo demo para R$ 10.000,00 e apagar o histórico local?')) return;
      setBalance(START_BALANCE);
      history = [];
      saveHistory();
      renderHistory();
      renderPortfolio();
      toast('win', 'Saldo reiniciado', 'Sua conta demo voltou para R$ 10.000,00.');
      menu.classList.remove('open');
    });
  }

  /* ================= Status bar ================= */
  function initStatusBar(){
    const clock = document.getElementById('statusClock');
    setInterval(() => {
      clock.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);

    const soundBtn = document.getElementById('soundBtn');
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      soundBtn.classList.toggle('active', soundOn);
    });

    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
  }

  let audioCtx;
  function playBeep(win){
    if (!soundOn) return;
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
  initAccountMenu();
  initStatusBar();
  renderAmount();
  renderExp();
  renderBalance();
  renderHistory();
  renderPortfolio();

  setInterval(tick, 1000);
});
