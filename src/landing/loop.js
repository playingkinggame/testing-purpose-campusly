// One requestAnimationFrame loop for the whole landing page.
// Modules register an update function; each call receives dt in seconds
// (capped so a dropped frame cannot teleport anything) and the raw time in ms.
//
// This replaces the two separate loops the page used to run (hero carousel and
// story scroll) plus the stat-count loop. One loop means one clock, one layout
// read per frame, and no competing work in the same frame.

const tasks = new Set();
let frameId = 0;
let lastTime = 0;

function frame(now) {
  // Queue the next frame before running anything: one throwing task must not
  // be able to stop the whole page's animation clock.
  frameId = requestAnimationFrame(frame);
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.064) : 1 / 60;
  lastTime = now;
  tasks.forEach((task) => task(dt, now));
}

export function addTask(task) {
  tasks.add(task);
  if (!frameId) {
    lastTime = 0;
    frameId = requestAnimationFrame(frame);
  }
  return () => tasks.delete(task);
}
