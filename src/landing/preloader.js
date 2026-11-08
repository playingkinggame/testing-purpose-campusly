// Boot preloader.
// Covers the hero until the hero poster is decoded (and, if a sequence is
// passed, the first batch of frames has arrived), then starts the entrance.
// A hard timeout means a slow network can delay the page by 2.5 s at most.

const MIN_FRAMES = 12;
const TIMEOUT_MS = 1500;

function whenPosterReady(image) {
  if (!image) return Promise.resolve();
  if (image.complete && image.naturalWidth > 0) {
    return image.decode ? image.decode().catch(() => {}) : Promise.resolve();
  }
  return new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });
}

export function createPreloader({ minimumFrames = MIN_FRAMES, timeout = TIMEOUT_MS } = {}) {
  const root = document.getElementById('preloader');
  const bar = document.getElementById('preloaderBar');
  let progress = 0;
  let finished = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });

  function setProgress(loadedCount) {
    const next = Math.max(0, Math.min(1, loadedCount / minimumFrames));
    if (next <= progress) return;
    progress = next;
    if (bar) bar.style.transform = `scaleX(${progress})`;
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (bar) bar.style.transform = 'scaleX(1)';
    document.documentElement.classList.add('is-ready');
    if (root) {
      root.classList.add('is-done');
      window.setTimeout(() => root.setAttribute('aria-hidden', 'true'), 600);
    }
    resolveDone();
  }

  function finishWhenReady({ poster, sequence } = {}) {
    const timeoutId = window.setTimeout(finish, timeout);
    const frames = sequence && sequence.firstBatch ? sequence.firstBatch : Promise.resolve();
    Promise.all([whenPosterReady(poster), frames])
      .then(() => {
        window.clearTimeout(timeoutId);
        finish();
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        finish();
      });
  }

  return { setProgress, finish, finishWhenReady, done };
}
