// Progressive WebP frame sequence for the pinned story.
//
// Frames are downloaded in priority order (0, every 8th, every 4th, every 2nd,
// then the rest) with a small concurrency limit. Only a window of decoded
// bitmaps is kept in memory; everything else stays as compressed blobs, which
// are much cheaper. draw() is synchronous and always paints the nearest frame
// that is already decoded, so the canvas can never go blank.

const MANIFEST_URL = '/frames/manifest.json';

export class FrameSequence {
  constructor({
    basePath = '/frames',
    smallPath = '/frames-sm',
    count = 121,
    useSmall = false,
    concurrency = 5,
    maxBitmaps = 24,
    prefetchAhead = 14,
    prefetchBehind = 8,
    firstFrames = 12,
    reducedMotion = false,
    onProgress = null,
  } = {}) {
    this.basePath = useSmall ? smallPath : basePath;
    this.count = count;
    this.concurrency = concurrency;
    this.maxBitmaps = maxBitmaps;
    this.prefetchAhead = prefetchAhead;
    this.prefetchBehind = prefetchBehind;
    this.firstFrames = firstFrames;
    this.reducedMotion = reducedMotion;
    this.onProgress = onProgress;

    this.blobs = new Array(count);
    this.bitmaps = new Map();     // decoded frames, LRU trimmed
    this.failed = new Set();
    this.pending = new Set();     // downloads in progress
    this.decoding = new Set();    // createImageBitmap calls in progress

    this.order = this.buildOrder();
    this.headSize = Math.min(this.order.length, 26);
    this.cursor = 0;
    this.inFlight = 0;
    this.loadedCount = 0;
    this.allowTail = false;

    this.started = false;
    this.destroyed = false;
    this.lastPosition = 0;
    this.direction = 1;
    this.lastDrawn = -1;
    this.lastPrefetchAt = 0;
    this.lastPrefetchCenter = -1;
    this.frameZeroDrawn = false;

    this.controller = new AbortController();
    this.firstBatchDone = false;
    this.firstBatch = new Promise((resolve) => { this.resolveFirstBatchFn = resolve; });
  }

