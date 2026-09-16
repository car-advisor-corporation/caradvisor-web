/* Car Advisor — Spanish copy shared by every page (header, footer, CTA band) and strings built in JS.
   English lives in the HTML; each page adds its own keys with CA_I18N_ADD(). */
window.CA_I18N = { es: {}, dyn: { en: {}, es: {} } };
window.CA_I18N_ADD = pack => {
  Object.assign(window.CA_I18N.es, pack.es || {});
  Object.assign(window.CA_I18N.dyn.en, (pack.dyn && pack.dyn.en) || {});
  Object.assign(window.CA_I18N.dyn.es, (pack.dyn && pack.dyn.es) || {});
};

window.CA_I18N_ADD({
  es: {
    'skip': 'Saltar al contenido',
    'brand.home': 'Car Advisor — inicio',
    'nav.aria': 'Principal',
    'nav.home': 'Inicio',
    'nav.inventory': 'Inventario',
    'nav.services': 'Servicios',
    'nav.about': 'Nosotros',
    'nav.faq': 'Preguntas',
    'nav.contact': 'Contacto',
    'lang': 'Idioma',
    'cta.start': 'Iniciar mi solicitud',
    'menu': 'Menú',
    'crumbs': 'Ruta de navegación',

    'svc.1.t': 'Búsqueda personalizada',
    'svc.2.t': 'Negociación experta del precio',
    'svc.3.t': 'Financiamiento y leasing optimizados',
    'svc.4.t': 'Tasación de tu auto actual',
    'svc.5.t': 'Auditoría del contrato y el papeleo',
    'svc.6.t': 'Entrega VIP a domicilio',

    'band.title': 'Dinos qué auto quieres. Nosotros nos encargamos.',
    'band.text': 'Tres pasos cortos, sin compromiso. Un asesor te contacta como prefieras, en español o en inglés.',
    'band.wa': 'Escríbenos por WhatsApp',

    'ft.tagline': 'Consejo inteligente. Mejores decisiones. Cada milla.',
    'lg.priv': 'Política de privacidad',
    'lg.terms': 'Términos del servicio',
    'ft.explore': 'Explorar',
    'ft.services': 'Servicios',
    'ft.social': 'Car Advisor en redes sociales',
    'ft.contact': 'Contacto',
    'ft.demo': 'Los precios son el MSRP inicial del fabricante; las fotos son imágenes de referencia del mismo modelo.',
    'wa.aria': 'Chatear por WhatsApp',
    'mb.aria': 'Contacto rápido',
    'mb.call': 'Llamar',
    'mb.start': 'Empezar',
  },
  dyn: {
    en: {
      'wa.hello': "Hi Car Advisor, I'd like help finding my next vehicle.",
      'perMonth': '/mo',
      'inv.est': 'est. {amount}/mo',
      'body.suv': 'SUV', 'body.sedan': 'Sedan', 'body.hatch': 'Hatchback', 'body.pickup': 'Pickup', 'body.minivan': 'Minivan',
      'body.coupe': 'Coupe', 'body.convertible': 'Convertible', 'body.wagon': 'Wagon',
      'fuel.gas': 'Gas', 'fuel.hybrid': 'Hybrid', 'fuel.phev': 'Plug-in hybrid', 'fuel.electric': 'Electric', 'fuel.diesel': 'Diesel',
      'cond.new': 'New', 'cond.used': 'Used', 'cond.cert': 'Certified',
    },
    es: {
      'wa.hello': 'Hola Car Advisor, quiero ayuda para encontrar mi próximo vehículo.',
      'perMonth': '/mes',
      'inv.est': 'aprox. {amount}/mes',
      'body.suv': 'SUV', 'body.sedan': 'Sedán', 'body.hatch': 'Hatchback', 'body.pickup': 'Pickup', 'body.minivan': 'Minivan',
      'body.coupe': 'Coupé', 'body.convertible': 'Convertible', 'body.wagon': 'Familiar',
      'fuel.gas': 'Gasolina', 'fuel.hybrid': 'Híbrido', 'fuel.phev': 'Híbrido enchufable', 'fuel.electric': 'Eléctrico', 'fuel.diesel': 'Diésel',
      'cond.new': 'Nuevo', 'cond.used': 'Usado', 'cond.cert': 'Certificado',
    },
  },
});
