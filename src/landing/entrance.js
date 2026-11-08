// Hero entrance timeline.
//
// Everything below shares one clock and one easing curve, so the nav, badge,
// headline lines, subline, carousel and CTA read as one choreographed move
// instead of seven unrelated CSS animations. Only transform and opacity are
// touched, and will-change is removed as soon as each item lands.

import { addTask } from './loop.js';

// Expo-out: the closest cheap match to cubic-bezier(.16, 1, .3, 1).
function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

const ITEMS = [
  { selector: '.hero-nav', delay: 0.02, duration: 0.80, y: -18 },
  { selector: '.hero-badge', delay: 0.08, duration: 0.75, y: 14, scale: 0.94 },
  { selector: '.hero-headline', delay: 0.14, duration: 0.95, y: 26 },
  { selector: '.hero-headline-line2', delay: 0.22, duration: 0.95, y: 26 },
  { selector: '.hero-subline', delay: 0.30, duration: 0.90, y: 18 },
  // The carousel is the LCP element. It must not start at opacity 0: the
  // preloader already covers its reveal, and fading it in again delays LCP
  // badly on slow devices. It stays visible and the loop moves it into frame.
  { selector: '.hero-cta-box', delay: 0.48, duration: 0.90, y: 20 },
];

export function createEntrance() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items = ITEMS
    .map((item) => ({ ...item, el: document.querySelector(item.selector), done: false }))
    .filter((item) => item.el);

  let started = false;
  let elapsed = 0;
  let remaining = items.length;
  let stopLoop = null;

  function finishItem(item) {
    item.el.style.opacity = '';
    item.el.style.transform = '';
    item.el.style.willChange = '';
    item.done = true;
    remaining--;
    if (remaining === 0 && stopLoop) stopLoop();
  }

  function update(dt) {
    elapsed += dt;
    items.forEach((item) => {
      if (item.done) return;
      const progress = Math.max(0, Math.min(1, (elapsed - item.delay) / item.duration));
      if (progress >= 1) {
        finishItem(item);
        return;
      }
      const eased = easeOutExpo(progress);
      const y = (1 - eased) * item.y;
      const scale = item.scale ? 1 + (item.scale - 1) * (1 - eased) : 1;
      item.el.style.opacity = String(eased);
      item.el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)${item.scale ? ` scale(${scale.toFixed(4)})` : ''}`;
    });
  }

  function start() {
    if (started) return;
    started = true;
    if (reduceMotion) return; // final state is already visible

    items.forEach((item) => {
      item.el.style.willChange = 'transform, opacity';
      item.el.style.opacity = '0';
      item.el.style.transform = `translate3d(0, ${item.y}px, 0)${item.scale ? ` scale(${item.scale})` : ''}`;
    });
    stopLoop = addTask(update);
  }

  return { start };
}
