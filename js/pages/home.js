/* Home: featured vehicles from the demo inventory, and the pause control for the makes marquee. */
(() => {
  'use strict';
  const { $, t, onLang } = window.CA;
  const V = window.CA.vehicles;
  const grid = $('#featured-grid');
  const allLabel = $('#featured-all');

  // A varied first impression: a few crowd-pleasers first, then fill from the recommended order.
  const WANT = ['Model Y', 'Highlander', '911', 'Bronco', 'RX', 'X5', 'Telluride', 'Defender'];
  const featured = [];
  WANT.forEach(m => { const v = V.list.find(x => x.model === m && x.img && x.img.thumb); if (v) featured.push(v); });
  V.list.forEach(v => { if (featured.length < 8 && !featured.includes(v)) featured.push(v); });

  const makes = $('.makes');
  const pause = $('.makes-pause');
  if (pause) {
    pause.addEventListener('click', () => {
      const on = pause.getAttribute('aria-pressed') !== 'true';
      pause.setAttribute('aria-pressed', String(on));
      makes.classList.toggle('paused', on);
    });
  }

  /* El logo de la portada se inclina siguiendo el cursor (o el giro del teléfono),
     así las dos capas se separan y el conjunto se ve en volumen. */
  const logo3d = document.getElementById('logo3d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  if (logo3d && !still.matches) {
    const hero = logo3d.closest('.hero-logo');
    let raf = 0, tx = 0, ty = 0;
    const apply = () => {
      raf = 0;
      logo3d.style.setProperty('--ry', (tx * 7).toFixed(2) + 'deg');
      logo3d.style.setProperty('--rx', (-ty * 5).toFixed(2) + 'deg');
      logo3d.style.setProperty('--px', tx.toFixed(3));
      logo3d.style.setProperty('--py', ty.toFixed(3));
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
      ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
      logo3d.classList.add('is-live');
      queue();
    });
    hero.addEventListener('pointerleave', () => {
      logo3d.classList.remove('is-live');
      tx = ty = 0; queue();
    });
    addEventListener('deviceorientation', e => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 28));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 32));
      queue();
    }, { passive: true });
  }

  onLang(() => {
    grid.innerHTML = featured.slice(0, 8).map(V.card).join('');
    allLabel.textContent = V.list.length ? t('home.viewAll', { n: V.list.length }) : allLabel.textContent;
  });
})();
