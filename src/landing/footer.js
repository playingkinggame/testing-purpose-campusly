// Footer: wordmark fitting + a video that only loads when you get near it.
// The video tag ships with preload="none" and no src; we copy data-src across
// once the footer is within a screen of the viewport.

export function initFooter() {
  const footSec = document.getElementById('footer');
  if (!footSec) return;

  const wordmark = footSec.querySelector('.foot-wordmark');
  if (wordmark) {
    const fitWordmark = () => {
      wordmark.style.fontSize = '';
      const base = parseFloat(getComputedStyle(wordmark).fontSize);
      const width = wordmark.getBoundingClientRect().width;
      if (width > 0) {
        wordmark.style.fontSize = (base * (footSec.clientWidth * 0.97) / width) + 'px';
      }
    };

    fitWordmark();
    window.addEventListener('resize', fitWordmark);
    window.addEventListener('load', fitWordmark);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWordmark);
  }

  const video = footSec.querySelector('.foot-video');
  if (!video) return;

  let loaded = false;
  let near = false;

  function loadVideo() {
    if (loaded) return;
    loaded = true;
    const source = video.getAttribute('data-src');
    if (!source) return;
    video.src = source;
    video.load();
  }

  function playVideo() {
    const result = video.play();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        near = entry.isIntersecting;
        if (near) {
          loadVideo();
          playVideo();
        } else {
          video.pause();
        }
      });
    }, { rootMargin: '300px 0px', threshold: 0.01 });
    observer.observe(video);
  } else {
    loadVideo();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else if (near) playVideo();
  });
}
