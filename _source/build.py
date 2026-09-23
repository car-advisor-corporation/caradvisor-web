#!/usr/bin/env python3
"""Build the Car Advisor demo.

Stitches the shared partials (head, header, footer, sprite, CTA band) around each
src/pages/*.html body and writes complete static pages to site/*.html.
Each page starts with a JSON front-matter comment: <!--{"title": ..., ...}-->
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT.parent
LIVE = "https://caradvisorcorporation.com"

# (slug, i18n key, English label). The order also drives the slide direction of page transitions.
NAV = [
    ("index", "nav.home", "Home"),
    ("inventory", "nav.inventory", "Inventory"),
    ("services", "nav.services", "Services"),
    ("about", "nav.about", "About"),
    ("faq", "nav.faq", "FAQ"),
    ("contact", "nav.contact", "Contact"),
]
# Live URLs each page replaces (they return 200 in both languages). Pages missing here are demo-only.
# La web nueva vive en el dominio principal con estas direcciones; las antiguas de WordPress
# redirigen aquí (ver REDIRECTS).
LIVE_PATH = {
    "index": "/", "inventory": "/inventory.html", "services": "/services.html",
    "about": "/about.html", "faq": "/faq.html", "contact": "/contact.html",
    "privacy": "/privacy.html", "terms": "/terms.html",
}
# Direcciones del WordPress viejo -> su equivalente en la web nueva.
REDIRECTS = {
    "about-us-modern": "about.html",
    "services-modern": "services.html",
    "contact-us": "contact.html",
    "faq": "faq.html",
    "inventory": "inventory.html",
    "testimonial": "about.html",
    "privacy-policy-2": "privacy.html",
    "terms-and-conditions": "terms.html",
    "add-car-2": "contact.html",
    "12659": "article.html?id=why-you-need-a-car-concierge",
    "12669": "article.html?id=hidden-dealer-fees",
    "12671": "article.html?id=electric-hybrid-or-gas",
    "es": "index.html?lang=es",
}
FRONT_MATTER = re.compile(r"\A\s*<!--(\{.*?\})-->\s*", re.S)


def partial(name):
    return (SRC / "partials" / name).read_text(encoding="utf-8")


def nav_html(active, is_page):
    """aria-current="page" on the page itself; "true" when the page only belongs to that section."""
    links = []
    for slug, key, label in NAV:
        current = ""
        indicator = ""
        if slug == active:
            current = ' aria-current="page"' if is_page else ' aria-current="true"'
            indicator = '<span class="nav-ind" aria-hidden="true"></span>'
        links.append(f'<a href="{slug}.html"{current}><span data-i18n="{key}">{label}</span>{indicator}</a>')
    links.append('<a class="nav-extra" href="credit.html"><span data-i18n="cta.credit">Credit Application</span></a>')
    links.append('<a class="nav-extra" href="insurance.html"><span>Car Advisor Insurance</span></a>')
    links.append('<a class="nav-extra" href="crp-now.html"><span>CRP Now</span></a>')
    return "\n      ".join(links)


def seo_tags(slug):
    path = LIVE_PATH.get(slug)
    if path is None:  # vehicle and article pages are built from ?id=: comparten un canonical
        return f'<link rel="canonical" href="{LIVE}/{slug}.html">'
    url = LIVE + path
    url_es = f"{url}{'&' if '?' in url else '?'}lang=es"
    return "\n".join([
        f'<link rel="canonical" href="{url}">',
        f'<link rel="alternate" hreflang="en" href="{url}">',
        f'<link rel="alternate" hreflang="es" href="{url_es}">',
        f'<link rel="alternate" hreflang="x-default" href="{url}">',
        f'<meta property="og:url" content="{url}">',
    ])


def version_assets(html):
    """Stamp css/js/asset URLs with a content hash, so a rebuild never serves a cached old file."""
    def stamp(m):
        path = OUT / m.group(2)
        if not path.exists():
            return m.group(0)
        digest = hashlib.md5(path.read_bytes()).hexdigest()[:8]
        return f'{m.group(1)}="{m.group(2)}?v={digest}"'
    return re.sub(r'(href|src)="((?:css|js|assets)/[^"?]+)"', stamp, html)


def fill(template, values):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m.group(1), ""), template)


def scripts(meta):
    tags = [f'<script src="js/i18n/{name}.js"></script>' for name in ["common", *meta.get("i18n", [])]]
    tags += [f'<script src="js/{src}"></script>' for src in meta.get("data", [])]
    tags += [f'<script src="{src}" defer></script>' for src in meta.get("cdn", [])]
    tags.append('<script src="js/core.js"></script>')
    tags.append('<script src="js/analytics.js"></script>')  # después de core.js: core reasigna window.CA
    tags += [f'<script src="js/{src}"></script>' for src in meta.get("js", [])]
    return "\n" + "\n".join(tags)


def build():
    head, header, footer, band = (partial(n) for n in ("head.html", "header.html", "footer.html", "band.html"))
    sprite = partial("sprite.svg")
    for page in sorted((SRC / "pages").glob("*.html")):
        raw = page.read_text(encoding="utf-8")
        match = FRONT_MATTER.match(raw)
        if not match:
            raise SystemExit(f"{page.name}: missing <!--{{...}}--> front matter")
        meta = json.loads(match.group(1))
        slug = page.stem
        section = meta.get("nav", slug)
        values = {
            "page": slug,
            "title": meta["title"],
            "title_key": meta["title_key"],
            "desc": meta["desc"],
            "desc_key": meta["desc_key"],
            "seo": seo_tags(slug),
            "preload": ('<link rel="preload" as="image" href="assets/logo-full-900.webp"'
                        ' imagesrcset="assets/logo-full-640.webp 640w, assets/logo-full-900.webp 900w,'
                        ' assets/logo-full-1187.webp 1187w" imagesizes="(max-width: 560px) 96vw, min(92vw, 1020px)">\n'
                        if slug == "index" else ""),
            "css": "".join(f'\n<link rel="stylesheet" href="css/{name}.css">' for name in meta.get("css", [])),
            "nav": nav_html(section, section == slug),
            "scripts": scripts(meta),
        }
        body = raw[match.end():].rstrip()
        if meta.get("band"):
            body += "\n\n" + band.strip()
        html = "\n".join([
            fill(head, values).rstrip(),
            f'<body data-page="{slug}">',
            sprite.strip(),
            fill(header, values).strip(),
            '<main id="main">',
            body,
            "</main>",
            fill(footer, values).strip(),
            "</body>",
            "</html>",
            "",
        ])
        (OUT / f"{slug}.html").write_text(version_assets(html), encoding="utf-8")
        print(f"built site/{slug}.html")


def car_redirects():
    """/cars/<slug>/ del WordPress -> la ficha del mismo vehículo en la web nueva."""
    data = (OUT / "js" / "data" / "inventory.js").read_text(encoding="utf-8")
    ids = re.findall(r'"id": "([^"]+)"', data)
    return {f"cars/{i}": f"vehicle.html?id={i}" for i in ids}


def write_redirects():
    """Páginas puente en las direcciones del WordPress viejo: llevan al visitante a la nueva y le
    dicen a Google que la página se ha mudado (canonical + redirección inmediata)."""
    routes = dict(REDIRECTS)
    routes.update(car_redirects())
    for old, new in routes.items():
        folder = OUT / old
        folder.mkdir(parents=True, exist_ok=True)
        target = f"{LIVE}/{new}"
        (folder / "index.html").write_text(
            "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            f'<link rel="canonical" href="{target}">\n'
            f'<meta http-equiv="refresh" content="0; url={target}">\n'
            "<title>Car Advisor</title>\n"
            f'<script>location.replace("{target}");</script>\n'
            "</head>\n<body>\n"
            f'<p>This page has moved to <a href="{target}">{target}</a>.</p>\n'
            "</body>\n</html>\n", encoding="utf-8")
    print(f"built {len(routes)} redirects")


def write_sitemap():
    data = (OUT / "js" / "data" / "inventory.js").read_text(encoding="utf-8")
    ids = re.findall(r'"id": "([^"]+)"', data)
    arts = re.findall(r'"id": "([^"]+)"', (OUT / "js" / "data" / "articles.js").read_text(encoding="utf-8"))
    urls = [LIVE + p for p in LIVE_PATH.values()]
    urls += [f"{LIVE}/vehicle.html?id={i}" for i in ids]
    urls += [f"{LIVE}/article.html?id={a}" for a in arts]
    body = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n",
        encoding="utf-8")
    (OUT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {LIVE}/sitemap.xml\n", encoding="utf-8")
    print(f"built sitemap with {len(urls)} urls")


if __name__ == "__main__":
    build()
    write_redirects()
    write_sitemap()