  // 0 first, then a coarse net across the whole clip, then finer and finer.
  buildOrder() {
    const seen = new Set();
    const order = [];
    const push = (i) => {
      if (i >= 0 && i < this.count && !seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    };
    push(0);
    for (let i = 0; i < this.count; i += 8) push(i);
    for (let i = 0; i < this.count; i += 4) push(i);
    for (let i = 0; i < this.count; i += 2) push(i);
    for (let i = 0; i < this.count; i++) push(i);
    return order;
  }

  frameUrl(index) {
    return `${this.basePath}/f_${String(index).padStart(3, '0')}.webp`;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.loadManifest();
    if (this.destroyed) return;
    this.pump();
    // The tail waits a moment so the first screen keeps the bandwidth.
    this.tailTimer = window.setTimeout(() => {
      this.allowTail = true;
      this.pump();
    }, 1500);
  }

  async loadManifest() {
    try {
      const response = await fetch(MANIFEST_URL, { signal: this.controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (!Number.isInteger(data.count) || data.count < 2 || data.count === this.count) return;
      this.count = data.count;
      this.blobs = new Array(this.count);
      this.failed.clear();
      this.pending.clear();
      this.order = this.buildOrder();
      this.headSize = Math.min(this.order.length, 26);
      this.cursor = 0;
    } catch (_) {
      /* no manifest: the default 121 frames still work */
    }
  }

  pump() {
    if (!this.started || this.destroyed) return;
    while (this.inFlight < this.concurrency && this.cursor < this.order.length) {
      if (this.cursor >= this.headSize && !this.allowTail) break;
      const index = this.order[this.cursor];
      this.cursor++;
      if (this.blobs[index] || this.failed.has(index) || this.pending.has(index)) continue;
      this.fetchFrame(index);
    }
  }

  fetchFrame(index) {
    if (this.destroyed) return;
    this.inFlight++;
    this.pending.add(index);
    fetch(this.frameUrl(index), { signal: this.controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.blob();
      })
      .then((blob) => {
        if (this.destroyed) return;
        this.blobs[index] = blob;
        this.loadedCount++;
        if (this.onProgress) this.onProgress(this.loadedCount, this.count);
        if (this.loadedCount >= this.firstFrames) this.resolveFirstBatch();
        // Decode early if it is near the part of the clip we are looking at.
        if (Math.abs(index - this.lastPosition) <= this.prefetchAhead) this.decode(index);
      })
      .catch((error) => {
        if (error && error.name === 'AbortError') return;
        this.failed.add(index);
        if (this.loadedCount + this.failed.size >= this.count) this.resolveFirstBatch();
      })
      .finally(() => {
        this.inFlight--;
        this.pending.delete(index);
        this.pump();
      });
  }

  resolveFirstBatch() {
    if (this.firstBatchDone) return;
    this.firstBatchDone = true;
    this.resolveFirstBatchFn();
  }

  ready(index) {
    return this.bitmaps.has(index);
  }

  // Nearest decoded frame, searching in the scroll direction first.
  nearestReady(index) {
    if (this.bitmaps.size === 0) return -1;
    if (this.bitmaps.has(index)) return index;
    for (let distance = 1; distance < this.count; distance++) {
      const ahead = index + this.direction * distance;
      const behind = index - this.direction * distance;
      if (ahead >= 0 && ahead < this.count && this.bitmaps.has(ahead)) return ahead;
      if (behind >= 0 && behind < this.count && this.bitmaps.has(behind)) return behind;
    }
    return -1;
  }

  prefetch(position) {
    const center = Math.round(position);
    const now = performance.now();
    // draw() runs at display rate; prefetch does not need to. One pass every
    // few frames (or when the scrub jumps) is enough to keep decoding fed.
    if (now - this.lastPrefetchAt < 70 && Math.abs(center - this.lastPrefetchCenter) < 3) return;
    this.lastPrefetchAt = now;
    this.lastPrefetchCenter = center;
    const ahead = this.direction >= 0 ? this.prefetchAhead : this.prefetchBehind;
    const behind = this.direction >= 0 ? this.prefetchBehind : this.prefetchAhead;
    for (let d = 0; d <= ahead; d++) this.ensureFrame(center + d);
    for (let d = 1; d <= behind; d++) this.ensureFrame(center - d);
  }

  ensureFrame(index) {
    if (index < 0 || index >= this.count) return;
    if (this.bitmaps.has(index) || this.decoding.has(index) || this.failed.has(index)) return;
    if (this.blobs[index]) {
      this.decode(index);
      return;
    }
    // Keep the initial priority order intact until the first batch is in.
    if (this.loadedCount < this.firstFrames && index !== 0) return;
    if (this.inFlight >= this.concurrency || this.pending.has(index)) return;
    this.fetchFrame(index);
  }

  decode(index) {
    if (this.decoding.size >= 4) return;
    const blob = this.blobs[index];
    if (!blob || this.bitmaps.has(index) || this.decoding.has(index)) return;
    this.decoding.add(index);
    // colorSpaceConversion:'none' skips a per-pixel colour conversion (the frames
    // carry no colour profile, so the picture is identical). Older browsers that
    // reject the option fall back to the plain call.
    const decodeBlob = () => createImageBitmap(blob, { colorSpaceConversion: 'none' })
      .catch(() => createImageBitmap(blob));
    decodeBlob()
      .then((bitmap) => {
        if (this.destroyed) {
          bitmap.close();
          return;
        }
        this.bitmaps.set(index, bitmap);
        this.evict(index);
      })
      .catch(() => {
        /* a single bad frame must not break the sequence */
      })
      .finally(() => {
        this.decoding.delete(index);
      });
  }

  // Drop the decoded frames that are furthest from where we are now.
  evict(center) {
    if (this.bitmaps.size <= this.maxBitmaps) return;
    const keys = Array.from(this.bitmaps.keys())
      .sort((a, b) => Math.abs(b - center) - Math.abs(a - center));
    for (const key of keys) {
      if (this.bitmaps.size <= this.maxBitmaps) break;
      if (key === this.lastDrawn) continue;
      const bitmap = this.bitmaps.get(key);
      this.bitmaps.delete(key);
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    }
  }

  paint(ctx, bitmap, alpha) {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    if (!cw || !ch) return;
    const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bitmap, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }

  draw(ctx, positionFloat) {
    if (!ctx) return -1;
    const position = Math.max(0, Math.min(this.count - 1, positionFloat));
    const delta = Math.abs(position - this.lastPosition);
    if (position !== this.lastPosition) {
      this.direction = position > this.lastPosition ? 1 : -1;
    }
    this.lastPosition = position;
    this.prefetch(position);

    const first = Math.floor(position);
    const second = Math.min(this.count - 1, first + 1);
    const fraction = position - first;
    const a = this.bitmaps.get(first);
    const b = this.bitmaps.get(second);

    // Slow scrub: blend the two neighbouring frames instead of stepping.
    if (a && b && fraction > 0.04 && fraction < 0.96 && delta < 0.6 && !this.reducedMotion) {
      this.paint(ctx, a, 1);
      this.paint(ctx, b, fraction);
      this.lastDrawn = second;
      if (first === 0) this.frameZeroDrawn = true;
      return second;
    }

    const target = this.nearestReady(Math.round(position));
    if (target < 0) return -1;
    this.paint(ctx, this.bitmaps.get(target), 1);
    this.lastDrawn = target;
    if (target === 0) this.frameZeroDrawn = true;
    return target;
  }

  // Called after bfcache restores and tab switches: make sure loading and
  // decoding are running again for the frame we are actually on.
  resync() {
    this.pump();
    this.prefetch(this.lastPosition);
  }

  destroy() {
    this.destroyed = true;
    this.controller.abort();
    window.clearTimeout(this.tailTimer);
    this.bitmaps.forEach((bitmap) => {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    });
    this.bitmaps.clear();
  }
}
