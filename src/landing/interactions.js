// Pointer micro-interactions: damped 3D tilt with a soft glare on the solution
// cards, and magnetic hover + press feedback on the two main CTAs.
//
// Nothing here assigns styles straight from a pointer event. Events only set
// targets; the master loop damps towards them with a time-based factor, so the
// motion feels identical at 60, 90 or 144 Hz.

import { addTask } from './loop.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function setupTilt() {
  return Array.from(document.querySelectorAll('[data-tilt]')).map((card) => {
    const glare = document.createElement('span');
    glare.className = 'story-sol-glare';
    glare.setAttribute('aria-hidden', 'true');
    const content = card.querySelector('.story-sol-card-content');
    card.insertBefore(glare, content);

    const state = {
      el: card,
      glare,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      gx: 50,
      gy: 50,
      hover: 0,
      hoverTarget: 0,
      cleared: true,
      rect: null,
    };

    card.addEventListener('pointerenter', () => {
      state.rect = card.getBoundingClientRect();
      state.hoverTarget = 1;
    });

    card.addEventListener('pointermove', (event) => {
      if (!state.rect) return;
      const px = clamp((event.clientX - state.rect.left) / state.rect.width, 0, 1);
      const py = clamp((event.clientY - state.rect.top) / state.rect.height, 0, 1);
      state.tx = (px - 0.5) * 2;
      state.ty = (py - 0.5) * 2;
      state.gx = px * 100;
      state.gy = py * 100;
    });

    card.addEventListener('pointerleave', () => {
      state.hoverTarget = 0;
      state.tx = 0;
      state.ty = 0;
      state.rect = null;
    });

    return state;
  });
}

function setupMagnets() {
  return Array.from(document.querySelectorAll('[data-magnetic]')).map((el) => {
    const state = {
      el,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      hover: 0,
      hoverTarget: 0,
      pressed: 0,
      scale: 1,
      cleared: true,
      rect: null,
    };

    el.addEventListener('pointerenter', () => {
      state.rect = el.getBoundingClientRect();
      state.hoverTarget = 1;
    });

    el.addEventListener('pointermove', (event) => {
      if (!state.rect) return;
      const centerX = state.rect.left + state.rect.width / 2;
      const centerY = state.rect.top + state.rect.height / 2;
      state.tx = clamp((event.clientX - centerX) * 0.16, -9, 9);
      state.ty = clamp((event.clientY - centerY) * 0.22, -7, 7);
    });

    el.addEventListener('pointerleave', () => {
      state.hoverTarget = 0;
      state.tx = 0;
      state.ty = 0;
      state.rect = null;
    });

    el.addEventListener('pointerdown', () => { state.pressed = 1; });
    window.addEventListener('pointerup', () => { state.pressed = 0; });
    window.addEventListener('pointercancel', () => { state.pressed = 0; });

    return state;
  });
}

export function initInteractions() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;

  if (reduceMotion || !canHover) {
    return { update: () => {} };
  }

  const tilts = setupTilt();
  const magnets = setupMagnets();

  function update(dt) {
    const tiltK = 1 - Math.exp(-dt * 12);
    tilts.forEach((state) => {
      state.x += (state.tx - state.x) * tiltK;
      state.y += (state.ty - state.y) * tiltK;
      state.hover += (state.hoverTarget - state.hover) * (1 - Math.exp(-dt * 10));

      const settled = state.hoverTarget === 0
        && Math.abs(state.x) < 0.0005
        && Math.abs(state.y) < 0.0005
        && state.hover < 0.002;

      if (settled) {
        if (!state.cleared) {
          state.el.style.transform = '';
          state.glare.style.opacity = '0';
          state.cleared = true;
        }
        return;
      }

      state.cleared = false;
      state.el.style.transform = `perspective(1000px) rotateY(${(state.x * 6).toFixed(3)}deg) rotateX(${(-state.y * 6).toFixed(3)}deg)`;
      state.glare.style.opacity = (state.hover * 0.5).toFixed(3);
      state.glare.style.transform = `translate3d(${((state.gx - 50) * 0.6).toFixed(2)}%, ${((state.gy - 50) * 0.6).toFixed(2)}%, 0)`;
    });

    const magnetK = 1 - Math.exp(-dt * 14);
    magnets.forEach((state) => {
      state.x += (state.tx - state.x) * magnetK;
      state.y += (state.ty - state.y) * magnetK;
      state.hover += (state.hoverTarget - state.hover) * (1 - Math.exp(-dt * 12));

      const targetScale = 1 + state.hover * 0.02 - state.pressed * 0.045;
      state.scale += (targetScale - state.scale) * (1 - Math.exp(-dt * 18));

      const settled = state.hoverTarget === 0
        && state.pressed === 0
        && Math.abs(state.x) < 0.005
        && Math.abs(state.y) < 0.005
        && Math.abs(state.scale - 1) < 0.0005;

      if (settled) {
        if (!state.cleared) {
          state.el.style.transform = '';
          state.cleared = true;
        }
        return;
      }

      state.cleared = false;
      state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) scale(${state.scale.toFixed(4)})`;
    });
  }

  addTask(update);
  return { update };
}
