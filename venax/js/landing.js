/* ============================================================
   Venax — Landing page interactions
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('year').textContent = new Date().getFullYear();

  VenaxUI.initScrollProgress('scrollProgress');
  VenaxUI.initHeaderScroll('header');
  VenaxUI.initReveal();
  VenaxUI.initCounters();

  initMobileNav();
  initMiniCharts();
  initMarkets();
  initFaq();
  initLoginModal();

  /* ---------------- Mobile nav ---------------- */
  function initMobileNav(){
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------------- Mini candle charts (hero + showcase) ---------------- */
  function renderMiniCandles(canvas, candles){
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const max = Math.max(...highs), min = Math.min(...lows);
    const pad = (max - min) * 0.12 || 1;
    const top = max + pad, bottom = min - pad;
    const range = top - bottom || 1;
    const y = v => h - ((v - bottom) / range) * h;

    const n = candles.length;
    const slot = w / n;
    const bodyW = Math.max(slot * 0.5, 1.5);

    candles.forEach((c, i) => {
      const x = i * slot + slot / 2;
      const up = c.close >= c.open;
      ctx.strokeStyle = up ? '#00e39a' : '#ff4d5e';
      ctx.fillStyle = up ? '#00e39a' : '#ff4d5e';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y(c.high));
      ctx.lineTo(x, y(c.low));
      ctx.stroke();
      const oy = y(c.open), cy = y(c.close);
      const bh = Math.max(Math.abs(cy - oy), 1.5);
      ctx.fillRect(x - bodyW / 2, Math.min(oy, cy), bodyW, bh);
    });
    ctx.globalAlpha = 1;
  }

  function initMiniCharts(){
    const configs = [
      { canvas: 'heroChartLaptop', price: 'heroPriceLaptop', symbol: VenaxSim.SYMBOLS.find(s => s.id === 'GBPJPY') },
      { canvas: 'heroChartPhone', price: 'heroPricePhone', symbol: VenaxSim.SYMBOLS.find(s => s.id === 'BTCUSD') },
      { canvas: 'heroChartShowcase', price: 'heroPriceShowcase', symbol: VenaxSim.SYMBOLS.find(s => s.id === 'EURUSD') },
    ];

    configs.forEach(cfg => {
      const canvas = document.getElementById(cfg.canvas);
      const priceEl = document.getElementById(cfg.price);
      if (!canvas || !cfg.symbol) return;
      let candles = VenaxSim.genCandles(cfg.symbol, 34, 60);
      const draw = () => renderMiniCandles(canvas, candles);
      draw();
      window.addEventListener('resize', debounce(draw, 150));

      setInterval(() => {
        const last = candles[candles.length - 1];
        const np = VenaxSim.nextPrice(last.close, cfg.symbol.vol);
        last.close = np;
        last.high = Math.max(last.high, np);
        last.low = Math.min(last.low, np);
        if (Math.random() < 0.18){
          candles.shift();
          candles.push({ time: last.time + 60, open: np, high: np, low: np, close: np });
        }
        draw();
        if (priceEl) priceEl.textContent = VenaxSim.formatPrice(np, cfg.symbol.decimals);
      }, 900);
    });
  }

  function debounce(fn, wait){
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  /* ---------------- Markets table ---------------- */
  function initMarkets(){
    const wrap = document.getElementById('mktRows');
    if (!wrap) return;

    const state = VenaxSim.SYMBOLS.map(sym => {
      const candles = VenaxSim.genCandles(sym, 20, 300);
      const price = candles[candles.length - 1].close;
      const openPrice = candles[0].open;
      return { sym, candles, price, openPrice };
    });

    function pctChange(s){ return ((s.price - s.openPrice) / s.openPrice) * 100; }

    function sparkPath(candles, w = 90, h = 30){
      const vals = candles.map(c => c.close);
      const max = Math.max(...vals), min = Math.min(...vals);
      const range = (max - min) || 1;
      return vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    }

    function render(){
      wrap.innerHTML = state.map((s, idx) => {
        const chg = pctChange(s);
        const up = chg >= 0;
        return `
        <div class="mkt-row" data-group="${s.sym.group}" data-idx="${idx}">
          <div class="mkt-name">
            <span class="mkt-ic">${s.sym.flag}</span>
            <span>${s.sym.name}<span class="mkt-sub"> · ${labelGroup(s.sym.group)}</span></span>
          </div>
          <span class="mkt-price mono">${VenaxSim.formatPrice(s.price, s.sym.decimals)}</span>
          <span class="mkt-change mono ${up ? 'up' : 'down'}">${up ? '+' : ''}${chg.toFixed(2)}%</span>
          <svg class="mkt-spark" viewBox="0 0 90 30" preserveAspectRatio="none">
            <path d="${sparkPath(s.candles)}" fill="none" stroke="${up ? '#00e39a' : '#ff4d5e'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <a href="plataforma.html" class="btn btn-sm btn-outline mkt-cta">Negociar</a>
        </div>`;
      }).join('');
    }

    function labelGroup(g){
      return { forex: 'Forex', cripto: 'Cripto', indices: 'Índices', commodities: 'Commodities' }[g] || g;
    }

    render();

    document.querySelectorAll('.mkt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mkt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        document.querySelectorAll('.mkt-row:not(.head)').forEach(row => {
          row.style.display = (filter === 'all' || row.dataset.group === filter) ? '' : 'none';
        });
      });
    });

    setInterval(() => {
      state.forEach(s => {
        s.price = VenaxSim.nextPrice(s.price, s.sym.vol);
        const c = s.candles[s.candles.length - 1];
        c.close = s.price;
        c.high = Math.max(c.high, s.price);
        c.low = Math.min(c.low, s.price);
      });
      const activeFilter = document.querySelector('.mkt-tab.active')?.dataset.filter || 'all';
      render();
      document.querySelectorAll('.mkt-row:not(.head)').forEach(row => {
        row.style.display = (activeFilter === 'all' || row.dataset.group === activeFilter) ? '' : 'none';
      });
    }, 2400);
  }

  /* ---------------- FAQ accordion ---------------- */
  function initFaq(){
    document.querySelectorAll('.faq-item').forEach(item => {
      const q = item.querySelector('.faq-q');
      const a = item.querySelector('.faq-a');
      q.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(other => {
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = null;
        });
        if (!isOpen){
          item.classList.add('open');
          a.style.maxHeight = a.scrollHeight + 'px';
        }
      });
    });
  }

  /* ---------------- Login modal (demo only) ---------------- */
  function initLoginModal(){
    const modal = document.getElementById('loginModal');
    const openBtn = document.getElementById('loginBtn');
    const closeBtn = document.getElementById('loginClose');
    const form = document.getElementById('loginForm');
    if (!modal || !openBtn) return;

    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      window.location.href = 'plataforma.html';
    });
  }
});
