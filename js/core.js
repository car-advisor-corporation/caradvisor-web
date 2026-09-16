/* Car Advisor — shared runtime for every page: language, header/drawer, WhatsApp links,
   helpers. Page scripts load after this file and register renderers with CA.onLang(fn). */
(() => {
  'use strict';

  // WhatsApp: same number the live site's widget uses (the office line). Confirm before launch.
  const CONFIG = { whatsapp: '13056006112', videoId: 'FmOcNzs98R4', apr: 6.9, term: 72, downPct: 0.1 };
  const I18N = window.CA_I18N || { es: {}, dyn: { en: {}, es: {} } };
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(v || 0));
  const num = v => { const n = parseFloat(v && typeof v === 'object' ? v.value : v); return Number.isFinite(n) && n > 0 ? n : 0; };
  function payment(principal, apr, months) {
    if (!principal || !months) return 0;
    const r = apr / 1200;
    return r ? principal * r / (1 - Math.pow(1 + r, -months)) : principal / months;
  }

  /* ---------- Language ---------- */
  // English is authored in the HTML; capture it once so we can switch back.
  const EN_TEXT = {};
  const EN_ATTR = {};
  const attrPairs = el => el.dataset.i18nAttr.split('|').map(p => p.split(':'));
  $$('[data-i18n]').forEach(el => { if (!(el.dataset.i18n in EN_TEXT)) EN_TEXT[el.dataset.i18n] = el.innerHTML; });
  $$('[data-i18n-attr]').forEach(el => attrPairs(el).forEach(([attr, key]) => { if (!(key in EN_ATTR)) EN_ATTR[key] = el.getAttribute(attr); }));

  let lang = 'en';
  const listeners = [];
  function t(key, vars) {
    const pack = I18N.dyn[lang] || {};
    let s = key in pack ? pack[key] : (key in I18N.dyn.en ? I18N.dyn.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  }
  function translate() {
    const dict = lang === 'es' ? I18N.es : {};
    $$('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      const v = k in dict ? dict[k] : EN_TEXT[k];
      if (v != null && el.innerHTML !== v) el.innerHTML = v;
    });
    $$('[data-i18n-attr]').forEach(el => attrPairs(el).forEach(([attr, key]) => {
      const v = key in dict ? dict[key] : EN_ATTR[key];
      if (v != null) el.setAttribute(attr, v);
    }));
  }
  function setLang(next) {
    lang = next === 'es' ? 'es' : 'en';
    root.lang = lang;
    translate();
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    store.set('ca-lang', lang);
    updateWaLinks();
    listeners.forEach(fn => { try { fn(lang); } catch (err) { console.error(err); } });
  }
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ---------- WhatsApp ---------- */
  const waHref = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  function updateWaLinks() { $$('[data-wa]').forEach(a => { a.href = waHref(t(a.dataset.wa || 'wa.hello')); }); }

  /* ---------- Header + mobile drawer ---------- */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = $('.menu-btn');
  const nav = $('#nav');
  const backdrop = $('.nav-backdrop');
  // While the drawer is open, everything it covers is inert, so Tab stays in the drawer and header.
  const behindMenu = () => $$('main, .site-footer, .mbar, .wa-float');
  function setMenu(open, restoreFocus) {
    menuBtn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    backdrop.classList.toggle('show', open);
    document.body.classList.toggle('no-scroll', open);
    behindMenu().forEach(el => { el.inert = open; });
    if (open) {
      const first = nav.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    } else if (restoreFocus) {
      menuBtn.focus();
    }
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true', true));
  backdrop.addEventListener('click', () => setMenu(false, true));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false, true);
  });
  window.matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) setMenu(false, false); });

  /* ---------- Misc ---------- */
  const ART = { suv: 'suv', sedan: 'sedan', hatch: 'hatch', pickup: 'pickup', minivan: 'minivan', coupe: 'coupe', convertible: 'coupe', wagon: 'hatch' };
  const fallbackArt = body => `<svg class="fallback-art" viewBox="0 0 240 96" aria-hidden="true" focusable="false"><use href="#car-${ART[body] || 'sedan'}"/></svg>`;
  function imgFail(img, body) { img.insertAdjacentHTML('afterend', fallbackArt(body)); img.remove(); }

  // Browsers without cross-document view transitions still slide the page in on internal navigation.
  if (!('onpagereveal' in window) && !reducedMotion && document.referrer.startsWith(window.location.origin)) {
    root.classList.add('vt-fallback');
  }

  window.CA = {
    CONFIG, $, $$, t, esc, usd, num, payment, store, waHref, reducedMotion, imgFail, fallbackArt,
    lang: () => lang,
    onLang(fn) { listeners.push(fn); },
  };

  const params = new URLSearchParams(window.location.search);
  const browserEs = (navigator.language || '').toLowerCase().startsWith('es');
  const initial = params.get('lang') || store.get('ca-lang') || (browserEs ? 'es' : 'en');
  document.addEventListener('DOMContentLoaded', () => setLang(initial));
})();

/* El año del pie se pone solo, para que no envejezca. */
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
