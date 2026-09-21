/* ============================================================
   Venax — utilidades de UI compartilhadas
   ============================================================ */

const VenaxUI = (() => {

  function initScrollProgress(barId = 'scrollProgress'){
    const bar = document.getElementById(barId);
    if (!bar) return;
    const onScroll = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = max > 0 ? `${(scrolled / max) * 100}%` : '0%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initHeaderScroll(headerId = 'header', threshold = 30){
    const header = document.getElementById(headerId);
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReveal(selector = '.reveal'){
    const items = document.querySelectorAll(selector);
    if (!items.length) return;
    if (!('IntersectionObserver' in window)){
      items.forEach(el => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting){
          setTimeout(() => entry.target.classList.add('in-view'), (i % 6) * 70);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
  }

  function toast(stackEl, { type = 'win', title, text, ms = 5200 } = {}){
    if (!stackEl) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-dot"></span>
      <div>
        <strong>${title}</strong>
        <p>${text}</p>
      </div>`;
    stackEl.appendChild(el);
    const remove = () => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    };
    setTimeout(remove, ms);
    el.addEventListener('click', remove);
  }

  function formatBRL(v){
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function animateCount(el, target, decimals = 0, duration = 1600){
    const start = performance.now();
    const from = 0;
    function step(now){
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = from + (target - from) * eased;
      el.textContent = decimals > 0
        ? val.toFixed(decimals).replace('.', ',')
        : Math.round(val).toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = decimals > 0 ? target.toFixed(decimals).replace('.', ',') : target.toLocaleString('pt-BR');
    }
    requestAnimationFrame(step);
  }

  function initCounters(selector = '[data-count]'){
    const items = document.querySelectorAll(selector);
    if (!items.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          const el = entry.target;
          const target = parseFloat(el.dataset.count);
          const decimals = parseInt(el.dataset.decimals || '0', 10);
          animateCount(el, target, decimals);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    items.forEach(el => io.observe(el));
  }

  return { initScrollProgress, initHeaderScroll, initReveal, toast, formatBRL, animateCount, initCounters };
})();
