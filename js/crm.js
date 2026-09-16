/* Puente con el CRM (DriveCentric u otro).

   Todo el sector del automóvil recibe leads en ADF/XML, así que el lead se arma en ese formato y se
   entrega a un endpoint que lo envía al correo de leads del CRM. Mientras no haya endpoint, el lead
   se guarda en este navegador y el visitante sigue por WhatsApp: nada se pierde y nada sale fuera.

   Para activarlo solo hay que poner la URL en CA_CRM.endpoint (y el correo de leads en el endpoint).

   El contexto del visitante (qué vehículos miró, de dónde llegó) vive en sessionStorage: se borra al
   cerrar la pestaña, no es una cookie de seguimiento y no viaja a ningún sitio hasta que la persona
   envía el formulario. */
window.CA_CRM = {
  endpoint: '',                    // p. ej. 'https://leads.caradvisorcorporation.com/adf'
  provider: 'Car Advisor Website',
  providerService: 'caradvisorcorporation.com',
  dealerName: 'Car Advisor Corporation',
  queueKey: 'ca-lead-queue',
};

(() => {
  'use strict';
  const CFG = window.CA_CRM;
  const TRACK = 'ca-visit';
  const MAX_SEEN = 12;

  const session = {
    get() {
      try { return JSON.parse(sessionStorage.getItem(TRACK) || '{}'); } catch (e) { return {}; }
    },
    set(v) {
      try { sessionStorage.setItem(TRACK, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    },
  };

  /* De dónde llegó el visitante: se guarda la primera vez y no se pisa después. */
  function firstTouch() {
    const v = session.get();
    if (v.source) return v;
    const p = new URLSearchParams(location.search);
    v.source = p.get('utm_source') || (document.referrer ? new URL(document.referrer, location.href).hostname : 'direct');
    v.medium = p.get('utm_medium') || '';
    v.campaign = p.get('utm_campaign') || '';
    v.landing = location.pathname + location.search;
    v.startedAt = new Date().toISOString();
    v.seen = v.seen || [];
    session.set(v);
    return v;
  }

  /* Cada ficha de vehículo que se abre queda anotada, con cuántas veces se ha vuelto a ella. */
  function sawVehicle(car) {
    if (!car || !car.id) return;
    const v = firstTouch();
    v.seen = v.seen || [];
    const prev = v.seen.find(s => s.id === car.id);
    if (prev) { prev.views += 1; prev.at = new Date().toISOString(); }
    else {
      v.seen.push({
        id: car.id, views: 1, at: new Date().toISOString(),
        year: car.year, make: car.make, model: car.model, trim: car.trim || '',
        price: car.price, stock: car.stock || '', vin: car.vin || '', cond: car.cond || '',
      });
    }
    v.seen = v.seen.slice(-MAX_SEEN);
    session.set(v);
  }

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  function splitName(full) {
    const parts = String(full || '').trim().split(/\s+/);
    return { first: parts.shift() || '', last: parts.join(' ') };
  }

  /* Lead en ADF/XML: es lo que DriveCentric y el resto de CRM del sector saben leer. */
  function adf(lead) {
    const v = lead.visit || {};
    const car = lead.car || (v.seen && v.seen.length ? v.seen[v.seen.length - 1] : null);
    const name = splitName(lead.name);
    const comments = [
      lead.vehicle ? `Vehículo de interés: ${lead.vehicle}` : '',
      lead.budget ? `Presupuesto: ${lead.budget}` : '',
      lead.trade === 'yes' ? `Entrega a cambio: ${lead.tradeVehicle || 'sí'}` : '',
      lead.contact ? `Prefiere que le contacten por: ${lead.contact}` : '',
      lead.message || '',
      v.seen && v.seen.length ? `Vehículos vistos: ${v.seen.map(s => `${s.year} ${s.make} ${s.model}${s.views > 1 ? ` (x${s.views})` : ''}`).join(' · ')}` : '',
      v.source ? `Origen: ${v.source}${v.medium ? ` / ${v.medium}` : ''}${v.campaign ? ` / ${v.campaign}` : ''}` : '',
      lead.lang ? `Idioma: ${lead.lang === 'es' ? 'español' : 'inglés'}` : '',
    ].filter(Boolean).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
 <prospect status="new">
  <requestdate>${new Date().toISOString()}</requestdate>
  <vehicle interest="buy" status="${car && car.cond === 'new' ? 'new' : 'used'}">
   <year>${esc(car && car.year)}</year>
   <make>${esc(car && car.make)}</make>
   <model>${esc(car && car.model)}</model>
   <trim>${esc(car && car.trim)}</trim>
   <stock>${esc(car && car.stock)}</stock>
   <vin>${esc(car && car.vin)}</vin>
   <price type="asking" currency="USD">${esc(car && car.price)}</price>
  </vehicle>
  <customer>
   <contact>
    <name part="first">${esc(name.first)}</name>
    <name part="last">${esc(name.last)}</name>
    <email>${esc(lead.email)}</email>
    <phone type="voice" time="nopreference">${esc(lead.phone)}</phone>
   </contact>
   <comments>${esc(comments)}</comments>
  </customer>
  <vendor>
   <vendorname>${esc(CFG.dealerName)}</vendorname>
  </vendor>
  <provider>
   <name part="full">${esc(CFG.provider)}</name>
   <service>${esc(CFG.providerService)}</service>
  </provider>
 </prospect>
</adf>`;
  }

  /* Mientras no haya endpoint, el lead se queda en cola en este navegador. */
  function queue(lead) {
    try {
      const q = JSON.parse(localStorage.getItem(CFG.queueKey) || '[]');
      q.push({ at: new Date().toISOString(), lead });
      localStorage.setItem(CFG.queueKey, JSON.stringify(q.slice(-50)));
    } catch (e) { /* sin almacenamiento */ }
  }

  async function send(lead) {
    const payload = Object.assign({}, lead, { visit: firstTouch(), lang: document.documentElement.lang });
    payload.adf = adf(payload);
    if (!CFG.endpoint) { queue(payload); return { sent: false, reason: 'sin-endpoint' }; }
    try {
      const r = await fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { sent: true };
    } catch (err) {
      queue(payload);          // si el CRM no responde, el lead no se pierde
      return { sent: false, reason: err.message };
    }
  }

  window.CA = window.CA || {};
  window.CA.crm = { firstTouch, sawVehicle, adf, send, visit: () => session.get() };
  firstTouch();
})();
