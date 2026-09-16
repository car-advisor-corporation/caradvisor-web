/* Car Advisor — demo inventory helpers shared by home, inventory and vehicle pages. */
(() => {
  'use strict';
  const { t, esc, usd, payment, CONFIG, fallbackArt } = window.CA;
  const list = (window.CA_INVENTORY || []).slice();

  const title = v => `${v.year} ${v.make} ${v.model}`;
  // Rounded to $100, the same default the vehicle page's payment calculator starts from.
  const downPayment = v => Math.round((v.price * CONFIG.downPct) / 100) * 100;
  const monthly = v => payment(v.price - downPayment(v), CONFIG.apr, CONFIG.term);
  const miles = n => `${new Intl.NumberFormat('en-US').format(n)} mi`;
  const isEco = v => v.fuel === 'hybrid' || v.fuel === 'phev' || v.fuel === 'electric';
  const es = () => window.CA.lang() === 'es';

  // Spec strings come in English from the data file; translate the common patterns.
  const KIND = { automatic: 'Automática', manual: 'Manual', 'dual-clutch': 'Doble embrague', pdk: 'PDK (doble embrague)' };
  function trans(s) {
    if (!es() || !s) return s;
    const m = s.match(/^(\d+)-speed (automatic|manual|dual-clutch|PDK)(.*)$/i);
    if (m) return `${KIND[m[2].toLowerCase()]} de ${m[1]} velocidades${m[3]}`;
    return s.replace(/single-speed/i, 'Una velocidad').replace(/automatic/i, 'automática');
  }
  function mpg(s) {
    if (!es() || !s) return s;
    return s.replace(/mi range/i, 'mi de autonomía');
  }
  // Manufacturer paint names stay as they are; plain color words get translated.
  const PLAIN_COLOR = {
    white: 'Blanco', black: 'Negro', gray: 'Gris', grey: 'Gris', silver: 'Plateado', red: 'Rojo', blue: 'Azul',
    green: 'Verde', brown: 'Marrón', beige: 'Beige', orange: 'Naranja', yellow: 'Amarillo',
  };
  const color = s => (es() && s && PLAIN_COLOR[s.trim().toLowerCase()]) || s;

  function photo(v, { eager = false } = {}) {
    if (!v.img || !v.img.thumb) return fallbackArt(v.body);
    const w = v.img.w || 960;
    const h = v.img.h || 640;
    return `<img src="${esc(v.img.thumb)}" alt="${esc(title(v))}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="CA.imgFail(this,'${esc(v.body)}')">`;
  }
  function badges(v) {
    const cond = `<span class="vbadge${v.cond === 'new' ? ' vbadge--new' : ''}">${esc(t('cond.' + v.cond))}</span>`;
    const eco = isEco(v) ? `<span class="vbadge vbadge--eco">${esc(t('fuel.' + v.fuel))}</span>` : '';
    return cond + eco;
  }
  function card(v) {
    return `<li class="vcard">
      <a class="vcard-link" href="vehicle.html?id=${encodeURIComponent(v.id)}">
        <div class="vcard-media">${photo(v)}<div class="vbadges">${badges(v)}</div></div>
        <div class="vcard-body">
          <p class="vcard-make">${esc(v.make)} · ${esc(t('body.' + v.body))}</p>
          <h3 class="vcard-title">${v.year} ${esc(v.model)}</h3>
          <p class="vcard-trim">${esc(v.trim)}</p>
          <ul class="vcard-specs">
            <li><svg aria-hidden="true"><use href="#i-gauge"/></svg>${esc(miles(v.miles))}</li>
            <li><svg aria-hidden="true"><use href="#i-drive"/></svg>${esc(v.drivetrain)}</li>
            <li><svg aria-hidden="true"><use href="#i-fuel"/></svg>${esc(mpg(v.mpg))}</li>
          </ul>
          <div class="vcard-price"><strong>${usd(v.price)}</strong><span>${esc(t('inv.est', { amount: usd(monthly(v)) }))}</span></div>
        </div>
      </a>
    </li>`;
  }

  window.CA.vehicles = {
    list, title, downPayment, monthly, miles, trans, mpg, color, photo, badges, card, isEco,
    byId: id => list.find(v => v.id === id) || null,
  };
})();
