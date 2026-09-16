/* Article page: renders one post from ?id=, in the visitor's language, plus the other two. */
(() => {
  'use strict';
  const { $, t, esc, onLang } = window.CA;
  const LIST = window.CA_ARTICLES || [];
  const id = new URLSearchParams(window.location.search).get('id');
  const post = LIST.find(p => p.id === id) || LIST[0];
  const lang = () => (document.documentElement.lang === 'es' ? 'es' : 'en');

  function longDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString(lang() === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function card(p) {
    const l = lang();
    return `<li class="post"><a href="article.html?id=${encodeURIComponent(p.id)}">
      <div class="post-img"><img src="${esc(p.thumb)}" alt="" width="430" height="321" loading="lazy" decoding="async"></div>
      <p class="post-meta"><span>${esc(longDate(p.date))}</span><span>${esc(p.cat[l])}</span></p>
      <h3>${esc(p.title[l])}</h3>
      <span class="link-arrow"><span>${esc(t('ins.read'))}</span><svg aria-hidden="true"><use href="#i-arrow"/></svg></span>
    </a></li>`;
  }

  onLang(() => {
    const l = lang();
    document.title = `${post.title[l]} · Car Advisor`;
    $('#art-crumb').textContent = post.title[l];
    $('#art-cat').textContent = post.cat[l];
    $('#art-date').textContent = longDate(post.date);
    $('#art-title').textContent = post.title[l];
    $('#art-lede').textContent = post.lede[l];
    const img = $('#art-img');
    img.src = post.img;
    img.alt = post.title[l];
    $('#art-body').innerHTML = post.body[l].map(p => `<p>${esc(p)}</p>`).join('');
    $('#art-more').innerHTML = LIST.filter(p => p.id !== post.id).map(card).join('');
  });
})();
