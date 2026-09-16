/* Contact: 3-step request form with validation, slide transitions between steps and WhatsApp handoff.
   Prefills from ?vehicle=...&service=... (links from vehicle pages and the quote checker). */
(() => {
  'use strict';
  const { $, $$, t, esc, onLang, waHref, reducedMotion } = window.CA;
  const form = $('#req-form');
  const steps = $$('.step', form);
  const stepItems = $$('.steps li', form);
  const backBtn = $('#f-back');
  const nextBtn = $('#f-next');
  const successEl = $('#req-success');
  const vehicleIn = $('#r-vehicle');
  const vehicleErr = $('#step0-err');
  let step = 0;
  let lastSubmission = null;
  let prefilled = '';

  function syncStepUi() {
    const label = step < steps.length - 1 ? t('form.next') : t('form.send');
    nextBtn.innerHTML = `<span>${esc(label)}</span><svg aria-hidden="true"><use href="#i-arrow"/></svg>`;
  }
  function showStep(focus, dir) {
    steps.forEach((s, i) => {
      s.hidden = i !== step;
      s.classList.remove('slide-in', 'slide-back');
      if (i === step && dir && !reducedMotion) s.classList.add(dir === 'back' ? 'slide-back' : 'slide-in');
    });
    stepItems.forEach((li, i) => {
      li.classList.toggle('done', i < step);
      if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    backBtn.hidden = step === 0;
    syncStepUi();
    if (focus) {
      const first = steps[step].querySelector('input[type="text"], input[type="tel"], select, input[type="radio"]:checked');
      if (first) first.focus({ preventScroll: true });
    }
  }
  // Errors keep their message key, so a language switch can re-translate them.
  function setErr(input, errEl, key) {
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
    errEl.dataset.key = key || '';
    errEl.textContent = key ? t(key) : '';
    errEl.hidden = !key;
  }
  function validate() {
    if (step === 0) {
      const ok = vehicleIn.value.trim().length >= 2;
      setErr(vehicleIn, vehicleErr, ok ? '' : 'err.vehicle');
      if (!ok) vehicleIn.focus();
      return ok;
    }
    if (step === 2) {
      const name = $('#r-name');
      const phone = $('#r-phone');
      const email = $('#r-email');
      const digits = phone.value.replace(/\D/g, '');
      const mail = email.value.trim();
      const wantsEmail = form.elements.contact.value === 'email';
      const nameOk = name.value.trim().length >= 2;
      const phoneOk = digits.length >= 10 && digits.length <= 15;
      const mailOk = mail ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) : !wantsEmail;
      setErr(name, $('#r-name-err'), nameOk ? '' : 'err.name');
      setErr(phone, $('#r-phone-err'), phoneOk ? '' : 'err.phone');
      setErr(email, $('#r-email-err'), mailOk ? '' : (mail ? 'err.email' : 'err.emailNeeded'));
      const bad = [[nameOk, name], [phoneOk, phone], [mailOk, email]].find(([ok]) => !ok);
      if (bad) bad[1].focus();
      return !bad;
    }
    return true;
  }

  const checkedLabel = name => {
    const el = form.querySelector(`input[name="${name}"]:checked`);
    return el ? el.nextElementSibling.textContent.trim() : '';
  };
  function collect() {
    return {
      vehicle: vehicleIn.value.trim(),
      budgetIdx: $('#r-budget').selectedIndex,
      trade: form.elements.trade.value,
      tradeVehicle: $('#r-trade').value.trim(),
      name: $('#r-name').value.trim(),
      phone: $('#r-phone').value.trim(),
      email: $('#r-email').value.trim(),
      contact: form.elements.contact.value,
    };
  }
  function renderSuccess(d) {
    $('#ok-title').textContent = t('ok.title', { name: d.name.split(/\s+/)[0] });
    const key = d.contact === 'email' && d.email ? 'ok.text.email' : d.contact === 'call' ? 'ok.text.call' : 'ok.text.whatsapp';
    $('#ok-text').textContent = t(key, { phone: d.phone, email: d.email });
    const budget = d.budgetIdx > 0 ? $('#r-budget').options[d.budgetIdx].textContent.trim() : '—';
    const trade = d.trade === 'yes' && d.tradeVehicle ? `${checkedLabel('trade')} · ${d.tradeVehicle}` : checkedLabel('trade');
    const summary = [
      `${t('sum.vehicle')}: ${d.vehicle}`,
      `${t('sum.service')}: ${checkedLabel('service')}`,
      `${t('sum.budget')}: ${budget}`,
      `${t('sum.timing')}: ${checkedLabel('timing')}`,
      `${t('sum.pay')}: ${checkedLabel('pay')}`,
      `${t('sum.trade')}: ${trade}`,
      `${t('sum.contact')}: ${d.name} · ${d.phone}${d.email ? ` · ${d.email}` : ''}`,
    ].join('\n');
    $('#ok-summary').textContent = summary;
    $('#ok-wa').href = waHref(t('wa.req', { summary }));
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    if (step < steps.length - 1) { step += 1; showStep(true, 'next'); return; }
    lastSubmission = collect();
    renderSuccess(lastSubmission);
    // El lead sale hacia el CRM con el contexto de la visita. Sin endpoint configurado se queda
    // en cola en este navegador y el visitante continúa por WhatsApp, así que nada se pierde.
    if (window.CA.crm) {
      const b = $('#r-budget');
      window.CA.crm.send(Object.assign({}, lastSubmission, {
        budget: lastSubmission.budgetIdx > 0 ? b.options[lastSubmission.budgetIdx].textContent.trim() : '',
      }));
    }
    form.hidden = true;
    successEl.hidden = false;
    successEl.focus();
  });
  backBtn.addEventListener('click', () => { if (step > 0) { step -= 1; showStep(true, 'back'); } });
  form.addEventListener('change', e => {
    if (e.target.name === 'trade') $('#trade-desc').hidden = form.elements.trade.value !== 'yes';
  });
  vehicleIn.addEventListener('input', () => { if (!vehicleErr.hidden) setErr(vehicleIn, vehicleErr, ''); });

  $('#ok-again').addEventListener('click', () => {
    form.reset();
    $$('[aria-invalid]', form).forEach(el => el.setAttribute('aria-invalid', 'false'));
    $$('.err', form).forEach(el => { el.hidden = true; el.dataset.key = ''; });
    $('#trade-desc').hidden = true;
    lastSubmission = null;
    prefilled = '';
    step = 0;
    form.hidden = false;
    successEl.hidden = true;
    showStep(false);
    vehicleIn.focus();
  });

  // Prefill from links elsewhere on the site.
  const params = new URLSearchParams(window.location.search);
  const service = params.get('service');
  if (params.get('vehicle')) vehicleIn.value = params.get('vehicle').slice(0, 120);
  if (service) {
    const radio = form.querySelector(`input[name="service"][value="${CSS.escape(service)}"]`);
    if (radio) radio.checked = true;
  }

  showStep(false);
  onLang(() => {
    // Replace our own prefill when the language changes, but never text the visitor typed.
    if (service === 'audit' && (!vehicleIn.value || vehicleIn.value === prefilled)) {
      vehicleIn.value = t('prefill.audit');
      prefilled = vehicleIn.value;
    }
    $$('.err', form).forEach(e => { if (e.dataset.key) e.textContent = t(e.dataset.key); });
    syncStepUi();
    if (lastSubmission) renderSuccess(lastSubmission);
  });
})();
