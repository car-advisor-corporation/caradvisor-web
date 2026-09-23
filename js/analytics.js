/* Medición: Google Analytics 4, Tag Manager, Google Ads y Meta Pixel.

   Nada se carga mientras los identificadores estén vacíos: la web funciona igual y no sale ni una
   petición a terceros. Para encenderlo solo hay que rellenar CA_ANALYTICS aquí abajo y publicar.

   Qué se envía: el nombre del evento y un par de datos del vehículo o del formulario. Nunca datos
   personales. La solicitud de crédito avisa de que se envió, y nada más: ni nombre, ni teléfono,
   ni correo, ni SSN, ni cuentas. Eso solo viaja en el PDF firmado que va a Héctor.

   Si se usa Tag Manager, deja ga4/ads/meta vacíos y mete las etiquetas dentro del contenedor: los
   mismos eventos llegan al dataLayer y se configuran desde ahí sin tocar el código de la web. */
window.CA_ANALYTICS = {
  gtm: '',            // 'GTM-XXXXXXX'   contenedor de Tag Manager (recomendado si lo lleva marketing)
  ga4: '',            // 'G-XXXXXXXXXX'  Google Analytics 4
  ads: '',            // 'AW-XXXXXXXXX'  Google Ads
  adsLabels: {        // etiquetas de conversión de Google Ads, una por acción
    lead: '',         // 'AW-XXXXXXXXX/AbC-D_efGh'
    credit: '',
    call: '',
    whatsapp: '',
  },
  meta: '',           // '123456789012345'  Meta/Facebook Pixel
  debug: false,       // true escribe cada evento en la consola, para comprobar sin enviar nada
};

(() => {
  'use strict';
  const CFG = window.CA_ANALYTICS;
  const on = !!(CFG.gtm || CFG.ga4 || CFG.ads || CFG.meta);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function script(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  /* ---------- Carga ---------- */
  if (CFG.gtm) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    script(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(CFG.gtm)}`);
  }

  if (CFG.ga4 || CFG.ads) {
    const first = CFG.ga4 || CFG.ads;
    script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(first)}`);
    gtag('js', new Date());
    /* Sin anuncios personalizados por defecto: es lo correcto y evita problemas de privacidad. */
    if (CFG.ga4) gtag('config', CFG.ga4, { allow_google_signals: false, allow_ad_personalization_signals: false });
    if (CFG.ads) gtag('config', CFG.ads);
  }

  if (CFG.meta) {
    /* Carga del pixel de Meta, escrita a mano en vez del fragmento minificado que dan ellos. */
    const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = window._fbq = fbq;
    script('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', CFG.meta);
    fbq('track', 'PageView');
  }

  /* ---------- Envío ---------- */
  /* Un solo sitio por donde pasa todo, así no se duplican eventos ni se cuela un dato personal. */
  const SENSITIVE = /name|mail|phone|ssn|ein|dob|birth|account|routing|address|licen|income|salary/i;
  function clean(params) {
    const out = {};
    Object.keys(params || {}).forEach(k => {
      if (SENSITIVE.test(k)) return;
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  const META_NAME = { generate_lead: 'Lead', credit_application: 'SubmitApplication', view_vehicle: 'ViewContent' };

  function track(event, params) {
    const data = clean(params);
    if (CFG.debug) console.log('[medición]', event, data);
    if (!on) return;

    window.dataLayer.push(Object.assign({ event }, data));
    if (CFG.ga4) gtag('event', event, data);

    const label = CFG.adsLabels[({ generate_lead: 'lead', credit_application: 'credit', phone_call: 'call', whatsapp_click: 'whatsapp' })[event]];
    if (CFG.ads && label) gtag('event', 'conversion', { send_to: label });

    if (CFG.meta) {
      const name = META_NAME[event];
      if (name) window.fbq('track', name, data);
      else window.fbq('trackCustom', event, data);
    }
  }

  /* ---------- Eventos automáticos ---------- */
  /* Llamadas y WhatsApp: se cuentan en cuanto alguien pulsa, que es lo más cerca que se puede
     estar de una llamada real sin pagar un servicio de seguimiento de llamadas. */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="tel:"], a[href*="wa.me/"]');
    if (!a) return;
    const tel = a.getAttribute('href').startsWith('tel:');
    track(tel ? 'phone_call' : 'whatsapp_click', {
      numero: tel ? a.getAttribute('href').replace('tel:', '') : 'whatsapp',
      seccion: a.closest('.mbar') ? 'barra-movil' : (a.closest('footer') ? 'pie' : 'pagina'),
      pagina: location.pathname,
    });
  }, true);

  window.CA = window.CA || {};
  window.CA.track = track;
  window.CA.analyticsOn = on;
})();
