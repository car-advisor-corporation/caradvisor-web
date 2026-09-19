/* Solicitud de crédito: validación, firma dibujada, PDF firmado y borrado inmediato.

   Nada se guarda en la web. Al enviar se genera el PDF en el propio navegador, se entrega al
   destino configurado en CA_CREDIT.endpoint y el formulario se vacía, también la firma.
   Mientras no haya endpoint, el envío no sale del navegador. */
window.CA_CREDIT = {
  // FormSubmit reenvía el PDF firmado al correo. Se usa el endpoint normal (no el /ajax/): el de
  // AJAX no admite adjuntos y por eso los correos llegaban vacíos. El envío va a un iframe oculto,
  // así que la página no se recarga.
  endpoint: 'https://formsubmit.co/hectormota@caradvisorcorporation.com',
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
  const btype = $('#cr-btype');
  const btypeOther = $('#cr-btype-other-wrap');
  btype.addEventListener('change', () => { btypeOther.hidden = btype.value !== 'Other'; });

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
    if (kind() === 'personal' && !shots.idFront) {
      const box = form.querySelector('[data-shot="idFront"]');
      box.classList.add('bad');
      errorEl.textContent = t('cr.err.license'); errorEl.hidden = false;
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
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
    if (kind() === 'personal' && !shots.idFront) {
      const box = form.querySelector('[data-shot="idFront"]');
      box.classList.add('bad');
      errorEl.textContent = t('cr.err.license'); errorEl.hidden = false;
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    if (!drawn) {
      errorEl.textContent = t('cr.err.signature'); errorEl.hidden = false;
      pad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false;
    }
    errorEl.hidden = true;
    return true;
  }

  /* ---------- Fotos tomadas con el teléfono ----------
     La imagen se reduce en el navegador y se guarda solo en memoria, para ir dentro del PDF. */
  const shots = {};
  function shrink(file, max = 1500) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ data: c.toDataURL('image/jpeg', 0.75), w: c.width, h: c.height });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')); };
      img.src = url;
    });
  }
  $$('.cr-shot', form).forEach(box => {
    const key = box.dataset.shot;
    const input = $('input[type="file"]', box);
    const prev = $('.cr-shot-prev', box);
    const clear = $('.cr-shot-clear', box);
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        shots[key] = await shrink(file);
        prev.src = shots[key].data;
        prev.hidden = false;
        clear.hidden = false;
        box.classList.remove('bad');
      } catch (e) {
        delete shots[key];
      }
    });
    clear.addEventListener('click', () => {
      delete shots[key];
      input.value = '';
      prev.hidden = true;
      prev.removeAttribute('src');
      clear.hidden = true;
    });
  });
  function wipeShots() {
    Object.keys(shots).forEach(k => delete shots[k]);
    $$('.cr-shot', form).forEach(box => {
      $('input[type="file"]', box).value = '';
      const prev = $('.cr-shot-prev', box);
      prev.hidden = true; prev.removeAttribute('src');
      $('.cr-shot-clear', box).hidden = true;
      box.classList.remove('bad');
    });
  }

  /* ---------- PDF firmado, generado en el navegador ---------- */
  let logoCache;
  async function logoData() {
    if (logoCache !== undefined) return logoCache;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'assets/logo-print.jpg'; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      logoCache = c.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      logoCache = null;                 // sin logo, el membrete sigue saliendo en texto
    }
    return logoCache;
  }

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
      $$('.cr-legal p, .cr-legal h3', form).forEach(p => {
        const lines = doc.splitTextToSize(p.textContent.trim(), W - M * 2);
        if (y + lines.length * 11 > H - 200) { doc.addPage(); y = M; }
        doc.text(lines, M, y); y += lines.length * 11 + 7;
      });
      head('Signature');
      if (data.kind === 'commercial') { line('Company', data.sCompany); line('Title', data.sTitle); }
      line('Signed by', data.signer);
      line('Agreement', 'Accepted electronically by the applicant');
    line('Marketing consent', data.marketing === 'yes' ? 'Yes — consent given' : 'No consent');
      // La firma se reduce a 600 px y se comprime: el PDF pasa de ~2 MB a unos pocos KB.
    const small = document.createElement('canvas');
    small.width = 600; small.height = Math.round(600 * pad.height / pad.width);
    const sctx = small.getContext('2d');
    sctx.fillStyle = '#FFFFFF'; sctx.fillRect(0, 0, small.width, small.height);
    sctx.drawImage(pad, 0, 0, small.width, small.height);
    const sig = small.toDataURL('image/jpeg', 0.85);
      const sw = 230; const sh = sw * (pad.height / pad.width);
      if (y + sh + 60 > H) { doc.addPage(); y = M; }
      doc.addImage(sig, 'JPEG', M, y, sw, sh);
      y += sh + 4;
      doc.setDrawColor(40); doc.line(M, y, M + sw, y);
      y += 14;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(15);
      doc.text(`I, ${data.signer}, am signing this application on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`, M, y);
      // Las fotos del teléfono entran como páginas del propio PDF, no como archivos sueltos.
      const photos = [
        ["Driver's license — front", shots.idFront],
        ["Driver's license — back", shots.idBack],
        ['Trade-in registration', shots.ptReg || shots.tReg],
      ].filter(([, img]) => img);
      photos.forEach(([title, img]) => {
        doc.addPage(); y = M;
        head(title);
        const maxW = W - M * 2;
        const maxH = H - y - M;
        const scale = Math.min(maxW / img.w, maxH / img.h);
        doc.addImage(img.data, 'JPEG', M, y, img.w * scale, img.h * scale);
      });
      return doc;
    };

    const personal = data.kind !== 'commercial';
    // Membrete: el logo original, la dirección, el teléfono y el correo de la empresa.
    const logo = await logoData();
    const LOGO = 74;
    if (logo) doc.addImage(logo, 'JPEG', M, y - 6, LOGO, LOGO);
    const tx = M + (logo ? LOGO + 16 : 0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(178, 31, 32);
    doc.text('CAR ADVISOR CORPORATION', tx, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(90);
    doc.text('1500 NW 89th Ct, Suite 112, Doral, FL 33172', tx, y + 22);
    doc.text('+1 (305) 600-6112  ·  +1 (786) 536-7332', tx, y + 33);
    doc.text('Hectormota@caradvisorcorporation.com', tx, y + 44);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15);
    doc.text(personal ? 'Personal Credit Application' : 'Business Credit Application', W - M, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110);
    doc.text(`Submitted online ${new Date().toLocaleString('en-US')}`, W - M, y + 22, { align: 'right' });
    y += LOGO + 6;
    doc.setDrawColor(210); doc.line(M, y, W - M, y);
    y += 14;

    const tradeFields = personal
      ? { year: data.ptYear, make: data.ptMake, model: data.ptModel, trim: data.ptTrim, vin: data.ptVin, owner: data.ptOwner, lien: data.ptLienholder, payment: data.ptPayment }
      : { year: data.tYear, make: data.tMake, model: data.tModel, trim: data.tTrim, vin: data.tVin, owner: data.tOwner, lien: data.tLienholder, payment: data.tPayment };
    const tradeBlock = () => {
      if (!tradeFields.year && !tradeFields.make && !tradeFields.model && !tradeFields.vin) return;
      head('Trade-in information');
      line('Vehicle', [tradeFields.year, tradeFields.make, tradeFields.model, tradeFields.trim].filter(Boolean).join(' '));
      line('VIN', tradeFields.vin);
      line('Name on the registration', tradeFields.owner);
      line('Lienholder', tradeFields.lien);
      line('Monthly payment', tradeFields.payment ? `$${tradeFields.payment}` : '');
    };

    head('Program type requested'); line('Program', data.program);
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
      tradeBlock();
      return finish();
    }

    head('Business');
    [['Business legal name', 'legalName'], ['DBA', 'dba'], ['Business type', null], ['SSN / Federal Tax ID', 'taxId'],
     ['State of organization', 'orgState'], ['Date business formed', 'formed'], ['Gross monthly income', 'grossMonthly'],
     ['Description of business', 'description'], ['Address', null], ['Phone', 'bPhone'], ['Fax', 'bFax'], ['Key contact', 'keyContact']]
      .forEach(([l, k]) => {
        if (l === 'Business type') return line(l, data.businessType === 'Other' ? `Other: ${data.businessTypeOther || ''}` : data.businessType);
        line(l, k ? data[k] : [data.bStreet, data.bCity, data.bState, data.bZip].filter(Boolean).join(', '));
      });
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

    tradeBlock();
    return finish();
  }

  /* ---------- Envío del correo con el PDF adjunto ----------
     FormSubmit solo acepta adjuntos en un envío de formulario normal (multipart), no por AJAX.
     Se arma un formulario oculto con el PDF y se manda a un iframe, así la página no se recarga.
     En el cuerpo del correo solo van el nombre y el tipo; el SSN y las cuentas viajan en el PDF. */
  function mail(doc, data) {
    const who = data.kind === 'commercial' ? data.gName : [data.iFirst, data.iLast].filter(Boolean).join(' ');
    const tipo = data.kind === 'commercial' ? 'comercial' : 'personal';
    const safe = v => String(v || 'solicitud').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    const file = new File([doc.output('blob')], `Credit-Application-${tipo}-${safe(who)}.pdf`, { type: 'application/pdf' });

    const frame = document.createElement('iframe');
    frame.name = `ca-post-${Date.now()}`;
    frame.style.display = 'none';
    document.body.appendChild(frame);

    const post = document.createElement('form');
    post.action = CFG.endpoint;
    post.method = 'POST';
    post.enctype = 'multipart/form-data';
    post.target = frame.name;
    post.style.display = 'none';
    const hidden = (name, value) => {
      const i = document.createElement('input');
      i.type = 'hidden'; i.name = name; i.value = value;
      post.appendChild(i);
    };
    hidden('_subject', `Nueva solicitud de crédito ${tipo} — ${who}${data.legalName ? ` (${data.legalName})` : ''}`);
    hidden('_template', 'box');
    hidden('_captcha', 'false');
    hidden('Tipo', tipo);
    hidden('Solicitante', who);
    hidden('Negocio', data.legalName || '—');
    hidden('Telefono', data.kind === 'commercial' ? (data.gCell || data.bPhone || '—') : (data.iCell || '—'));
    hidden('Correo', data.kind === 'commercial' ? (data.gEmail || '—') : (data.iEmail || '—'));
    hidden('Recibida', new Date().toLocaleString('en-US'));

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'attachment';
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    post.appendChild(fileInput);

    document.body.appendChild(post);
    return new Promise((resolve, reject) => {
      const done = () => { clearTimeout(timer); post.remove(); setTimeout(() => frame.remove(), 1000); resolve(); };
      const timer = setTimeout(() => { post.remove(); frame.remove(); reject(new Error('timeout')); }, 25000);
      frame.addEventListener('load', done, { once: true });
      post.submit();
    });
  }

  /* ---------- Borrado inmediato ---------- */
  function wipe() {
    form.reset();
    wipeShots();
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
      if (CFG.endpoint) await mail(doc, data);
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
