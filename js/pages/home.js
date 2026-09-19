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

  /* ---------- Pasarela de marcas ----------
     Se mueve sola, pero el visitante puede arrastrarla, deslizarla con el dedo o usar la rueda.
     Al llegar a la mitad vuelve al principio, y como la lista está duplicada el salto no se ve. */
  const makes = $('.makes');
  const track = $('.makes-track');
  const pause = $('.makes-pause');
  if (track) {
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const half = () => track.scrollWidth / 2;
    let paused = still.matches;
    let held = false;
    let raf = 0;
    let carry = 0;

    const wrap = () => {
      const h = half();
      if (h > 0) {
        if (track.scrollLeft >= h) track.scrollLeft -= h;
        else if (track.scrollLeft < 1) track.scrollLeft += h;   // al retroceder, salta al final
      }
    };
    const step = () => {
      if (paused || held || document.hidden) return;
      carry += 0.55;                         // ritmo suave, como el de antes
      const px = Math.floor(carry);
      if (px) { track.scrollLeft += px; carry -= px; wrap(); }
    };
    raf = setInterval(step, 16);

    // Arrastre con el ratón o el dedo
    let startX = 0, startLeft = 0, moved = 0;
    track.addEventListener('pointerdown', e => {
      held = true; moved = 0;
      startX = e.clientX; startLeft = track.scrollLeft;
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', e => {
      if (!held) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) track.classList.add('dragging');
      track.scrollLeft = startLeft - dx;
      wrap();
    });
    const release = () => { held = false; setTimeout(() => track.classList.remove('dragging'), 0); };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => track.addEventListener(ev, release));
    track.addEventListener('scroll', wrap, { passive: true });
    // Al pasar el ratón por encima se detiene, para poder leer y hacer clic
    track.addEventListener('pointerenter', () => { held = true; });
    track.addEventListener('pointerleave', () => { held = false; });
    makes.addEventListener('focusin', () => { held = true; });
    makes.addEventListener('focusout', () => { held = false; });

    if (pause) {
      pause.addEventListener('click', () => {
        paused = pause.getAttribute('aria-pressed') !== 'true';
        pause.setAttribute('aria-pressed', String(paused));
        makes.classList.toggle('paused', paused);
      });
    }
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
