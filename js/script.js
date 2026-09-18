// Menu mobile
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');

navToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen);
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Abas do cardápio
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.menu-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    panels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// Ano no rodapé
document.getElementById('year').textContent = new Date().getFullYear();

// Status aberto/fechado (todos os dias, 08h às 17h)
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
if (statusBadge && statusText) {
  const hour = new Date().getHours();
  const isOpen = hour >= 8 && hour < 17;
  statusBadge.classList.add(isOpen ? 'is-open' : 'is-closed');
  statusText.textContent = isOpen
    ? 'Aberto agora · até às 17h'
    : 'Fechado no momento · abrimos às 8h';
}
