const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Menu mobile
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');

navToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Header background on scroll
const header = document.getElementById('header');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 20);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Typewriter effect in hero code window
const codeLines = [
  "const cliente = 'você';",
  "",
  "function criarSite(ideia) {",
  "  return site",
  "    .comDesign('profissional')",
  "    .comVelocidade('alta')",
  "    .publicar();",
  "}",
  "",
  "criarSite(ideia); // 🚀 no ar"
];
const fullCode = codeLines.join('\n');
const typedCodeEl = document.getElementById('typedCode');

function typeLoop() {
  if (prefersReducedMotion) {
    typedCodeEl.textContent = fullCode;
    return;
  }
  let i = 0;
  const typeSpeed = 28;
  const holdTime = 2200;
  const deleteSpeed = 10;

  function type() {
    if (i <= fullCode.length) {
      typedCodeEl.textContent = fullCode.slice(0, i);
      i++;
      setTimeout(type, typeSpeed);
    } else {
      setTimeout(erase, holdTime);
    }
  }
  function erase() {
    if (i > 0) {
      i--;
      typedCodeEl.textContent = fullCode.slice(0, i);
      setTimeout(erase, deleteSpeed);
    } else {
      setTimeout(type, 400);
    }
  }
  type();
}
typeLoop();

// GSAP animations (progressive enhancement: content stays visible if GSAP fails to load)
if (window.gsap) {
  document.documentElement.classList.add('gsap-ready');
  gsap.registerPlugin(ScrollTrigger);

  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  heroTl
    .to('.hero .eyebrow', { opacity: 1, y: 0, duration: 0.6 })
    .to('.hero h1', { opacity: 1, y: 0, duration: 0.7 }, '-=0.4')
    .to('.hero-lead', { opacity: 1, y: 0, duration: 0.7 }, '-=0.5')
    .to('.hero-actions', { opacity: 1, y: 0, duration: 0.6 }, '-=0.5')
    .to('.hero-highlights', { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
    .to('.hero-visual', { opacity: 1, y: 0, duration: 0.8 }, '-=0.6');

  gsap.to('.blob-1', {
    y: 40, x: 20, duration: 8, ease: 'sine.inOut', repeat: -1, yoyo: true
  });
  gsap.to('.blob-2', {
    y: -30, x: -20, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true
  });

  document.querySelectorAll('.reveal:not(.hero .reveal)').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
      }
    });
  });

  gsap.to('#timelineProgress', {
    height: '100%',
    ease: 'none',
    scrollTrigger: {
      trigger: '.timeline',
      start: 'top 70%',
      end: 'bottom 80%',
      scrub: 0.6,
    }
  });
}

// Contact form -> builds a WhatsApp message
const contatoForm = document.getElementById('contatoForm');
contatoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const servico = document.getElementById('servico').value;
  const mensagem = document.getElementById('mensagem').value.trim();

  const texto = `Olá! Me chamo ${nome}. Tenho interesse em: ${servico}.\n\n${mensagem}`;
  const url = `https://wa.me/5581991976644?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener');
});
