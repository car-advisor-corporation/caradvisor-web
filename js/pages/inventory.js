/* Inventory: facet filters, search, sort, pagination and URL state for the demo inventory. */
(() => {
  'use strict';
  const { $, $$, t, esc, usd, onLang, reducedMotion } = window.CA;
  const V = window.CA.vehicles;
  const PER_PAGE = 12;
  const LISTS = ['cond', 'body', 'make', 'fuel'];
  const RANGES = ['pmin', 'pmax', 'ymin', 'ymax', 'miles'];
  const ORDER = {
    cond: ['new', 'cert', 'used'],
    body: ['suv', 'sedan', 'pickup', 'coupe', 'hatch', 'minivan', 'convertible', 'wagon'],
    fuel: ['gas', 'hybrid', 'phev', 'electric', 'diesel'],
  };
  const SORTS = {
    rec: (a, b) => a.rank - b.rank,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    'year-desc': (a, b) => b.year - a.year || a.miles - b.miles,
    'miles-asc': (a, b) => a.miles - b.miles,
  };
  const all = V.list;
  all.forEach((v, i) => { v.rank = i; });
  const makes = [...new Set(all.map(v => v.make))].sort((a, b) => a.localeCompare(b));
  const years = [...new Set(all.map(v => v.year))].sort((a, b) => b - a);
  const present = key => ORDER[key].filter(x => all.some(v => v[key] === x));
  const ALLOWED = { cond: ORDER.cond, body: ORDER.body, fuel: ORDER.fuel, make: makes };
  const session = {
    set(v) { try { window.sessionStorage.setItem('ca-inv-query', v); } catch (e) { /* storage unavailable */ } },
  };

  // State comes from the URL, so filtered views can be shared and survive the trip to a vehicle page.
  // Values are checked against what the data allows; anything else from a stale or edited link is dropped.
  const state = { q: '', cond: [], body: [], make: [], fuel: [], pmin: '', pmax: '', ymin: '', ymax: '', miles: '', sort: 'rec', page: 1 };
  (() => {
    const p = new URLSearchParams(window.location.search);
    state.q = (p.get('q') || '').slice(0, 60);
    LISTS.forEach(k => { state[k] = (p.get(k) || '').split(',').filter(v => ALLOWED[k].includes(v)); });
    RANGES.forEach(k => { const v = p.get(k) || ''; state[k] = /^\d{1,7}$/.test(v) ? v : ''; });
    state.sort = SORTS[p.get('sort')] ? p.get('sort') : 'rec';
    state.page = Math.max(1, parseInt(p.get('page'), 10) || 1);
  })();

  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    LISTS.forEach(k => { if (state[k].length) p.set(k, state[k].join(',')); });
    RANGES.forEach(k => { if (state[k]) p.set(k, state[k]); });
    if (state.sort !== 'rec') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', String(state.page));
    const qs = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    session.set(qs);
  }

  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function matches(v, skip) {
    if (state.q) {
      const hay = norm(`${v.year} ${v.make} ${v.model} ${v.trim} ${v.color || ''} ${t('body.' + v.body)} ${t('fuel.' + v.fuel)}`);
      if (!norm(state.q).split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
    }
    for (const k of LISTS) if (k !== skip && state[k].length && !state[k].includes(v[k])) return false;
    if (state.pmin && v.price < +state.pmin) return false;
    if (state.pmax && v.price > +state.pmax) return false;
    if (state.ymin && v.year < +state.ymin) return false;
    if (state.ymax && v.year > +state.ymax) return false;
    if (state.miles && v.miles > +state.miles) return false;
    return true;
  }

  const el = {
    panel: $('#filters'), q: $('#f-q'), cond: $('#f-cond'), body: $('#f-body'), make: $('#f-make'), fuel: $('#f-fuel'),
    pmin: $('#f-pmin'), pmax: $('#f-pmax'), ymin: $('#f-ymin'), ymax: $('#f-ymax'), miles: $('#f-miles'), sort: $('#f-sort'),
    grid: $('#inv-grid'), count: $('#r-count'), empty: $('#inv-empty'), pager: $('#pager'), active: $('#active-filters'),
    badge: $('#f-badge'), apply: $('#fp-apply'), results: $('#results'),
  };

  /* ---------- Facets ---------- */
  function chips(key, label) {
    return present(key).map(val => `<label class="fchip" data-key="${key}" data-val="${esc(val)}"><input type="checkbox" name="${key}" value="${esc(val)}"${state[key].includes(val) ? ' checked' : ''}><span>${esc(label(val))}<small></small></span></label>`).join('');
  }
  function buildFacets() {
    el.cond.innerHTML = chips('cond', v => t('cond.' + v));
    el.body.innerHTML = chips('body', v => t('body.' + v));
    el.fuel.innerHTML = chips('fuel', v => t('fuel.' + v));
    el.make.innerHTML = makes.map(m => `<label class="check-row" data-key="make" data-val="${esc(m)}"><input type="checkbox" name="make" value="${esc(m)}"${state.make.includes(m) ? ' checked' : ''}><span>${esc(m)}</span><span class="n"></span></label>`).join('');
    const opt = (v, label, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
    el.ymin.innerHTML = opt('', t('inv.any'), !state.ymin) + years.slice().reverse().map(y => opt(y, y, String(y) === state.ymin)).join('');
    el.ymax.innerHTML = opt('', t('inv.any'), !state.ymax) + years.map(y => opt(y, y, String(y) === state.ymax)).join('');
    syncControls();
  }
  function syncControls() {
    $$('input[type="checkbox"]', el.panel).forEach(cb => { cb.checked = state[cb.name].includes(cb.value); });
    el.q.value = state.q;
    RANGES.forEach(k => { el[k].value = state[k]; });
    el.sort.value = state.sort;
  }
  function updateCounts() {
    $$('[data-key]', el.panel).forEach(node => {
      const { key, val } = node.dataset;
      const n = all.filter(v => v[key] === val && matches(v, key)).length;
      node.querySelector('small, .n').textContent = n;
      node.classList.toggle('is-empty', n === 0 && !state[key].includes(val));
    });
  }

  /* ---------- Results ---------- */
  function render(anim) {
    const results = all.filter(v => matches(v)).sort(SORTS[state.sort]);
    const n = results.length;
    const pages = Math.max(1, Math.ceil(n / PER_PAGE));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * PER_PAGE;
    const shown = results.slice(start, start + PER_PAGE);
    el.grid.innerHTML = shown.map(V.card).join('');
    el.grid.hidden = !n;
    el.empty.hidden = n > 0;
    if (!n) el.count.textContent = t('inv.none');
    else if (n === 1) el.count.innerHTML = t('inv.count1');
    else el.count.innerHTML = t('inv.count', { from: start + 1, to: start + shown.length, n });
    el.apply.textContent = n === 1 ? t('inv.show1') : t('inv.show', { n });
    renderPager(pages);
    renderActive();
    updateCounts();
    writeUrl();
    if (anim && !reducedMotion) {
      el.grid.classList.remove('slide-next', 'slide-prev');
      void el.grid.offsetWidth; // restart the slide-in
      el.grid.classList.add(anim === 'prev' ? 'slide-prev' : 'slide-next');
    }
  }

  function renderPager(pages) {
    el.pager.hidden = pages <= 1;
    if (pages <= 1) { el.pager.innerHTML = ''; return; }
    const cur = state.page;
    const btn = (p, inner, extra) => `<button type="button" data-page="${p}"${extra || ''}>${inner}</button>`;
    const nums = [];
    for (let p = 1; p <= pages; p += 1) {
      if (p === 1 || p === pages || Math.abs(p - cur) <= 1) nums.push(p);
      else if (nums[nums.length - 1] !== 0) nums.push(0);
    }
    el.pager.innerHTML = [
      btn(cur - 1, `<svg aria-hidden="true"><use href="#i-chev-l"/></svg><span class="sr-only">${esc(t('inv.prev'))}</span>`, cur === 1 ? ' disabled' : ''),
      ...nums.map(p => (p === 0
        ? '<span class="pager-gap" aria-hidden="true">…</span>'
        : btn(p, p, ` aria-label="${esc(t('inv.page', { n: p }))}"${p === cur ? ' aria-current="page"' : ''}`))),
      btn(cur + 1, `<span class="sr-only">${esc(t('inv.next'))}</span><svg aria-hidden="true"><use href="#i-chev-r"/></svg>`, cur === pages ? ' disabled' : ''),
    ].join('');
  }
  el.pager.addEventListener('click', e => {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    const next = parseInt(b.dataset.page, 10);
    if (next === state.page) return;
    const dir = next > state.page ? 'next' : 'prev';
    state.page = next;
    render(dir);
    // The pressed button was re-rendered; keep keyboard focus on the page now shown.
    const current = el.pager.querySelector('[aria-current="page"]');
    if (current) current.focus({ preventScroll: true });
    el.results.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  });

  function renderActive() {
    const list = [];
    if (state.q) list.push(['q', '', `“${state.q}”`]);
    state.cond.forEach(v => list.push(['cond', v, t('cond.' + v)]));
    state.body.forEach(v => list.push(['body', v, t('body.' + v)]));
    state.make.forEach(v => list.push(['make', v, v]));
    state.fuel.forEach(v => list.push(['fuel', v, t('fuel.' + v)]));
    if (state.pmin) list.push(['pmin', '', t('inv.af.pmin', { v: usd(state.pmin) })]);
    if (state.pmax) list.push(['pmax', '', t('inv.af.pmax', { v: usd(state.pmax) })]);
    if (state.ymin) list.push(['ymin', '', t('inv.af.ymin', { v: state.ymin })]);
    if (state.ymax) list.push(['ymax', '', t('inv.af.ymax', { v: state.ymax })]);
    if (state.miles) list.push(['miles', '', t('inv.af.miles', { v: new Intl.NumberFormat('en-US').format(state.miles) })]);
    el.active.innerHTML = list.map(([k, v, label]) =>
      `<button type="button" class="af" data-k="${k}" data-v="${esc(v)}" aria-label="${esc(t('inv.remove', { label }))}">${esc(label)}<svg aria-hidden="true"><use href="#i-x"/></svg></button>`).join('')
      + (list.length > 1 ? `<button type="button" class="af-clear" data-k="all">${esc(t('inv.clearAll'))}</button>` : '');
    el.badge.hidden = !list.length;
    el.badge.textContent = list.length;
  }
  el.active.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'all') { clearAll(); el.count.focus({ preventScroll: true }); return; }
    const index = $$('.af', el.active).indexOf(b);
    if (LISTS.includes(k)) state[k] = state[k].filter(x => x !== b.dataset.v);
    else state[k] = '';
    state.page = 1;
    syncControls();
    render('prev');
    // Focus the chip that took this one's place, or the result count when none are left.
    const left = $$('.af', el.active);
    (left[Math.min(index, left.length - 1)] || el.count).focus({ preventScroll: true });
  });

  function clearAll() {
    state.q = '';
    LISTS.forEach(k => { state[k] = []; });
    RANGES.forEach(k => { state[k] = ''; });
    state.page = 1;
    syncControls();
    render('prev');
  }

  /* ---------- Controls ---------- */
  el.panel.addEventListener('change', e => {
    const tgt = e.target;
    if (tgt.type === 'checkbox') {
      const k = tgt.name;
      state[k] = tgt.checked ? [...state[k], tgt.value] : state[k].filter(x => x !== tgt.value);
    } else if (tgt === el.ymin || tgt === el.ymax || tgt === el.miles) {
      state[tgt.id.slice(2)] = tgt.value;
    } else {
      return;
    }
    state.page = 1;
    render('next');
  });
  // One debounce timer per field, so typing in one field never cancels another's pending update.
  const timers = {};
  const later = (key, fn, ms) => { window.clearTimeout(timers[key]); timers[key] = window.setTimeout(fn, ms); };
  el.q.addEventListener('input', () => later('q', () => { state.q = el.q.value.trim(); state.page = 1; render('next'); }, 220));
  [el.pmin, el.pmax].forEach(inp => inp.addEventListener('input', () => later(inp.id, () => {
    state[inp.id.slice(2)] = inp.value ? String(Math.max(0, Math.round(+inp.value))) : '';
    state.page = 1;
    render('next');
  }, 350)));
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; state.page = 1; render('next'); });
  $('#filter-form').addEventListener('submit', e => e.preventDefault());
  $('#f-clear').addEventListener('click', clearAll);
  $('#empty-clear').addEventListener('click', () => { clearAll(); el.count.focus({ preventScroll: true }); });

  /* ---------- Mobile drawer ---------- */
  const openBtn = $('.filters-open');
  const closeBtn = $('.fp-close');
  const shade = $('.fp-backdrop');
  // Everything the drawer covers becomes inert while it is open, so focus can't wander behind it.
  const behindDrawer = () => $$('.site-header, .page-hero, #results, .cta-band, .site-footer, .mbar, .wa-float');
  function setDrawer(open, restoreFocus = true) {
    el.panel.classList.toggle('open', open);
    shade.classList.toggle('show', open);
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
    behindDrawer().forEach(node => { node.inert = open; });
    if (open) {
      el.panel.setAttribute('role', 'dialog');
      el.panel.setAttribute('aria-modal', 'true');
      closeBtn.focus();
    } else {
      el.panel.removeAttribute('role');
      el.panel.removeAttribute('aria-modal');
      if (restoreFocus) openBtn.focus({ preventScroll: true });
    }
  }
  openBtn.addEventListener('click', () => setDrawer(true));
  closeBtn.addEventListener('click', () => setDrawer(false));
  shade.addEventListener('click', () => setDrawer(false));
  el.apply.addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.panel.classList.contains('open')) setDrawer(false); });
  window.matchMedia('(min-width: 981px)').addEventListener('change', e => {
    if (e.matches && el.panel.classList.contains('open')) setDrawer(false, false);
  });

  onLang(() => { buildFacets(); render(); });
})();
