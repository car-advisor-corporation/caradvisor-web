/* FAQ: topic filter chips; matching questions slide in. */
(() => {
  'use strict';
  const { $$, reducedMotion } = window.CA;
  const chips = $$('.faq-filters .chip');
  const items = $$('.faq-list details');

  chips.forEach(chip => {
    const cat = chip.dataset.cat;
    chip.querySelector('.count').textContent = cat === 'all' ? items.length : items.filter(d => d.dataset.cat === cat).length;
    chip.addEventListener('click', () => {
      chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      let shown = 0;
      items.forEach(d => {
        const match = cat === 'all' || d.dataset.cat === cat;
        d.classList.toggle('is-hidden', !match);
        d.classList.remove('is-in');
        if (match && !reducedMotion) {
          void d.offsetWidth; // restart the slide-in
          d.style.animationDelay = `${shown * 40}ms`;
          d.classList.add('is-in');
        }
        if (match) shown += 1;
      });
    });
  });
})();
