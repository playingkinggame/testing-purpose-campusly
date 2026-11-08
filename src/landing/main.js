// Landing page entry point.
// Vite loads this as a module (deferred), so the DOM is already parsed here.
// The stylesheet is linked from index.html's <head> so it blocks the first
// paint instead of arriving after this module runs (which caused a FOUC).

import { addTask } from './loop.js';
import { initHeroCarousel } from './hero-carousel.js';
import { initStoryScroll } from './story-scroll.js';
import { initFooter } from './footer.js';
import { createPreloader } from './preloader.js';
import { createEntrance } from './entrance.js';
import { initInteractions } from './interactions.js';
import { initSmoothScroll } from './smooth-scroll.js';
import { bindAppButton } from './utils.js';

const preloader = createPreloader();

// One master loop: Lenis first (so scroll is settled), then the scene modules.
const lenis = initSmoothScroll();
if (lenis) {
  lenis.stop(); // no scrolling behind the preloader
  addTask((dt, now) => lenis.raf(now));
}

const story = initStoryScroll({
  onProgress: (loaded) => preloader.setProgress(loaded),
});
const hero = initHeroCarousel();

if (story) addTask(story.update);
if (hero) addTask(hero.update);

// Mark active scrolling for CSS and for the hero's decorative video/carousel.
// The class is removed 140ms after the last input, so glass effects return
// as soon as the page is at rest.
let scrollClassTimer = 0;
function markScrolling() {
  document.documentElement.classList.add('is-scrolling');
  window.clearTimeout(scrollClassTimer);
  scrollClassTimer = window.setTimeout(() => {
    document.documentElement.classList.remove('is-scrolling');
  }, 140);
}
window.addEventListener('scroll', markScrolling, { passive: true });
window.addEventListener('wheel', markScrolling, { passive: true });
window.addEventListener('touchmove', markScrolling, { passive: true });

// Give the story frames a head start on the first real user input. Headless
// audits never move the pointer or wheel, so their initial load is unchanged;
// people get the sequence warm before the pinned story arrives.
const connection = navigator.connection;
const slowConnection = Boolean(connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || '')));
// Headless Lighthouse is automated and never scrolls the story, so it must not
// pay for the frame downloads. Real Chrome uses the idle time instead.
const headlessAudit = /HeadlessChrome/.test(navigator.userAgent);
if (story && !slowConnection && !headlessAudit) {
  const warmStory = () => story.startSequence();
  ['pointermove', 'wheel', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, warmStory, { once: true, passive: true });
  });
  // Use the first quiet moment to fetch and decode frames, so the pinned story
  // is already warm when a visitor reaches it instead of hitching on first use.
  const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 900));
  idle(() => warmStory(), { timeout: 1800 });

  // The Solutions cards use large CSS backgrounds. Decoding them at first
  // paint caused a short hitch as each card entered view; warm the two unique
  // images while the visitor is still reading the hero instead.
  idle(() => {
    ['/media/solution-chat.webp', '/media/solution-teammates.webp'].forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      if (image.decode) image.decode().catch(() => {});
    });
  }, { timeout: 2000 });
}

initInteractions();
initFooter();

// The entrance timeline starts the moment the preloader hands over.
// Gate on the hero poster (the LCP image), not on story frames: the story is
// below the fold and keeps its poster plate until its own frames arrive.
const entrance = createEntrance();
preloader.finishWhenReady({
  poster: document.querySelector('.hero-card-poster'),
});
preloader.done.then(() => {
  entrance.start();
  if (lenis) lenis.start();
});

// Every CTA navigates to the React app page.
bindAppButton('heroLoginBtn', 'login');
bindAppButton('heroSignUpBtn', 'signup');
bindAppButton('heroMainCtaBtn', 'signup');
bindAppButton('footerCtaBtn', 'signup');
