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
