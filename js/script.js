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

// Scroll progress bar
const scrollProgressEl = document.getElementById('scrollProgress');
const updateScrollProgress = () => {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
  scrollProgressEl.style.width = pct + '%';
};
updateScrollProgress();
window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', updateScrollProgress);

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Rotating sales phrases next to the hero logo
const rotatorPhrases = [
  "Transforme visitantes em clientes.",
  "Seu negócio merece estar na internet.",
  "Presença profissional, sem complicação.",
  "Enquanto seu site não existe, seu concorrente já vende.",
  "Design que gera confiança."
];
const rotatorEl = document.getElementById('rotatorText');
let rotatorIndex = 0;
rotatorEl.textContent = rotatorPhrases[0];

if (!prefersReducedMotion) {
  setInterval(() => {
    rotatorEl.style.opacity = '0';
    setTimeout(() => {
      rotatorIndex = (rotatorIndex + 1) % rotatorPhrases.length;
      rotatorEl.textContent = rotatorPhrases[rotatorIndex];
      rotatorEl.style.opacity = '1';
    }, 350);
  }, 3200);
}

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

  // Premium pointer interactions: custom cursor, magnetic buttons, 3D tilt cards,
  // hero parallax. Fine pointers only, and only enabled once fully wired up so a
  // failure here never leaves the visitor without a visible cursor.
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (hasFinePointer && !prefersReducedMotion) {
    try {
      const cursorDot = document.getElementById('cursorDot');
      const cursorRing = document.getElementById('cursorRing');
      const moveDotX = gsap.quickTo(cursorDot, 'x', { duration: 0.01 });
      const moveDotY = gsap.quickTo(cursorDot, 'y', { duration: 0.01 });
      const moveRingX = gsap.quickTo(cursorRing, 'x', { duration: 0.35, ease: 'power3' });
      const moveRingY = gsap.quickTo(cursorRing, 'y', { duration: 0.35, ease: 'power3' });

      window.addEventListener('mousemove', (e) => {
        moveDotX(e.clientX);
        moveDotY(e.clientY);
        moveRingX(e.clientX);
        moveRingY(e.clientY);
      });

      document.querySelectorAll('a, button, .card, input, select, textarea').forEach(el => {
        el.addEventListener('mouseenter', () => cursorRing.classList.add('is-active'));
        el.addEventListener('mouseleave', () => cursorRing.classList.remove('is-active'));
      });

      document.body.classList.add('cursor-ready');

      // Magnetic pull on the large call-to-action buttons
      document.querySelectorAll('.btn-lg').forEach(btn => {
        const moveX = gsap.quickTo(btn, 'x', { duration: 0.3, ease: 'power3' });
        const moveY = gsap.quickTo(btn, 'y', { duration: 0.3, ease: 'power3' });
        btn.addEventListener('mousemove', (e) => {
          const rect = btn.getBoundingClientRect();
          moveX((e.clientX - rect.left - rect.width / 2) * 0.3);
          moveY((e.clientY - rect.top - rect.height / 2) * 0.3);
        });
        btn.addEventListener('mouseleave', () => { moveX(0); moveY(0); });
      });

      // 3D tilt on service cards
      document.querySelectorAll('.card').forEach(card => {
        const rotX = gsap.quickTo(card, 'rotationX', { duration: 0.4, ease: 'power3' });
        const rotY = gsap.quickTo(card, 'rotationY', { duration: 0.4, ease: 'power3' });
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const relX = (e.clientX - rect.left) / rect.width - 0.5;
          const relY = (e.clientY - rect.top) / rect.height - 0.5;
          rotY(relX * 12);
          rotX(relY * -12);
        });
        card.addEventListener('mouseleave', () => { rotX(0); rotY(0); });
      });

      // Hero background parallax (applied to the whole layer, not the ambient-floating blobs)
      const heroBg = document.querySelector('.hero-bg');
      const heroSection = document.querySelector('.hero');
      if (heroBg && heroSection) {
        const parallaxX = gsap.quickTo(heroBg, 'x', { duration: 0.6, ease: 'power2' });
        const parallaxY = gsap.quickTo(heroBg, 'y', { duration: 0.6, ease: 'power2' });
        heroSection.addEventListener('mousemove', (e) => {
          const rect = heroSection.getBoundingClientRect();
          parallaxX(((e.clientX - rect.left) / rect.width - 0.5) * 24);
          parallaxY(((e.clientY - rect.top) / rect.height - 0.5) * 24);
        });
        heroSection.addEventListener('mouseleave', () => { parallaxX(0); parallaxY(0); });
      }
    } catch (err) {
      document.body.classList.remove('cursor-ready');
    }
  }
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
