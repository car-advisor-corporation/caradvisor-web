/* Vehicle detail: renders one demo listing from ?id=, with a payment estimator and similar vehicles. */
(() => {
  'use strict';
  const { $, t, esc, usd, num, payment, onLang, waHref } = window.CA;
  const V = window.CA.vehicles;
  const v = V.byId(new URLSearchParams(window.location.search).get('id'));

  // "Inventory" in the breadcrumb returns to the same filtered view the visitor came from.
  let back = '';
  try { back = window.sessionStorage.getItem('ca-inv-query') || ''; } catch (e) { /* storage unavailable */ }
  $('#vd-back').href = `inventory.html${back ? `?${back}` : ''}`;

  function similar() {
    const pool = V.list.filter(x => !v || x.id !== v.id);
    if (!v) return pool.slice(0, 4);
    const ranked = [
      ...pool.filter(x => x.body === v.body && Math.abs(x.price - v.price) < v.price * 0.5),
      ...pool.filter(x => x.body === v.body),
      ...pool.filter(x => x.make === v.make),
      ...pool,
    ];
    return ranked.filter((x, i) => ranked.indexOf(x) === i).slice(0, 4);
  }
  const sim = similar();

  if (!v) {
    const crumb = $('#vd-crumb');
    crumb.previousElementSibling.hidden = true; // the "/" before the empty current-page crumb
    crumb.hidden = true;
    $('#vd-content').hidden = true;
    $('#vd-details').hidden = true;
    $('#vd-missing').hidden = false;
    onLang(() => { $('#vd-similar').innerHTML = sim.map(V.card).join(''); });
    return;
  }

  if (window.CA.crm) window.CA.crm.sawVehicle(v);

  const price = $('#p-price');
  const down = $('#p-down');
  const apr = $('#p-apr');
  const term = $('#p-term');
  price.value = v.price;
  down.value = V.downPayment(v);
  function calc() {
    const principal = Math.max(0, num(price) - num(down));
    const months = parseInt(term.value, 10) || 72;
    const monthly = payment(principal, num(apr), months);
    $('#p-monthly').textContent = usd(monthly) + t('perMonth');
    $('#p-interest').textContent = usd(Math.max(0, monthly * months - principal));
  }
  $('.pay-card').addEventListener('input', calc);
  $('.pay-card').addEventListener('change', calc);

  $('#vd-img').innerHTML = V.photo(v, { eager: true });
  const electric = v.fuel === 'electric';
  const economy = () => (electric ? v.mpg.replace(/\s*range$/i, '') : V.mpg(v.mpg));

  function render() {
    const name = V.title(v);
    const full = `${name} ${v.trim}`;
    document.title = `${name} · Car Advisor`;
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', `${full} · ${usd(v.price)} · ${V.miles(v.miles)} · Car Advisor`);
    $('#vd-crumb').textContent = `${v.make} ${v.model}`;
    $('#vd-make').textContent = `${v.make} · ${t('body.' + v.body)}`;
    $('#vd-title').textContent = name;
    $('#vd-trim').textContent = [v.trim, V.color(v.color)].filter(Boolean).join(' · ');
    $('#vd-badges').innerHTML = V.badges(v);
    $('#vd-price').textContent = usd(v.price);
    $('#vd-monthly').textContent = t('inv.est', { amount: usd(V.monthly(v)) });
    const im = v.img || {};
    $('#vd-credit').innerHTML = im.author ? t('vd.photo', {
      author: im.page ? `<a href="${esc(im.page)}" target="_blank" rel="noopener">${esc(im.author)}</a>` : esc(im.author),
      license: im.licenseUrl ? `<a href="${esc(im.licenseUrl)}" target="_blank" rel="noopener">${esc(im.license)}</a>` : esc(im.license),
    }) : '';
    $('#vd-request').href = `contact.html?vehicle=${encodeURIComponent(full)}&service=${v.cond === 'new' ? 'new' : 'used'}`;
    $('#vd-wa').href = waHref(t('wa.car', { car: full, price: usd(v.price), stock: v.stock }));
    $('#vd-quick').innerHTML = [
      ['i-gauge', t('q.miles'), V.miles(v.miles)],
      ['i-drive', t('q.drive'), v.drivetrain],
      ['i-fuel', t(electric ? 'q.range' : 'q.mpg'), economy()],
      ['i-users', t('q.seats'), t('q.seatsN', { n: v.seats })],
    ].map(([ico, label, val]) => `<li><svg aria-hidden="true"><use href="#${ico}"/></svg><div><small>${esc(label)}</small><strong>${esc(val)}</strong></div></li>`).join('');
    $('#vd-specs').innerHTML = [
      ['spec.year', v.year], ['spec.make', v.make], ['spec.model', v.model], ['spec.trim', v.trim],
      ['spec.body', t('body.' + v.body)], ['spec.cond', t('cond.' + v.cond)], ['spec.miles', V.miles(v.miles)],
      ['spec.fuel', t('fuel.' + v.fuel)], [electric ? 'spec.range' : 'spec.mpg', economy()],
      ['spec.trans', V.trans(v.transmission)], ['spec.drive', v.drivetrain], ['spec.color', V.color(v.color) || '—'],
      ['spec.seats', v.seats], ['spec.stock', v.stock],
    ].map(([k, val]) => `<tr><th scope="row">${esc(t(k))}</th><td>${esc(val)}</td></tr>`).join('');
    $('#vd-similar').innerHTML = sim.map(V.card).join('');
    calc();
  }
  onLang(render);
})();
