'use strict';

(function () {
  const header = document.querySelector('.lp-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const form = document.getElementById('calc');
  const price = Number(form.dataset.priceCents) || 0;
  const sales = document.getElementById('calc-sales');
  const fee = document.getElementById('calc-fee');
  const month = document.getElementById('calc-month');
  const year = document.getElementById('calc-year');

  function update() {
    const salesCents = parseMoney(sales.value) || 0;
    const pct = Math.min(Math.max(Number.parseFloat(String(fee.value).replace(',', '.')) || 0, 0), 100);
    const commission = Math.round((salesCents * pct) / 100);
    month.textContent = money(commission);
    year.textContent = money(Math.max(0, (commission - price) * 12));
  }

  form.addEventListener('input', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  update();
})();
