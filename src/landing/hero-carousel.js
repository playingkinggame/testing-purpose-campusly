// Curved, draggable hero carousel.
// The maths is unchanged from the original inline script: cards ride a curve,
// grow towards the middle and are clipped with a rounded quad path.
//
// It no longer owns a requestAnimationFrame loop: initHeroCarousel returns an
// update(dt) function that the master loop calls.

export function initHeroCarousel() {
  const carouselWrap = document.getElementById('heroCarousel');
  if (!carouselWrap) return null;
  // Card 0 is already real HTML: it carries the LCP image, so reuse it.
  const firstCard = carouselWrap.querySelector('.hero-card');

  const mockProfiles = [
    { name: 'Aarav Sharma', tag: 'CSE · 2nd yr', tile: 0 },
    { name: 'Sneha Reddy', tag: 'ECE · 3rd yr', tile: 1 },
    { name: 'Rohan V.', tag: 'SCOPE · 4th yr', tile: 2 },
    { name: 'Ananya Iyer', tag: 'ECM · 2nd yr', tile: 3 },
    { name: 'Devansh Roy', tag: 'Mech · 3rd yr', tile: 4 },
    { name: 'Kavya Menon', tag: 'Biotech · 1st yr', tile: 5 },
    { name: 'Siddharth Jain', tag: 'AI/ML · 2nd yr', tile: 6 },
    { name: 'Pooja Patel', tag: 'Civil · 4th yr', tile: 7 },
    { name: 'Varun Nair', tag: 'SENSE · 3rd yr', tile: 8 },
    { name: 'Meera Krishnan', tag: 'Data Sci · 2nd yr', tile: 9 },
  ];

  const numCards = 10;
  const cards = [];
  const videoSrc = '/media/hero-grid.mp4';
  const posterSrc = '/media/hero-grid-poster.webp';

  for (let i = 0; i < numCards; i++) {
    const card = i === 0 && firstCard ? firstCard : document.createElement('div');
    card.className = 'hero-card';

    const col = i % 5;
    const row = Math.floor(i / 5);

    const prof = mockProfiles[i];
    const initial = prof.name.charAt(0);

    if (card !== firstCard) card.innerHTML = `
      <div class="hero-card-media">
        <img class="hero-card-poster" src="${posterSrc}" alt="Reel clip" style="left: -${col * 100}%; top: -${row * 100}%;" />
        <video class="hero-card-video" src="${videoSrc}" poster="${posterSrc}" muted loop playsinline preload="none" style="left: -${col * 100}%; top: -${row * 100}%;"></video>
        <div class="hero-card-overlay"></div>
        <div class="hero-card-play">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"></polygon></svg>
        </div>
        <div class="hero-card-chip">
          <div class="hero-chip-avatar">${initial}</div>
          <div class="hero-chip-info">
            <span class="hero-chip-name">${prof.name}</span>
            <span class="hero-chip-meta">${prof.tag}</span>
          </div>
        </div>
      </div>
    `;
    if (card !== firstCard) carouselWrap.appendChild(card);
    cards.push({ el: card, index: i, focus: false });
  }

  // Responsive scale: one source of truth for CSS (--u) and the JS carousel maths.
  const heroSec = document.getElementById('hero');
  const MOBILE_BP = 820;
  let U = 1;        // px per design unit
  let CX = 720;     // carousel centre-x in px, relative to the carousel box
  let YOFF = 470;   // design-space y of the carousel box top
  let needsRender = true;

  function layoutMetrics() {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (vw <= MOBILE_BP) {
      heroSec.style.removeProperty('--u');
      U = Math.max(0.55, Math.min(vw / 560, 0.95));
      YOFF = 487;
      carouselWrap.style.setProperty('--u', U + 'px');
    } else {
      U = Math.min(vw / 1440, vh / 1080);
      YOFF = 470;
      heroSec.style.setProperty('--u', U + 'px');
      carouselWrap.style.removeProperty('--u');
    }
    CX = carouselWrap.clientWidth / 2;
    needsRender = true;
  }
  layoutMetrics();
  window.addEventListener('resize', layoutMetrics);

  // Video decoding is expensive: only cards that are actually on screen are
  // allowed to play. Everything else stays on its poster frame.
  let heroVisible = true;
  const heroVideos = Array.from(carouselWrap.querySelectorAll('video'));
  const onScreen = new Map();

  const playVideo = (video) => {
    const result = video.play();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  };

  const syncVideos = () => {
    heroVideos.forEach((video) => {
      if (heroVisible && !document.hidden && onScreen.get(video)) playVideo(video);
      else video.pause();
    });
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      syncVideos();
    }, { threshold: 0 }).observe(heroSec);

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => onScreen.set(entry.target, entry.isIntersecting));
      syncVideos();
    }, { rootMargin: '80px 0px', threshold: 0.01 });
    heroVideos.forEach((video) => videoObserver.observe(video));
  }

  document.addEventListener('visibilitychange', syncVideos);

  // Carousel physics & motion. All timing is seconds, supplied by the loop.
  let scrollOffset = 0;
  let isDragging = false;
  let lastX = 0;
  let velocity = 0;
  let autoScroll = false; // gentle drift starts after the first real interaction
  const baseSpeed = 60; // design units per second (60 = one unit per frame at 60fps)

  function enableAutoScroll() {
    if (autoScroll) return;
    autoScroll = true;
    needsRender = true;
  }

  // Keeping the carousel still until the visitor interacts keeps the hero
  // poster static for LCP and avoids per-frame layout work on an idle page.
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, enableAutoScroll, { once: true, passive: true });
  });
  window.addEventListener('scroll', enableAutoScroll, { once: true, passive: true });

  function updateCarousel(dt) {
    const u = U;
    const totalWidth = numCards * 196;
    const moving = isDragging || autoScroll;
    if (!moving && !needsRender) return;

    if (!isDragging && autoScroll) {
      velocity *= Math.pow(0.05, dt); // decays 95% per second
      if (Math.abs(velocity) < 0.1) velocity = 0;
      scrollOffset += (baseSpeed + velocity) * dt;
    }

    cards.forEach((c) => {
      let unpushedOffset = ((c.index * 196 - scrollOffset) % totalWidth + totalWidth) % totalWidth;
      if (unpushedOffset > totalWidth / 2) unpushedOffset -= totalWidth;

      const t = unpushedOffset;
      const x = 720 + t * (1 + 0.083 * Math.pow(t / 706, 2));
      const d = Math.abs(x - 720) / 706;

      const cardW = 170 + 48 * Math.pow(d, 2);
      const yCenter = 687 - 12 * Math.pow(d, 2);

      const qLeft = Math.abs((x - cardW / 2) - 720) / 706;
      const qRight = Math.abs((x + cardW / 2) - 720) / 706;
      const hLeft = 280 + 92 * Math.pow(qLeft, 2.6);
      const hRight = 280 + 92 * Math.pow(qRight, 2.6);
      const maxH = Math.max(hLeft, hRight);

      const wPx = cardW * u;
      const maxHPx = maxH * u;
      const xPx = CX + (x - 720 - cardW / 2) * u;
      const yPx = (yCenter - YOFF - maxH / 2) * u;

      c.el.style.width = `${wPx}px`;
      c.el.style.height = `${maxHPx}px`;
      c.el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0)`;

      // Rounded quad clip path.
      const cornerR = 15 * u;
      const topL = (maxH - hLeft) / 2 * u;
      const botL = topL + hLeft * u;
      const topR = (maxH - hRight) / 2 * u;
      const botR = topR + hRight * u;

      c.el.style.clipPath = `path('M 0 ${topL + cornerR} Q 0 ${topL} ${cornerR} ${topL} L ${wPx - cornerR} ${topR} Q ${wPx} ${topR} ${wPx} ${topR + cornerR} L ${wPx} ${botR - cornerR} Q ${wPx} ${botR} ${wPx - cornerR} ${botR} L ${cornerR} ${botL} Q 0 ${botL} 0 ${botL - cornerR} Z')`;

      // Only the two or three centre cards keep real glass blur. Ten blurred
      // chips sliding every frame is one of the most expensive things on the page.
      const focus = d < 0.24;
      if (focus !== c.focus) {
        c.focus = focus;
        c.el.classList.toggle('is-focus', focus);
      }
    });
    needsRender = false;
  }

  function update(dt) {
    if (!heroVisible) return;
    updateCarousel(dt);
  }

  // Pointer events for drag.
  carouselWrap.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    velocity = 0;
    carouselWrap.classList.add('grabbing');
    carouselWrap.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = (e.clientX - lastX) / U;
    scrollOffset -= dx;
    velocity = -dx * 30;
    lastX = e.clientX;
  });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    carouselWrap.classList.remove('grabbing');
    try { carouselWrap.releasePointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  return { update };
}
