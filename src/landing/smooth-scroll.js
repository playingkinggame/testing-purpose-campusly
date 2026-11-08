// Smooth scrolling.
//
// Lenis runs only on fine pointers (mouse / trackpad) and only when reduced
// motion is off. Touch devices keep their native momentum, keyboard and
// scrollbar scrolling stay native everywhere, and anchors still work when JS
// or Lenis is unavailable.

import Lenis from 'lenis';

export function initSmoothScroll() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const lenis = (!reduceMotion && finePointer)
    ? new Lenis({
        autoRaf: false,
        // A little quicker than 0.11 keeps the page connected to the wheel
        // while still removing the stepped feel of native wheel scrolling.
        lerp: 0.14,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
      })
    : null;

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.05 });
      else target.scrollIntoView();
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', hash);
      }
    });
  });

  return lenis;
}
