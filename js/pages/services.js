/* Services: the dealer-quote checker (add-ons + financing-rate markup). */
(() => {
  'use strict';
  const { $, $$, t, usd, num, payment, onLang } = window.CA;
  const rows = $$('.addon');

  function calc() {
    let addons = 0;
    rows.forEach(row => {
      const box = row.querySelector('input[type="checkbox"]');
      const amount = row.querySelector('.num-in');
      row.classList.toggle('off', !box.checked);
      amount.disabled = !box.checked;
      if (box.checked) addons += num(amount);
    });
    const principal = num($('#f-amount'));
    const months = parseInt($('#f-term').value, 10) || 0;
    const offered = payment(principal, num($('#f-offer')), months);
    const qualified = payment(principal, num($('#f-qual')), months);
    const extra = Math.max(0, (offered - qualified) * months);
    $('#o-offer').textContent = usd(offered) + t('perMonth');
    $('#o-qual').textContent = usd(qualified) + t('perMonth');
    $('#o-extra').textContent = usd(extra);
    $('#o-total').textContent = usd(addons + extra);
  }
  $('#check').addEventListener('input', calc);
  $('#check').addEventListener('change', calc);
  onLang(calc);
})();
