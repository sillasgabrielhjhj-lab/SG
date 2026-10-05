/*
 * Service worker mínimo da Mercatto.
 * - Pré-armazena SOMENTE a página offline e ícones.
 * - Navegações: rede primeiro; sem rede, mostra /offline.html.
 * - NUNCA armazena páginas privadas, APIs, checkout ou respostas de POST.
 */
const CACHE = "mercatto-static-v1";
const PRECACHE = ["/offline.html", "/icons/192", "/icons/512"];
const PRIVATE = /^\/(minha-conta|vendedor|admin|checkout|carrinho|api|entrar|cadastro)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Páginas sempre da rede (dados de preço/estoque mudam); offline => fallback.
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (PRIVATE.test(url.pathname)) return;
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
