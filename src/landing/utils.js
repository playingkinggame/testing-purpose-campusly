// Tiny shared helpers for the landing page.
// Keeping these here means every module clamps and eases the same way.

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

// Normalised progress of `p` inside the [start, end] window, clamped to 0..1.
export function seg(progress, start, end) {
  return clamp((progress - start) / (end - start));
}

// Smooth "ease in and out" used by the story timeline and the stat counters.
export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// The app is a separate HTML page, so every CTA is a normal navigation.
export function goToApp(page) {
  window.location.href = `/app.html#/${page}`;
}

export function bindAppButton(id, page) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', (event) => {
    event.preventDefault();
    goToApp(page);
  });
}
