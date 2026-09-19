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
     El movimiento va por transform, no por el scroll del navegador: así el arrastre no pelea con
     el desplazamiento por inercia del móvil (que hacía que la pasarela diera saltos y se reiniciara). */
  const makes = $('.makes');
  const track = $('.makes-track');
  const rail = $('.makes-rail');
  const pause = $('.makes-pause');
  if (track && rail) {
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = still.matches;
    let held = false;
    let offset = 0;
    let last = performance.now();
    const half = () => rail.scrollWidth / 2 || 1;
    const norm = v => { const h = half(); return ((v % h) + h) % h; };
    const paint = () => { rail.style.transform = `translate3d(${-offset}px, 0, 0)`; };

    const tick = now => {
      const dt = Math.min(now - last, 60);
      last = now;
      if (!paused && !held && !document.hidden) {
        offset = norm(offset + dt * 0.09);         // 90 px por segundo
        paint();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // rAF se congela en pestañas ocultas; este respaldo mantiene el ritmo al volver
    document.addEventListener('visibilitychange', () => { last = performance.now(); });

    /* Arrastre solo en pantallas táctiles; en escritorio la pasarela solo se mueve sola */
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch) track.classList.add('drag-ok');
    let startX = 0, startOffset = 0, moved = 0;
    if (touch) track.addEventListener('pointerdown', e => {
      held = true; moved = 0; startX = e.clientX; startOffset = offset;
      track.setPointerCapture(e.pointerId);
    });
    if (touch) track.addEventListener('pointermove', e => {
      if (!held) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) track.classList.add('dragging');
      offset = norm(startOffset - dx);
      paint();
    });
    const release = e => {
      if (!held) return;
      held = false;
      if (track.hasPointerCapture && e && e.pointerId != null && track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
      setTimeout(() => track.classList.remove('dragging'), 0);
    };
    if (touch) ['pointerup', 'pointercancel'].forEach(ev => track.addEventListener(ev, release));


    /* Con el ratón encima se detiene, para poder leer y hacer clic */
    track.addEventListener('pointerenter', () => { if (!touch) held = true; });
    track.addEventListener('pointerleave', e => { release(e); held = false; });
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

  onLang(() => {
    grid.innerHTML = featured.slice(0, 8).map(V.card).join('');
    allLabel.textContent = V.list.length ? t('home.viewAll', { n: V.list.length }) : allLabel.textContent;
  });
})();
