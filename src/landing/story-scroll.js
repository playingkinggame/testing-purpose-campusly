// Pinned "floating island" story.
//
// Scroll progress drives the camera, the canvas frame sequence and every beat
// of copy. This module no longer runs its own rAF loop, never measures layout
// inside the frame loop, and never animates filter: blur on large text.
// initStoryScroll returns update(dt, now) for the master loop.

import { clamp, seg, easeInOut } from './utils.js';
import { FrameSequence } from './frame-sequence.js';

export function initStoryScroll({ onProgress } = {}) {
  const storySec = document.getElementById('story');
  const storyTrack = document.getElementById('storyTrack');
  if (!storySec || !storyTrack) return null;

  const storyCanvas = document.getElementById('storyCanvas');
  const storyPlate = document.getElementById('storyPlate');
  const storyCam = document.getElementById('storyCam');
  const storyCamF = document.getElementById('storyCamF');
  const storyFog = document.getElementById('storyFog');
  const storyL0 = document.getElementById('storyL0');
  const storyHeroCopy = document.getElementById('storyHeroCopy');
  const storyHud = document.getElementById('storyHud');
  const storyCaption = document.getElementById('storyCaption');
  const storyHint = document.getElementById('storyHint');
  const storyVision = document.getElementById('storyVision');
  const storyAcct = document.getElementById('storyAcct');
  const storyCred = document.getElementById('storyCred');
  const storyCarbonCard = document.getElementById('storyCarbonCard');
  const storyScoreNum = document.getElementById('storyScoreNum');
  const sparklinePoly = document.getElementById('sparklinePoly');
  const sparkDots = document.getElementById('sparkDots');
  const storyFeats = document.getElementById('storyFeats');
  const storyProgBar = document.getElementById('storyProgBar');
  const storySol = document.getElementById('sol');
  const storyStats = document.getElementById('storyStats');
  const statNums = document.querySelectorAll('.story-stat-num');
  const storyRk1 = document.getElementById('storyRk1');
  const storyRk3 = document.getElementById('storyRk3');
  const storyStage = document.querySelector('.story-stage');
  const heroSec = document.getElementById('hero');

  const hotspotEls = [1, 2, 3, 4].map((n) => document.getElementById('hs' + n));
  const visionWords = storyVision ? Array.from(storyVision.querySelectorAll('.word')) : [];
  const visionParagraph = storyVision ? storyVision.querySelector('p') : null;
  const featRows = storyFeats ? Array.from(storyFeats.querySelectorAll('.story-feat-row')) : [];
  const rocks = [storyRk1, storyRk3].map((el) => ({
    el,
    x: parseFloat(el.dataset.x),
    y: parseFloat(el.dataset.y),
    depth: parseFloat(el.dataset.d),
  }));
  const stats = Array.from(statNums).map((el) => ({
    el,
    target: parseFloat(el.dataset.target) || 0,
    suffix: el.dataset.suffix === '%' ? '%' : '',
  }));

  // alpha:false = the browser can skip blending this big canvas with whatever is behind it.
  // (The poster plate covers it until frame 0 is painted, so there is no black flash.)
  const storyCtx = storyCanvas.getContext('2d', { alpha: false });
  if (storyCtx) {
    storyCtx.imageSmoothingEnabled = true;
    // These frames are background photography, not UI text. Low smoothing is
    // visually identical at this scale and cheaper to composite each frame.
    storyCtx.imageSmoothingQuality = 'low';
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const useSmallFrames = window.innerWidth <= 820
    || (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4)
    || Boolean(navigator.connection && navigator.connection.saveData);

  const sequence = new FrameSequence({
    count: 121,
    useSmall: useSmallFrames,
    maxBitmaps: useSmallFrames ? 12 : 24,
    reducedMotion: reduceMotion,
    onProgress,
  });

  // Canvas sizing is owned here; FrameSequence only paints into it.
  let canvasW = 0;
  let canvasH = 0;
  let wantPosition = 0;

  function resizeCanvas() {
    const width = storyCanvas.clientWidth;
    const height = storyCanvas.clientHeight;
    // Ignore tiny height changes (mobile address bar) so the canvas is not
    // wiped in the middle of a scroll.
    if (Math.abs(width - canvasW) < 2 && Math.abs(height - canvasH) < 80) return;
    canvasW = width;
    canvasH = height;
    // Drawing more pixels than the frame files contain gives no extra sharpness,
    // it only costs GPU time (on a 1.5x screen it was ~3.6x more pixels per paint).
    // So the canvas is capped at the frame width; the browser scales it for free.
    const frameWidth = useSmallFrames ? 960 : 1600;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = Math.min(dpr, frameWidth / Math.max(1, width));
    storyCanvas.width = Math.round(width * scale);   // resizing clears the canvas...
    storyCanvas.height = Math.round(height * scale);
    sequence.draw(storyCtx, wantPosition); // ...so paint the current frame back
  }

  function redraw() {
    sequence.draw(storyCtx, wantPosition);
  }

  // ---- Measurements. Everything here runs outside the frame loop. ----
  let trackTop = 0;
  let trackLength = 1;
  let viewportH = 0;
  let overlapPx = 0;
  let statsTriggerY = Infinity;

  function measure() {
    viewportH = window.innerHeight;
    const trackRect = storyTrack.getBoundingClientRect();
    trackTop = trackRect.top + window.scrollY;
    overlapPx = -parseFloat(getComputedStyle(storySol).marginTop) || 0;
    trackLength = Math.max(1, storyTrack.offsetHeight - viewportH - overlapPx);
    const statsRect = storyStats.getBoundingClientRect();
    statsTriggerY = statsRect.top + window.scrollY - viewportH * 0.92;
  }

  function readProgress() {
    return clamp((window.scrollY - trackTop) / trackLength);
  }

  resizeCanvas();
  measure();
  // Frames are only needed as the story approaches the viewport. Loading them
  // at boot competes with the hero LCP and costs several MB on first load.
  let sequenceStarted = false;
  const startSequence = () => {
    if (sequenceStarted) return;
    sequenceStarted = true;
    sequence.start();
  };
  const onFirstScroll = () => {
    if (window.scrollY <= 0) return;
    startSequence();
    window.removeEventListener('scroll', onFirstScroll);
    window.removeEventListener('wheel', onFirstScroll);
    window.removeEventListener('touchmove', onFirstScroll);
  };
  window.addEventListener('scroll', onFirstScroll, { passive: true });
  window.addEventListener('wheel', onFirstScroll, { passive: true });
  window.addEventListener('touchmove', onFirstScroll, { passive: true });
  sparklinePoly.style.strokeDasharray = '300';

  window.addEventListener('resize', () => {
    resizeCanvas();
    measure();
  });
  window.addEventListener('load', measure);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      resizeCanvas();
      measure();
    }, 150);
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(storyTrack);
    if (heroSec) observer.observe(heroSec);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measure();
      redraw();
    });
  }

  // Coming back from the bfcache or a background tab can leave a stale canvas.
  window.addEventListener('pageshow', () => {
    sequence.resync();
    resizeCanvas();
    measure();
    redraw();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    sequence.resync();
    resizeCanvas();
    measure();
    redraw();
  });

  // ---- State ----
  let active = false;
  let sp = 0;
  let mx = 0;
  let my = 0;
  let sx = 0;
  let sy = 0;
  let plateAlpha = 1;
  let lastScore = -1;
  let statsStartedAt = -1;
  let statsDone = false;
  let lastCamStyle = '';
  let lastPlateState = '';
  let lastFogVisible = false;
  let lastFogState = '';
  let lastHudVisible = true;
  let lastProg = '';
  let lastCanvasPosition = -1;
  let lastDrawAt = 0;
  let lastStatsAt = 0;

  window.addEventListener('pointermove', (e) => {
    mx = (e.clientX / window.innerWidth) - 0.5;
    my = (e.clientY / window.innerHeight) - 0.5;
  });

  // Interactive hotspots and feature rows.
  document.querySelectorAll('.story-hotspot').forEach((hs) => {
    hs.addEventListener('click', () => {
      document.querySelectorAll('.story-hotspot').forEach((h) => { if (h !== hs) h.classList.remove('on'); });
      hs.classList.toggle('on');
    });
  });

  document.querySelectorAll('.story-feat-row').forEach((row) => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.story-feat-row').forEach((r) => { if (r !== row) r.classList.remove('on'); });
      row.classList.toggle('on');
    });
  });

  // Only do story work while the section is on (or next to) the screen.
  if ('IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver((entries) => {
      const next = entries[0].isIntersecting;
      if (next === active) return;
      active = next;
      storySec.classList.toggle('is-idle', !active);
      if (active) {
        sp = readProgress();
        redraw();
      }
    }, { rootMargin: '0px', threshold: 0 });
    storySec.classList.add('is-idle');
    // Observe the track, not the whole section: the Solutions panel continues
    // below it, and the canvas must stop painting once the pinned stage has
    // scrolled away instead of drawing behind that panel.
    activeObserver.observe(storyTrack);
  } else {
    active = true;
  }

  function hideRocks() {
    storyRk1.style.visibility = 'hidden';
    storyRk3.style.visibility = 'hidden';
  }

  // The stats sit in the solutions panel, which can still be on screen after
  // the pinned story has scrolled away. They keep running even while the
  // scene itself is idle, so the count-up is never skipped.
  function updateStats(now) {
    if (statsDone) return;
    if (statsStartedAt < 0) {
      if (window.scrollY < statsTriggerY) return;
      statsStartedAt = now;
    }
    // Four 44px numbers changing width at 120Hz is more layout/paint than the
    // count-up needs; 30 updates a second still reads as a continuous count.
    if (now - lastStatsAt < 33) return;
    lastStatsAt = now;
    const progress = Math.min((now - statsStartedAt) / 1600, 1);
    const eased = easeInOut(progress);
    stats.forEach((stat) => {
      const value = eased * stat.target;
      stat.el.textContent = (stat.target % 1 === 0 ? Math.round(value) : value.toFixed(1)) + stat.suffix;
    });
    if (progress >= 1) statsDone = true;
  }

  function update(dt, now) {
    updateStats(now);
    if (!active) return;

    // Progress is a pure function of scroll position and cached measurements.
    const rawP = readProgress();
    if (document.documentElement.classList.contains('lenis')) {
      // Lenis already glides the scroll position. Smoothing it a second time
      // only added ~100ms of "floaty" delay between your wheel and the screen.
      sp = rawP;
    } else {
      // Touch / native scrolling: a very light filter (about 45ms) hides event jitter.
      sp += (rawP - sp) * (1 - Math.exp(-dt * 22));
      if (Math.abs(rawP - sp) < 0.0002) sp = rawP;
    }

    // Pointer parallax, damped with a time constant instead of 0.06 per frame.
    if (reduceMotion) {
      sx = 0;
      sy = 0;
    } else {
      const parallaxK = 1 - Math.exp(-dt * 4);
      sx += (mx - sx) * parallaxK;
      sy += (my - sy) * parallaxK;
    }

    const vp = easeInOut(seg(sp, 0.05, 0.70));
    wantPosition = vp * Math.max(0, sequence.count - 1);
    // While the story is moving, paint every frame. Once it is stationary,
    // only repaint occasionally to pick up newly decoded frames; a full-screen
    // canvas does not need to repaint 60 times a second while nobody moves.
    // The frames themselves are a 60fps sequence; painting them at 120Hz on a
    // high-refresh display only doubles compositor work. The camera still
    // updates every display frame, so motion stays smooth.
    const canvasDue = Math.abs(wantPosition - lastCanvasPosition) > 0.0001 && now - lastDrawAt > 15;
    if (canvasDue || now - lastDrawAt > 120) {
      sequence.draw(storyCtx, wantPosition);
      lastCanvasPosition = wantPosition;
      lastDrawAt = now;
    }

    if (!reduceMotion) {
      const camY = -sy * 12 + (1 - vp) * viewportH * 0.06;
      const camScale = 1 + 0.02 * (1 - vp);
      const camStyle = `translate3d(${-sx * 18}px, ${camY}px, 0) scale(${camScale})`;
      if (camStyle !== lastCamStyle) {
        storyCam.style.transform = camStyle;
        storyCamF.style.transform = camStyle;
        lastCamStyle = camStyle;
      }
    }

    // Hand-off from the still poster plate to the first real frame.
    const handoffTarget = sequence.frameZeroDrawn ? 1 : 0;
    if (reduceMotion) {
      plateAlpha = handoffTarget;
    } else {
      plateAlpha += (handoffTarget - plateAlpha) * (1 - Math.exp(-dt * 8));
    }
    if (Math.abs(handoffTarget - plateAlpha) < 0.002) plateAlpha = handoffTarget;

    const plateState = `${plateAlpha.toFixed(4)}|${handoffTarget}`;
    if (plateState !== lastPlateState) {
      storyPlate.style.opacity = String(1 - plateAlpha);
      storyCamF.style.opacity = String(1 - plateAlpha);
      storyCamF.style.visibility = plateAlpha > 0.999 ? 'hidden' : 'visible';
      lastPlateState = plateState;
    }

    // Floating rocks. No per-frame blur: the scale + travel already sells depth.
    if (reduceMotion) {
      hideRocks();
    } else {
      const fp = seg(sp, 0.02, 0.2);
      const fe = fp * fp;
      if (fp < 1) {
        rocks.forEach((rock) => {
          rock.el.style.visibility = 'visible';
          rock.el.style.transform = `translate3d(${rock.x * fp * 70 + sx * -24 * rock.depth}vw, ${rock.y * fp * 60 + sy * -16 * rock.depth}vh, 0) scale(${1 + fe * 1.6 * rock.depth})`;
        });
      } else {
        hideRocks();
      }
    }

    // Fog bank.
    const fg = easeInOut(seg(sp, 0.38, 0.47));
    if (fg > 0) {
      if (!lastFogVisible) {
        storyFog.style.visibility = 'visible';
        lastFogVisible = true;
      }
      const fogTransform = `translate3d(${(fg - 1) * 18 - sx * 10}vw, ${sy * -6}px, 0)`;
      const fogState = `${fg.toFixed(4)}|${fogTransform}`;
      if (fogState !== lastFogState) {
        storyFog.style.opacity = String(fg);
        storyFog.style.transform = fogTransform;
        lastFogState = fogState;
      }
    } else if (lastFogVisible) {
      storyFog.style.visibility = 'hidden';
      lastFogVisible = false;
    }

    // Beat 1: hero copy and HUD.
    const h = seg(sp, 0.02, 0.1);
    if (h < 1) {
      storyL0.style.visibility = 'visible';
      storyHeroCopy.style.transform = `translate3d(${-sx * 10}px, ${-h * 80 - sy * 6}px, 0) scale(${1 + h * 0.12})`;
      storyHeroCopy.style.opacity = 1 - h;
    } else {
      storyL0.style.visibility = 'hidden';
    }

    const hudH = 1 - seg(sp, 0.02, 0.08);
    if (hudH > 0.001) {
      if (!lastHudVisible) {
        storyHud.style.visibility = 'visible';
        lastHudVisible = true;
      }
      storyHud.style.opacity = hudH;
      storyHud.style.transform = `translate3d(${sx * 26}px, ${sy * 18 - h * 40}px, 0)`;
    } else if (lastHudVisible) {
      storyHud.style.visibility = 'hidden';
      lastHudVisible = false;
    }
    storyCaption.style.opacity = 1 - seg(sp, 0.01, 0.05);
    storyHint.style.opacity = 1 - seg(sp, 0.01, 0.05);

    // Beat 2: vision statement.
    const vIn = seg(sp, 0.16, 0.27);
    const vOut = seg(sp, 0.34, 0.42);
    if (vIn > 0 && vOut < 1) {
      storyVision.style.visibility = 'visible';
      visionWords.forEach((word, idx) => {
        const k = clamp(vIn * 1.6 - idx * 0.08);
        word.style.transform = `translate3d(0, ${(1 - k) * 30 - vOut * 60}px, 0)`;
        word.style.opacity = k * (1 - vOut);
      });
      if (visionParagraph) {
        visionParagraph.style.opacity = clamp(vIn * 2 - 0.6) * (1 - vOut);
        visionParagraph.style.transform = `translateY(${-vOut * 50}px)`;
      }
    } else {
      storyVision.style.visibility = 'hidden';
    }

    // Beat 3: accounting line and hotspots.
    const aIn = seg(sp, 0.45, 0.55);
    const aOut = seg(sp, 0.63, 0.68);
    if (aIn > 0 && aOut < 1) {
      storyAcct.style.visibility = 'visible';
      storyAcct.style.opacity = aIn * (1 - aOut);
      hotspotEls.forEach((hs, idx) => {
        const k = seg(sp, 0.49 + idx * 0.02, 0.53 + idx * 0.02);
        hs.style.visibility = 'visible';
        hs.style.transform = `translate3d(${sx * -30}px, ${sy * -20}px, 0) scale(${k * (1 - aOut)})`;
      });
    } else {
      storyAcct.style.visibility = 'hidden';
      hotspotEls.forEach((hs) => { hs.style.visibility = 'hidden'; });
    }

    // Beat 4: station, score card and feature list.
    const sIn = seg(sp, 0.72, 0.82);
    if (sIn > 0) {
      storyCred.style.visibility = 'visible';
      storyCred.style.opacity = sIn;
      storyCred.style.transform = `translateY(${(1 - sIn) * 30}px)`;

      const cIn = easeInOut(seg(sp, 0.74, 0.86));
      storyCarbonCard.style.visibility = 'visible';
      storyCarbonCard.style.opacity = cIn;
      storyCarbonCard.style.transform = `translate3d(${sx * -14}px, ${(1 - cIn) * 60 + sy * -10}px, 0) rotateY(${sx * 8}deg) rotateX(${-sy * 8}deg)`;

      const score = Math.round(24 * seg(sp, 0.76, 0.90));
      if (score !== lastScore) {
        storyScoreNum.textContent = score;
        lastScore = score;
      }

      sparklinePoly.style.strokeDashoffset = (1 - seg(sp, 0.77, 0.92)) * 300;

      storyFeats.style.visibility = 'visible';
      storyFeats.style.opacity = easeInOut(seg(sp, 0.74, 0.80));
      sparkDots.style.opacity = seg(sp, 0.88, 0.93);
      featRows.forEach((row, idx) => {
        const k = easeInOut(seg(sp, 0.76 + idx * 0.025, 0.82 + idx * 0.025));
        row.style.opacity = k;
        row.style.transform = `translateX(${(1 - k) * 40}px)`;
      });
    } else {
      storyCred.style.visibility = 'hidden';
      storyCarbonCard.style.visibility = 'hidden';
      storyFeats.style.visibility = 'hidden';
    }

    const prog = sp.toFixed(4);
    if (prog !== lastProg) {
      storyProgBar.style.transform = `scaleX(${prog})`;
      lastProg = prog;
    }
  }

  // Play the headline "rise" when the scene actually scrolls into view.
  if ('IntersectionObserver' in window && storyStage) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        storySec.classList.add('in-view');
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(storyStage);
  } else {
    storySec.classList.add('in-view');
  }

  return { sequence, update, redraw, startSequence };
}
