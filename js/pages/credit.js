/* Solicitud de crédito: validación, firma dibujada, PDF firmado y borrado inmediato.

   Nada se guarda en la web. Al enviar se genera el PDF en el propio navegador, se entrega al
   destino configurado en CA_CREDIT.endpoint y el formulario se vacía, también la firma.
   Mientras no haya endpoint, el envío no sale del navegador. */
window.CA_CREDIT = {
  // FormSubmit reenvía el PDF firmado al correo. La primera solicitud le llega a ese correo como
  // "activa este formulario": hay que confirmarla una vez. Después FormSubmit da un alias aleatorio
  // que conviene poner aquí en lugar del correo, para que no quede visible en el código de la página.
  endpoint: 'https://formsubmit.co/ajax/hectormota@caradvisorcorporation.com',
};

(() => {
  'use strict';
  const { $, $$, t, onLang } = window.CA;
  const CFG = window.CA_CREDIT;
  const form = $('#cr-form');
  const pad = $('#cr-pad');
  const hint = $('#cr-pad-hint');
  const errorEl = $('#cr-error');
  const attest = $('#cr-attest');
  const signer = $('#cr-s-name');
  const guarantor = $('#cr-g-name');
  let drawn = false;

  /* ---------- Personal o comercial ----------
     Las secciones del tipo no elegido quedan ocultas y desactivadas: un campo desactivado ni se
     valida ni viaja en el envío, así que nunca se mezclan datos de las dos solicitudes. */
  const kind = () => (form.elements.kind.value === 'commercial' ? 'commercial' : 'personal');
  function applyKind() {
    const k = kind();
    $$('[data-kind]', form).forEach(el => {
      const on = el.dataset.kind === k;
      el.hidden = !on;
      if (el.tagName === 'FIELDSET') el.disabled = !on;
      else $$('input, select', el).forEach(i => { i.disabled = !on; });
    });
    paintAttest();
  }
  $$('input[name="kind"]', form).forEach(r => r.addEventListener('change', applyKind));

  /* ---------- Firma ---------- */
  const ctx = pad.getContext('2d');
  function sizePad() {
    const r = pad.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const snapshot = drawn ? pad.toDataURL() : null;
    pad.width = Math.round(r.width * ratio);
    pad.height = Math.round(r.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B0D10';
    if (snapshot) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = snapshot; }
  }
  let last = null;
  const point = e => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); last = point(e); });
  pad.addEventListener('pointermove', e => {
    if (!last) return;
    const p = point(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
    if (!drawn) { drawn = true; hint.hidden = true; }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { last = null; }));
  function clearPad() {
    ctx.clearRect(0, 0, pad.width, pad.height);
    drawn = false; hint.hidden = false;
  }
  $('#cr-clear').addEventListener('click', clearPad);
  window.addEventListener('resize', sizePad);
  sizePad();

  /* ---------- "Yo, NOMBRE, firmo hoy, FECHA" ---------- */
  const today = () => new Date().toLocaleDateString(document.documentElement.lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const personalName = () => [$('#cr-i-first').value.trim(), $('#cr-i-last').value.trim()].filter(Boolean).join(' ');
  function paintAttest() {
    const name = signer.value.trim() || (kind() === 'personal' ? personalName() : guarantor.value.trim());
    attest.textContent = name ? t('cr.attest', { name, date: today() }) : '';
  }
  signer.addEventListener('input', paintAttest);
  [guarantor, $('#cr-i-first'), $('#cr-i-last')].forEach(el => el.addEventListener('input', () => { if (!signer.value.trim()) paintAttest(); }));

  /* ---------- Validación ---------- */
  function validate() {
    const missing = $$('[required]', form).filter(el => !el.matches(':disabled') && (el.type === 'checkbox' ? !el.checked : !el.value.trim()));
    $$('.cr-f', form).forEach(f => f.classList.remove('bad'));
    missing.forEach(el => { const f = el.closest('.cr-f'); if (f) f.classList.add('bad'); });
    if (missing.length) {
      errorEl.textContent = t('cr.err.required');
      errorEl.hidden = false;
      missing[0].focus();
      return false;
    }
    const email = kind() === 'personal' ? $('#cr-i-email') : $('#cr-g-email');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
      email.closest('.cr-f').classList.add('bad');
      errorEl.textContent = t('cr.err.email'); errorEl.hidden = false; email.focus(); return false;
    }
    if (!drawn) {
      errorEl.textContent = t('cr.err.signature'); errorEl.hidden = false;
      pad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false;
    }
    errorEl.hidden = true;
    return true;
  }

  /* ---------- PDF firmado, generado en el navegador ---------- */
  function collect() {
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = data[k] ? `${data[k]}, ${v}` : v; });
    return data;
  }
  async function buildPdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 42;
    let y = M;
    const line = (label, value) => {
      if (y > H - 70) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text(label, M, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15);
      const lines = doc.splitTextToSize(String(value || '—'), W - M * 2 - 170);
      doc.text(lines, M + 170, y);
      y += Math.max(15, lines.length * 12.5);
    };
    const head = title => {
      if (y > H - 90) { doc.addPage(); y = M; }
      y += 8;
      doc.setFillColor(20, 20, 20); doc.rect(M, y - 11, W - M * 2, 17, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255);
      doc.text(title.toUpperCase(), M + 6, y + 1);
      y += 20;
    };
    const finish = () => {
      doc.addPage(); y = M;
      head('Agreement');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(30);
      $$('.cr-legal p', form).forEach(p => {
        const lines = doc.splitTextToSize(p.textContent.trim(), W - M * 2);
        if (y + lines.length * 11 > H - 200) { doc.addPage(); y = M; }
        doc.text(lines, M, y); y += lines.length * 11 + 7;
      });
      head('Signature');
      if (data.kind === 'commercial') { line('Company', data.sCompany); line('Title', data.sTitle); }
      line('Signed by', data.signer);
      line('Agreement', 'Accepted electronically by the applicant');
      const sig = pad.toDataURL('image/png');
      const sw = 230; const sh = sw * (pad.height / pad.width);
      if (y + sh + 60 > H) { doc.addPage(); y = M; }
      doc.addImage(sig, 'PNG', M, y, sw, sh);
      y += sh + 4;
      doc.setDrawColor(40); doc.line(M, y, M + sw, y);
      y += 14;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(15);
      doc.text(`I, ${data.signer}, am signing this application on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`, M, y);
      return doc;
    };

    const personal = data.kind !== 'commercial';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(178, 31, 32);
    doc.text('CAR ADVISOR CORPORATION', M, y + 6);
    doc.setFontSize(12); doc.setTextColor(15);
    doc.text(personal ? 'Personal Credit Application' : 'Business Credit Application', W - M, y + 6, { align: 'right' });
    y += 26;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110);
    doc.text(`Submitted online ${new Date().toLocaleString('en-US')}`, M, y);
    y += 10;

    if (personal) {
      head('Applicant');
      line('First name', data.iFirst); line('Last name', data.iLast);
      line('Date of birth', data.iDob); line('Social Security number', data.iSsn);
      line('Home address', [data.iStreet, data.iCity, data.iState, data.iZip].filter(Boolean).join(', '));
      line('Time at address', `${data.iYears || 0} years, ${data.iMonths || 0} months`);
      line('Cell phone', data.iCell); line('Email', data.iEmail);
      head('Employment');
      line('Employer', data.iEmployer); line('Employer address', data.iEmployerAddress);
      line('Employer phone', data.iEmployerPhone);
      line('Time on job', `${data.iJobYears || 0} years, ${data.iJobMonths || 0} months`);
      line('Salary (monthly)', data.iSalary ? `$${data.iSalary}` : '');
      return finish();
    }

    head('Program type requested'); line('Program', data.program);
    head('Business');
    [['Business legal name', 'legalName'], ['DBA', 'dba'], ['Business type', 'businessType'], ['SSN / Federal Tax ID', 'taxId'],
     ['State of organization', 'orgState'], ['Date business formed', 'formed'], ['Gross monthly income', 'grossMonthly'],
     ['Description of business', 'description'], ['Address', null], ['Phone', 'bPhone'], ['Fax', 'bFax'], ['Key contact', 'keyContact']]
      .forEach(([l, k]) => line(l, k ? data[k] : [data.bStreet, data.bCity, data.bState, data.bZip].filter(Boolean).join(', ')));
    head('Principals');
    [1, 2, 3].forEach(i => { if (data[`p${i}Name`]) line(`Principal ${i}`, `${data[`p${i}Name`]} · ${data[`p${i}Title`] || ''} · ${data[`p${i}Own`] || ''}% · ${data[`p${i}Address`] || ''}`); });
    head('Bank, finance and trade references');
    [['Bank', 'bank'], ['Finance reference', 'fin'], ['Trade reference', 'trade']].forEach(([l, k]) => {
      if (data[`${k}Name`]) line(l, `${data[`${k}Name`]} · Acct ${data[`${k}Acct`] || '—'} · ${data[`${k}Phone`] || ''} · ${data[`${k}Contact`] || ''} · ${data[`${k}Address`] || ''}`);
    });
    head('Sole proprietor or guarantor');
    [['Full name', 'gName'], ['Social Security number', 'gSsn'], ['Date of birth', 'gDob'], ['Home address', null],
     ['Time at address', null], ['Residence type', 'gResidence'], ['Monthly rent / mortgage', 'gRent'], ['Home phone', 'gHomePhone'],
     ['Cell phone', 'gCell'], ['Email', 'gEmail'], ['Employer', 'gEmployer'], ['Employer phone', 'gEmployerPhone'],
     ['Time on job', null], ['Monthly income', 'gIncome'], ['Secondary income', 'gSecondary'], ['Source', 'gSource']]
      .forEach(([l, k]) => {
        let v = k ? data[k] : '';
        if (l === 'Home address') v = [data.gStreet, data.gCity, data.gState, data.gZip].filter(Boolean).join(', ');
        if (l === 'Time at address') v = `${data.gYears || 0} years, ${data.gMonths || 0} months`;
        if (l === 'Time on job') v = `${data.gJobYears || 0} years, ${data.gJobMonths || 0} months`;
        line(l, v);
      });
    head('References');
    [['Nearest relative', 'rel'], ['Personal reference', 'ref1'], ['Personal reference', 'ref2']].forEach(([l, k]) => {
      if (data[`${k}Name`]) line(l, `${data[`${k}Name`]} (${data[`${k}Relation`] || ''}) · ${data[`${k}Phone`] || ''} · ${data[`${k}Address`] || ''}`);
    });

    return finish();
  }

  /* ---------- Borrado inmediato ---------- */
  function wipe() {
    form.reset();
    applyKind();
    clearPad();
    attest.textContent = '';
    $$('.cr-f', form).forEach(f => f.classList.remove('bad'));
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) return;
    const btn = $('#cr-submit');
    btn.disabled = true;
    try {
      const data = collect();
      const doc = await buildPdf(data);
      if (CFG.endpoint) {
        // En el cuerpo del correo solo va el nombre; el SSN y las cuentas viajan dentro del PDF adjunto.
        const safe = s => String(s || 'solicitud').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
        const body = new FormData();
        const who = data.kind === 'commercial' ? data.gName : [data.iFirst, data.iLast].filter(Boolean).join(' ');
        const tipo = data.kind === 'commercial' ? 'comercial' : 'personal';
        body.append('_subject', `Nueva solicitud de crédito ${tipo} — ${who}${data.legalName ? ` (${data.legalName})` : ''}`);
        body.append('_template', 'box');
        body.append('_captcha', 'false');
        body.append('Tipo', tipo);
        body.append('Solicitante', who);
        body.append('Negocio', data.legalName || '—');
        body.append('Recibida', new Date().toLocaleString('en-US'));
        body.append('attachment', doc.output('blob'), `Credit-Application-${tipo}-${safe(who)}.pdf`);
        const r = await fetch(CFG.endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
      wipe();
      form.hidden = true;
      const done = $('#cr-done');
      done.hidden = false;
      done.focus();
    } catch (err) {
      errorEl.textContent = t('cr.err.send');
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // Al salir de la página, no queda nada escrito en ella.
  window.addEventListener('pagehide', wipe);

  applyKind();
  onLang(() => { paintAttest(); });
})();
