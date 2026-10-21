(function () {
  "use strict";
  var CFG = window.ACHADOS_CONFIG || {};
  var doc = document;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  /* ---------- Links do WhatsApp ---------- */
  var waUrl = typeof CFG.whatsappUrl === "string" ? CFG.whatsappUrl.trim() : "";
  var waOk = /^https:\/\/(chat\.whatsapp\.com|wa\.me)\//.test(waUrl);
  $$("[data-wa]").forEach(function (a) {
    if (waOk) {
      a.href = waUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      a.hidden = true;
    }
  });

  /* ---------- Ano ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Header ---------- */
  var header = doc.querySelector(".header");
  var sticky = doc.querySelector("[data-sticky]");
  var hero = doc.querySelector("#hero-cta");
  var finalCta = doc.querySelector("#final-cta");
  var footer = doc.querySelector(".footer");

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal / passos ---------- */
  var revealEls = $$(".reveal").concat($$("ol[data-steps]"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Sticky CTA ---------- */
  var heroGone = false, endVisible = false;
  function updateSticky() {
    if (sticky) sticky.classList.toggle("is-visible", waOk && heroGone && !endVisible);
  }
  if ("IntersectionObserver" in window) {
    if (hero) {
      new IntersectionObserver(function (en) {
        var e = en[en.length - 1];
        heroGone = !e.isIntersecting && e.boundingClientRect.bottom < 0;
        updateSticky();
      }).observe(hero);
    }
    var seen = [];
    var endIO = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        var i = seen.indexOf(e.target);
        if (e.isIntersecting && i < 0) seen.push(e.target);
        if (!e.isIntersecting && i >= 0) seen.splice(i, 1);
      });
      endVisible = seen.length > 0;
      updateSticky();
    });
    if (finalCta) endIO.observe(finalCta);
    if (footer) endIO.observe(footer);
  } else {
    heroGone = true;
    updateSticky();
  }

  /* ---------- FAQ ---------- */
  var qs = $$(".faq__q");
  function setOpen(btn, open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    var item = btn.closest(".faq__item");
    if (item) item.classList.toggle("is-open", open);
  }
  qs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var willOpen = btn.getAttribute("aria-expanded") !== "true";
      qs.forEach(function (o) { setOpen(o, false); });
      setOpen(btn, willOpen);
    });
  });

  /* ---------- Ofertas reais no celular ---------- */
  function brl(n) {
    return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var offers = Array.isArray(CFG.offers) ? CFG.offers.filter(function (o) {
    return o && o.name && typeof o.price === "number" && o.price > 0;
  }).slice(0, 2) : [];
  if (offers.length) {
    $$("[data-offers]").forEach(function (box) {
      while (box.firstChild) box.removeChild(box.firstChild);
      offers.forEach(function (o) {
        var card = el("div", "offer");
        var img = el("div", "offer__img");
        var ns = "http://www.w3.org/2000/svg";
        var svg = doc.createElementNS(ns, "svg");
        svg.setAttribute("class", "ico");
        svg.setAttribute("aria-hidden", "true");
        var use = doc.createElementNS(ns, "use");
        use.setAttribute("href", "#i-bag");
        svg.appendChild(use);
        img.appendChild(svg);
        card.appendChild(img);
        card.appendChild(el("p", "offer__name", String(o.name)));
        var hasOld = typeof o.oldPrice === "number" && o.oldPrice > o.price;
        if (hasOld) card.appendChild(el("p", "offer__old", "De " + brl(o.oldPrice)));
        var p = el("p", "offer__price", "Por " + brl(o.price));
        if (hasOld) p.appendChild(el("span", "offer__off", Math.round((1 - o.price / o.oldPrice) * 100) + "% OFF"));
        card.appendChild(p);
        if (o.coupon) {
          var c = el("p", "offer__coupon", "Cupom: ");
          c.appendChild(el("code", "", String(o.coupon)));
          card.appendChild(c);
        }
        card.appendChild(el("span", "offer__btn", o.store ? "Ver oferta · " + o.store : "Ver oferta"));
        box.appendChild(card);
      });
      var tag = box.parentNode.querySelector(".wa-tag");
      if (tag) tag.textContent = "OFERTAS DO MOMENTO";
    });
  }

  /* ---------- UTM (sem dados pessoais) ---------- */
  var utm = {};
  try {
    var qp = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
      var v = qp.get(k);
      if (v) utm[k] = v.slice(0, 100);
    });
    if (qp.has("fbclid")) utm.fbclid = 1;
    if (qp.has("ttclid")) utm.ttclid = 1;
    if (Object.keys(utm).length) sessionStorage.setItem("achados_utm", JSON.stringify(utm));
    else utm = JSON.parse(sessionStorage.getItem("achados_utm") || "{}") || {};
  } catch (e) { /* storage indisponível */ }

  /* ---------- Rastreamento opcional (respeita GPC/DNT) ---------- */
  var noTrack = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  var metaId = String(CFG.metaPixelId || "").replace(/\D/g, "");
  var ttId = /^[A-Za-z0-9]{6,32}$/.test(CFG.tiktokPixelId || "") ? CFG.tiktokPixelId : "";
  var gaId = /^G-[A-Z0-9]{4,20}$/.test(CFG.ga4Id || "") ? CFG.ga4Id : "";

  function loadScript(src) {
    var s = doc.createElement("script");
    s.async = true;
    s.src = src;
    doc.head.appendChild(s);
  }

  if (!noTrack) {
    if (metaId) {
      var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
      if (!window._fbq) window._fbq = f;
      f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
      f("init", metaId);
      f("track", "PageView");
    }
    if (ttId) {
      var ttq = window.ttq = window.ttq || [];
      ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"].forEach(function (m) {
        ttq[m] = function () { var a = Array.prototype.slice.call(arguments); a.unshift(m); ttq.push(a); return ttq; };
      });
      loadScript("https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + encodeURIComponent(ttId) + "&lib=ttq");
      ttq.push(["page"]);
    }
    if (gaId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", gaId);
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId));
    }
  }

  // O evento é o CLIQUE no botão (não a entrada confirmada no grupo).
  doc.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("[data-wa]");
    if (!a || noTrack) return;
    var loc = a.getAttribute("data-loc") || "";
    var params = { location: loc };
    Object.keys(utm).forEach(function (k) { params[k] = utm[k]; });
    try {
      if (metaId && window.fbq) window.fbq("trackCustom", "WhatsAppClick", params);
      if (ttId && window.ttq) window.ttq.track("ClickButton", { description: "whatsapp_" + loc });
      if (gaId && window.gtag) window.gtag("event", "whatsapp_click", params);
    } catch (e) { /* nunca bloqueia o clique */ }
  });
})();
