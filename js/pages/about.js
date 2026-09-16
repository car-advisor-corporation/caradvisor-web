/* About: the YouTube video loads only when the visitor presses play. */
(() => {
  'use strict';
  const { $, t, CONFIG } = window.CA;
  const button = $('#video button');
  if (!button) return;
  button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${CONFIG.videoId}?autoplay=1&playsinline=1&rel=0`;
    frame.title = t('video.title');
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    button.replaceWith(frame);
    frame.focus();
  });
})();
