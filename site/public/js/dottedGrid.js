/**
 * DottedGrid – vanilla JS port of the React component
 * Full-page interactive dot grid with shape patterns & mouse trail
 */
(function () {
  "use client";

  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  // ── Hover tuning ────────────────────────────────────────────────
  // ponytail: all hover "feel" numbers in one place for easy tweaking
  const HOVER = {
    radius: 160,        // px — effect reach (was 380: too diluted)
    innerPlateau: 0.35, // fraction of radius with full collapse (crisp hole)
    attack: 0.38,       // lerp speed growing (~80% collapse in ~70ms @60fps)
    release: 0.15,      // lerp speed decaying (softer release reads natural)
    minScale: 0.15,     // residual radius factor under cursor center
    alphaFade: 0.30,    // alpha removed at full strength (was 0.5: too vanishing)
  };

  // ── Config ────────────────────────────────────────────────────────
  const DEFAULTS = {
    spacing: 20,
    baseRadius: 7.2,
    trailLength: 20,
    trailSampleRate: 5,
    trailRadius: 230,
    trailFadeMs: 800,
    backgroundColor: "#000004",
    id: "dotted-grid-bg",
  };

  const RANDOM_TIME = 0.6;
  const COLLECT_TIME = 1.1;
  const SHAPE_HOLD_TIME = 1.2;
  const GRAY_DISPERSE_TIME = 0.9;
  const TOTAL_CYCLE_TIME =
    RANDOM_TIME + COLLECT_TIME + SHAPE_HOLD_TIME + GRAY_DISPERSE_TIME;
  const TOTAL_SHAPES = 5;

  // ponytail: top-band dissolve zone — GRID-LOCKED + ORDER-SAFE. Dots never
  // leave lattice positions and scale is a monotonic function of the row
  // within each column (sizes always grow downward — never big-under-small).
  // Motion comes from the whole gradient sliding + breathing on seamless
  // integer harmonics; organic feel from per-column offsets (grid hashes).
  // Rows 1–3 are always scale 0; the animation spans rows 4–12.
  const BAND_ROWS = 12;             // guaranteed rows in dissolve zone
  const BAND_FRAC_CAP = 0.35;       // max fraction for very tall canvases
  const FEATHER_ROWS = 2;           // feather rows at band bottom edge
  const MASTER_PERIOD = 4.0;        // seconds — one seamless wave loop
  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI / 2;

  // ── Math helpers ──────────────────────────────────────────────────
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smoothstep = (e0, e1, v) => {
    const t = clamp01((v - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };

  // ponytail: axis-aligned bbox of projected points (+margin), computed once
  // per geometry refresh so dots far from a shape skip distance loops
  function bboxOf(points, margin = 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return [minX - margin, minY - margin, maxX + margin, maxY + margin];
  }

  // ── Shape functions ───────────────────────────────────────────────
  // ponytail: edges precomputed once per frame (see computeShapeGeometry)
  function getCubeStrength(x, y, time, width, height, edges, cubeBBox) {
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.28;
    const px = (x - cx) / scale;
    const py = (y - cy) / scale;
    if (
      px < cubeBBox[0] || px > cubeBBox[2] ||
      py < cubeBBox[1] || py > cubeBBox[3]
    ) {
      return 0; // ponytail: outside projected bbox → no distance loops
    }

    let minDist = Infinity;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const dx = e[2] - e[0];
      const dy = e[3] - e[1];
      const lenSq = dx * dx + dy * dy;
      let t;
      if (lenSq === 0) {
        t = 0;
      } else {
        t = ((px - e[0]) * dx + (py - e[1]) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const cxp = e[0] + t * dx;
      const cyp = e[1] + t * dy;
      const dist = Math.sqrt((px - cxp) ** 2 + (py - cyp) ** 2);
      if (dist < minDist) minDist = dist;
    }

    const edgeThickness = 0.22;
    if (minDist > edgeThickness) return 0;
    return clamp01(1 - smoothstep(0, edgeThickness, minDist));
  }

  function getStarfishStrength(x, y, time, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.26;
    const nx = (x - cx) / scale;
    const ny = (y - cy) / scale;
    const angle = Math.atan2(ny, nx);
    const r = Math.sqrt(nx * nx + ny * ny);
    const arms = 6;
    const wave = Math.sin(arms * angle + time * 0.35) * 0.2;
    const baseRadius = 0.55 + wave;
    return clamp01(1 - smoothstep(baseRadius - 0.08, baseRadius + 0.08, r));
  }

  function getConcentricRingsStrength(x, y, time, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.2;
    const r = Math.sqrt(((x - cx) / scale) ** 2 + ((y - cy) / scale) ** 2);
    if (r > 1.0) return 0;
    const pulse = Math.sin(time * 0.5) * 0.02;
    const ringSpacing = 0.22 + pulse;
    const ringPos = (r % ringSpacing) / ringSpacing;
    const ringSharpness = 0.12;
    const inRing = ringPos < ringSharpness || ringPos > (1 - ringSharpness);
    if (!inRing) return 0;
    const distFromCenter = Math.min(ringPos, 1 - ringPos) / ringSharpness;
    return clamp01(1 - smoothstep(0.2, 1, distFromCenter));
  }

  function getSpiralStrength(x, y, time, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.13;
    const nx = (x - cx) / scale;
    const ny = (y - cy) / scale;
    const r = Math.sqrt(nx * nx + ny * ny);
    const angle = Math.atan2(ny, nx);
    const spiralTurns = 2.5;
    const spiralAngle = angle + time * 0.12;
    const spiralR = spiralTurns * spiralAngle / (Math.PI * 2);
    const wrappedR = ((r - spiralR) % 0.6 + 0.6) % 0.6;
    const dist = Math.min(wrappedR, 0.6 - wrappedR);
    return clamp01(1 - smoothstep(0, 0.08, dist));
  }

  // ponytail: pts precomputed once per frame (see computeShapeGeometry)
  function getInfinityStrength(x, y, time, width, height, pts, infBBox) {
    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.27;
    const px = (x - cx) / scale;
    const py = (y - cy) / scale;
    if (
      px < infBBox[0] || px > infBBox[2] ||
      py < infBBox[1] || py > infBBox[3]
    ) {
      return 0; // ponytail: outside projected bbox → no distance loops
    }

    let minDist = Infinity;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const lenSq = dx * dx + dy * dy;
      let t;
      if (lenSq === 0) {
        t = 0;
      } else {
        t = ((px - p1[0]) * dx + (py - p1[1]) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const cxp = p1[0] + t * dx;
      const cyp = p1[1] + t * dy;
      const dist = Math.sqrt((px - cxp) ** 2 + (py - cyp) ** 2);
      if (dist < minDist) minDist = dist;
    }

    const thickness = 0.14;
    if (minDist > thickness) return 0;
    return clamp01(1 - smoothstep(0, thickness, minDist));
  }

  // ponytail: rotate+project 3D geometry ONCE per frame, reuse for all dots
  function computeShapeGeometry(time, width, height) {
    const minWH = Math.min(width, height);

    // Cube: rotate Y then X, perspective-project the 8 vertices
    const cx3 = Math.cos(time * 0.25);
    const sx3 = Math.sin(time * 0.25);
    const cy3 = Math.cos(time * 0.35);
    const sy3 = Math.sin(time * 0.35);
    const perspective = 2.5;
    const verts = [
      [-0.7,-0.7,-0.7],[0.7,-0.7,-0.7],[0.7,0.7,-0.7],[-0.7,0.7,-0.7],
      [-0.7,-0.7,0.7],[0.7,-0.7,0.7],[0.7,0.7,0.7],[-0.7,0.7,0.7]
    ];
    const proj = verts.map(([vx,vy,vz]) => {
      let x = vx * cy3 - vz * sy3;
      let z = vx * sy3 + vz * cy3;
      let y = vy * cx3 - z * sx3;
      z = vy * sx3 + z * cx3;
      const p = perspective / (perspective + z);
      return [x * p, y * p];
    });
    const cube = [
      [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]
    ].map(([a,b]) => [proj[a][0], proj[a][1], proj[b][0], proj[b][1]]);
    const cubeBBox = bboxOf(proj, 0.25);

    // Infinity: lemniscate rotated Y then Z, perspective-projected (48 samples)
    const cyI = Math.cos(time * 0.3);
    const syI = Math.sin(time * 0.3);
    const czI = Math.cos(time * 0.2);
    const szI = Math.sin(time * 0.2);
    const a = 0.7, pInf = 2.5, samples = 48;
    const infinity = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      let vx = (a * Math.cos(t)) / denom;
      let vy = (a * Math.sin(t) * Math.cos(t)) / denom;
      let vz = 0;
      let rx = vx * cyI + vz * syI;
      let rz = -vx * syI + vz * cyI;
      vx = rx; vz = rz;
      let nx = vx * czI - vy * szI;
      let ny = vx * szI + vy * czI;
      vx = nx; vy = ny;
      const p = pInf / (pInf + vz);
      infinity.push([vx * p, vy * p]);
    }
    const infBBox = bboxOf(infinity, 0.25);

    return { cube, infinity, cubeBBox, infBBox };
  }

  function getRawShapeStrength(shapeIndex, x, y, time, width, height, geo) {
    const i = shapeIndex % TOTAL_SHAPES;
    if (i === 0)
      return getCubeStrength(x, y, time, width, height, geo.cube, geo.cubeBBox);
    if (i === 1) return getStarfishStrength(x, y, time, width, height);
    if (i === 2) return getConcentricRingsStrength(x, y, time, width, height);
    if (i === 3) return getSpiralStrength(x, y, time, width, height);
    return getInfinityStrength(
      x, y, time, width, height, geo.infinity, geo.infBBox
    );
  }

  // ── Public API ────────────────────────────────────────────────────
  class DottedGrid {
    constructor(options = {}) {
      this.spacing = options.spacing ?? DEFAULTS.spacing;
      this.baseRadius = options.baseRadius ?? DEFAULTS.baseRadius;
      this.mouseRadius = options.mouseRadius ?? HOVER.radius;
      this.trailLength = options.trailLength ?? DEFAULTS.trailLength;
      this.trailSampleRate = options.trailSampleRate ?? DEFAULTS.trailSampleRate;
      this.trailRadius = options.trailRadius ?? DEFAULTS.trailRadius;
      this.trailFadeMs = options.trailFadeMs ?? DEFAULTS.trailFadeMs;
      this.backgroundColor =
        options.backgroundColor ?? DEFAULTS.backgroundColor;
      this.id = options.id ?? DEFAULTS.id;
      // ponytail: explicit options win; otherwise geometry scales with width
      // (see _applyResponsive) so small screens keep dense, legible shapes.
      this._opt = options;

      this.canvas = null;
      this.ctx = null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.dots = [];
      this.shapeCache = [];
      this.frameCount = 0;
      this.mouse = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        active: false,
        trail: [],
        _sampleCount: 0,
        // ponytail: last viewport coords (always fresh). Canvas-space
        // targets derive from these + the cached rect, so scrolling under a
        // stationary cursor re-maps instead of going stale.
        clientX: null,
        clientY: null,
      };
      this.pattern = {
        currentShapeIndex: 0,
        transitionStartTime: null,
      };
      this.reduceMotion =
        window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
      this.rafId = null;
      this.isVisible = true;
      this.hiddenTimer = null;
      this._rect = null; // cached getBoundingClientRect (layout-read cache)
      this._handlers = null;
      this._resizeTimer = null;

      this._init();
    }

    _init() {
      this.canvas = document.getElementById(this.id);
      if (!this.canvas) {
        console.warn(`[DottedGrid] Canvas #${this.id} not found`);
        return;
      }

      this.ctx = this.canvas.getContext("2d", { alpha: false });

      // Reduced motion listener
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      mq.addEventListener("change", (e) => {
        this.reduceMotion = e.matches;
        if (this.reduceMotion) {
          this.mouse.active = false;
          this.mouse.trail = [];
          this.pattern.transitionStartTime = null;
        }
      });

      // Pointer events (stored handlers so destroy() can actually remove them)
      this._handlers = {
        pointermove: (e) => this._onPointerMove(e),
        deactivate: () => {
          this.mouse.active = false;
        },
        click: () => this._onClick(),
        resize: () => this._scheduleResize(),
      };
      // ponytail: window-level tracking + geometric hit test (not
      // canvas-only listeners): the cursor position stays known even while
      // the page scrolls underneath a stationary pointer, and engagement
      // follows the canvas instead of sticking to a stale spot.
      window.addEventListener("pointermove", this._handlers.pointermove, {
        passive: true,
      });
      document.addEventListener("pointerleave", this._handlers.deactivate);
      window.addEventListener("blur", this._handlers.deactivate);
      this.canvas.addEventListener("click", this._handlers.click);
      window.addEventListener("resize", this._handlers.resize);

      // ponytail: pause canvas rendering while the page scrolls — frees the main thread
      // exactly when the browser needs it for compositing (fixes scroll jank)
      this._scrolling = false;
      this._scrollTick = 0;
      this._scrollDebounce = null;
      this._onScroll = () => {
        // ponytail: the page moved under a possibly stationary cursor — the
        // cached rect AND every canvas-space coordinate go stale together.
        // Translate them by the scroll delta so hover/trail stay glued, then
        // re-evaluate engagement (a scrolled-under cursor engages without
        // moving; a scrolled-away one releases through the decay lerp).
        const oldRect = this._rect;
        this._cacheRect();
        if (oldRect && this._rect) {
          const dx = oldRect.left - this._rect.left;
          const dy = oldRect.top - this._rect.top;
          if (dx !== 0 || dy !== 0) {
            this.mouse.targetX += dx;
            this.mouse.targetY += dy;
            this.mouse.x += dx;
            this.mouse.y += dy;
            for (let i = 0; i < this.mouse.trail.length; i++) {
              this.mouse.trail[i].x += dx;
              this.mouse.trail[i].y += dy;
            }
          }
        }
        this._updateMouseFromClient({ trail: false });
        this._scrolling = true;
        if (this._scrollDebounce) clearTimeout(this._scrollDebounce);
        this._scrollDebounce = setTimeout(() => {
          this._scrolling = false;
        }, 150);
      };
      window.addEventListener("scroll", this._onScroll, { passive: true });

      const observer = new IntersectionObserver((entries) => {
        this.isVisible = entries[0].isIntersecting;
        // ponytail: canvas entered viewport while loop was in slow-timer mode →
        // resume instantly (was frozen up to 1s waiting for the old setTimeout)
        if (this.isVisible && this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
          // defer the heavy render out of the observer callback (no jank burst)
          requestAnimationFrame(() => this._loop());
        }
      }, { threshold: 0 });
      observer.observe(this.canvas);

      this._resize();
      this._loop();
    }

    _applyResponsive() {
      // ponytail: denser, smaller dots on small screens so the shapes stay
      // legible — gap and size shrink by the same factor, density preserved.
      // Runs inside _resize (debounced), so rotation/resize rebuilds the grid.
      const w = this.width || window.innerWidth || DEFAULTS.spacing * 70;
      const s = this._opt.spacing ?? (w < 640 ? 12 : w < 1024 ? 16 : DEFAULTS.spacing);
      const k = s / DEFAULTS.spacing;
      this.spacing = s;
      this.baseRadius = this._opt.baseRadius ?? DEFAULTS.baseRadius * k;
      this.mouseRadius = this._opt.mouseRadius ?? HOVER.radius * k;
      this.trailRadius = this._opt.trailRadius ?? DEFAULTS.trailRadius * k;
    }

    _resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = 1;
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._rect = rect;
      this._applyResponsive();
      this._createDots();
    }

    _cacheRect() {
      this._rect = this.canvas.getBoundingClientRect();
    }

    _scheduleResize() {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this._resizeTimer = null;
        this._resize();
      }, 150);
    }

    _createDots() {
      this.dots = [];
      this.shapeCache = [];
      const bandTop = Math.min(BAND_ROWS * this.spacing, BAND_FRAC_CAP * this.height);
      this._bandTop = bandTop;
      this._feather = FEATHER_ROWS * this.spacing;

      // ponytail: grid-locked wave tables — fixed row phase offsets (crest
      // travels 8→1 as waveNorm advances), per-column phase shifts for organic
      // misalignment, per-row amplitude emphasis (which rows bulge each cycle).
      this._rowPhaseOffset = [];
      for (let r = 0; r < BAND_ROWS; r++) this._rowPhaseOffset.push(r / BAND_ROWS);
      const numCols = Math.max(1, Math.round(this.width / this.spacing));
      this._colPhaseShift = [];
      for (let c = 0; c <= numCols; c++) {
        const h = ((Math.imul(c + 1, 0x9e3779b9) >>> 0) / 0x100000000);
        this._colPhaseShift.push(h * 0.3 - 0.15); // ±0.15 cycle stagger
      }
      this._ampEmphasis = [];
      for (let r = 0; r < BAND_ROWS; r++) {
        const h = ((Math.imul(r + 7, 0x5bd1e995) >>> 0) / 0x100000000);
        this._ampEmphasis.push(0.4 + h * 0.6); // [0.4, 1.0]
      }

      // ponytail: virtual top-edge effectors — fixed points along the first
      // visible row, reusing the hover radial falloff with time-varying
      // strength (same visual language as cursor hover / trail).
      this._topEffectors = [];
      const effCount = Math.max(3, Math.floor(this.width / (this.spacing * 6)));
      for (let i = 0; i < effCount; i++) {
        this._topEffectors.push({
          x: ((i + 0.5) / effCount) * this.width,
          y: this.spacing * 0.5,
          phase: i / effCount,
        });
      }

      for (let y = this.spacing / 2; y < this.height; y += this.spacing) {
        for (let x = this.spacing / 2; x < this.width; x += this.spacing) {
          const ci0 = Math.round((x - this.spacing / 2) / this.spacing);
          const ri0 = Math.round((y - this.spacing / 2) / this.spacing);
          this.dots.push({
            x,
            y,
            // ponytail: lattice indices pin every wave lookup — positions
            // never animated, only radius.
            _colIdx: ci0,
            _rowIdx: ri0,
            // ponytail: per-dot noise salts (constant per dot) — drive
            // lifecycle/speed/size variation without breaking the loop.
            _noiseA: ((Math.imul(ci0 + 13, 0x85ebca6b) ^ Math.imul(ri0 + 7, 0xc2b2ae35)) >>> 0) / 0x100000000,
            _noiseB: ((Math.imul(ci0 + 71, 0x27d4eb2f) ^ Math.imul(ri0 + 37, 0x165667b1)) >>> 0) / 0x100000000,
            currentShapeStrength: 0,
            currentMouseStrength: 0,
            currentTrailStrength: 0,
          });
          this.shapeCache.push(0);
        }
      }
    }

    _onPointerMove(e) {
      this.mouse.clientX = e.clientX;
      this.mouse.clientY = e.clientY;
      this._updateMouseFromClient({ trail: true });
    }

    // ponytail: single choke point mapping viewport coords to canvas space.
    // fromScroll (scroll handler) never samples trail points — scrolling
    // is not pointer motion.
    _updateMouseFromClient({ trail } = {}) {
      if (this.reduceMotion) {
        this.mouse.active = false;
        return false;
      }
      const cx = this.mouse.clientX;
      const cy = this.mouse.clientY;
      if (cx === null || cx === undefined || cy === null || cy === undefined) {
        return false;
      }
      const rect = this._rect || this.canvas.getBoundingClientRect();
      const inside =
        cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
      if (!inside) {
        // Cursor geometrically off-canvas (moved away, or the page scrolled
        // it out from under a stationary pointer): graceful release through
        // the existing decay lerp, no snap.
        this.mouse.active = false;
        return false;
      }
      const x = cx - rect.left;
      const y = cy - rect.top;
      this.mouse.targetX = x;
      this.mouse.targetY = y;
      this.mouse.active = true;
      if (trail && ++this.mouse._sampleCount % this.trailSampleRate === 0) {
        this.mouse.trail.push({ x, y, t: performance.now() });
        if (this.mouse.trail.length > this.trailLength) {
          this.mouse.trail.shift();
        }
      }
      return true;
    }

    _onClick() {
      this.pattern.currentShapeIndex =
        (this.pattern.currentShapeIndex + 1) % TOTAL_SHAPES;
      this.pattern.transitionStartTime = this.reduceMotion
        ? null
        : performance.now() * 0.001;
    }

    _getShapeData(x, y, time, geo) {
      geo = geo || computeShapeGeometry(time, this.width, this.height);
      const { currentShapeIndex, transitionStartTime } = this.pattern;
      if (transitionStartTime === null) {
        return { shapeStrength: getRawShapeStrength(currentShapeIndex, x, y, time, this.width, this.height, geo) };
      }
      const cyclePosition = time - transitionStartTime;
      if (cyclePosition >= TOTAL_CYCLE_TIME) {
        this.pattern.transitionStartTime = null;
        return { shapeStrength: getRawShapeStrength(currentShapeIndex, x, y, time, this.width, this.height, geo) };
      }
      const shapeStrength = getRawShapeStrength(currentShapeIndex, x, y, time, this.width, this.height, geo);
      if (cyclePosition < RANDOM_TIME) {
        return { shapeStrength: 0 };
      }
      if (cyclePosition < RANDOM_TIME + COLLECT_TIME) {
        const eased = smoothstep(0, 1, (cyclePosition - RANDOM_TIME) / COLLECT_TIME);
        return { shapeStrength: shapeStrength * eased };
      }
      if (cyclePosition < RANDOM_TIME + COLLECT_TIME + SHAPE_HOLD_TIME) {
        return { shapeStrength };
      }
      const eased = smoothstep(0, 1, (cyclePosition - RANDOM_TIME - COLLECT_TIME - SHAPE_HOLD_TIME) / GRAY_DISPERSE_TIME);
      return { shapeStrength: shapeStrength * (1 - eased) };
    }

    _drawDot(x, y, radius, brightness, grayDisperse, trailStrength, mouseStrength, edgeFade = 1, buckets = null) {
      const mouseFade = mouseStrength * mouseStrength * HOVER.alphaFade;
      const trailFade = trailStrength * 0.3;
      // ponytail: grid visible gray, graphic black; edgeFade keeps top/bottom fade
      const alpha = clamp01(0.75 + brightness * 0.25 - mouseFade - trailFade) * edgeFade;
      if (alpha <= 0.002) return;
      const srcLightness = lerp(18, 100, brightness);

      if (!buckets) {
        this.ctx.beginPath();
        this.ctx.fillStyle = `hsla(210, 0%, ${srcLightness}%, ${alpha})`;
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        return;
      }

      // ponytail: quantize style → few Path2D buckets → one fill() each.
      // max dot diameter ≈17px < spacing 20px ⇒ no overlap ⇒ union fill == per-dot fills
      const rQ = Math.round(radius * 2);
      const lQ = Math.round(srcLightness / 8);
      const aQ = Math.round(alpha * 20);
      const key = rQ | (lQ << 7) | (aQ << 12);
      let b = buckets.get(key);
      if (!b) {
        b = { style: `hsla(210, 0%, ${lQ * 8}%, ${aQ / 20})`, path: new Path2D() };
        buckets.set(key, b);
      }
      b.path.moveTo(x + radius, y);
      b.path.arc(x, y, radius, 0, Math.PI * 2);
    }

    _loop() {
      if (!this.isVisible) {
        this.hiddenTimer = setTimeout(() => {
          this.hiddenTimer = null; // ponytail: keep invariant "timer set ⇒ no rAF pending"
          this._renderFrame();
          this.rafId = requestAnimationFrame(() => this._loop());
        }, 1000);
        return;
      }

      if (this.hiddenTimer) {
        clearTimeout(this.hiddenTimer);
        this.hiddenTimer = null;
      }

      // ponytail: while scrolling run a reduced-rate ambient loop (1 frame
      // every 3 ticks, no mouse/trail updates) instead of freezing — the
      // canvas keeps living and full rate resumes ~150ms after scroll stops
      if (this._scrolling) {
        this._scrollTick++;
        if (this._scrollTick % 3 !== 0) {
          this.rafId = requestAnimationFrame(() => this._loop());
          return;
        }
        this._renderFrame(true);
        this.rafId = requestAnimationFrame(() => this._loop());
        return;
      }

      this._renderFrame();
      this.rafId = requestAnimationFrame(() => this._loop());
    }

    _renderFrame(ambient = false) {
      const time = performance.now() * 0.001;
      const mouse = this.mouse;
      const now = performance.now();

      // ponytail: the smoothed head ALWAYS follows — ambient scroll frames
      // must track too, or the cursor detaches mid-scroll and re-engages late.
      mouse.x = lerp(mouse.x, mouse.targetX, 0.12);
      mouse.y = lerp(mouse.y, mouse.targetY, 0.12);

      // Theme field, not white: difference needs an opaque base (on transparency
      // the white graphic would vanish), and this removes the white block.
      this.ctx.fillStyle = "#F5F1EA";
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.globalCompositeOperation = "difference";
      // ponytail: white bg + difference → dark src = gray grid, white src = black graphic

      const updateShape = this.frameCount % 3 === 0;
      if (updateShape) {
        this._shapeGeo = computeShapeGeometry(time, this.width, this.height);
      }

      // ponytail: precompute trail bbox once per frame (outside dot loop)
      let tMinX = 0, tMinY = 0, tMaxX = 0, tMaxY = 0, trailCull = false;
      if (mouse.trail.length > 0) {
        const tr = this.trailRadius;
        tMinX = tMaxX = mouse.trail[0].x;
        tMinY = tMaxY = mouse.trail[0].y;
        for (let k = 1; k < mouse.trail.length; k++) {
          const p = mouse.trail[k];
          if (p.x < tMinX) tMinX = p.x;
          if (p.x > tMaxX) tMaxX = p.x;
          if (p.y < tMinY) tMinY = p.y;
          if (p.y > tMaxY) tMaxY = p.y;
        }
        tMinX -= tr; tMinY -= tr; tMaxX += tr; tMaxY += tr;
        trailCull = true;
      }

      const bandTop = this._bandTop;
      const feather = this._feather;
      // ponytail: master wave clock — always (time / PERIOD) % 1, never bare
      // time, so every row returns to its exact start each loop (zero pop).
      const waveNorm = (time / MASTER_PERIOD) % 1;
      const effRadius = this.mouseRadius * 0.7;
      const effRadiusSq = effRadius * effRadius;

      const buckets = new Map();

      for (let i = 0; i < this.dots.length; i++) {
        const dot = this.dots[i];

        // ponytail: GRID-LOCKED wave — dot.x/dot.y never change. Only the
        // radius animates: a sine crest travels 8→1 (band bottom→top edge) as
        // waveNorm advances, staggered per column, amplified per row.
        const bandK = 1 - smoothstep(bandTop - feather, bandTop, dot.y);
        const inBand = bandK > 0 && !this.reduceMotion;
        let waveScale = 1;
        let effectorShrink = 0;
        if (inBand) {
          const r = dot._rowIdx < BAND_ROWS ? dot._rowIdx : BAND_ROWS - 1;
          // ponytail: rows 1–3 (top edge) are always scale 0 — dead zone,
          // the visible wave lives on rows 4–12.
          if (r < 3) {
            waveScale = 0;
          } else {
          const ci = Math.max(0, Math.min(this._colPhaseShift.length - 1, dot._colIdx));
          // ponytail: ORDER-SAFE wave — scale is a pure monotonic function of
          // the row within each column (gradient ramp), so sizes always grow
          // downward by construction. The ramp slides + breathes on seamless
          // integer harmonics: continuous horizontal wave, zero pops.
          const w1 = waveNorm * TAU;
          const slide = 1.1 * Math.sin(w1 + 0.7) + 0.5 * Math.sin(w1 * 3 + 2.1);
          const rampW = 9.0 * (1 + 0.14 * Math.sin(w1 * 2 + 4.0));
          const colStatic = (this._colPhaseShift[ci] / 0.15) * 0.75;
          const colDrift = 0.35 * Math.sin(w1 * 2 + ci * 0.45);
          const rampStart = 2.5 + slide + colStatic + colDrift;
          const colJit = 1 + this._colPhaseShift[ci] * 0.8;
          const bandScale = clamp01(Math.pow(smoothstep(rampStart, rampStart + rampW, dot._rowIdx), 0.9) * colJit);
          waveScale = lerp(1, bandScale, bandK);
          // ponytail: virtual top-edge effectors reuse the hover radial
          // falloff with time-varying strength (same language as cursor).
          for (let e = 0; e < this._topEffectors.length; e++) {
            const eff = this._topEffectors[e];
            const ex = dot.x - eff.x, ey = dot.y - eff.y;
            const dSq = ex * ex + ey * ey;
            if (dSq < effRadiusSq) {
              const fall = 1 - dSq / effRadiusSq;
              const effStr = 0.5 + 0.5 * Math.sin((waveNorm + eff.phase) * TAU);
              const s = fall * fall * effStr;
              if (s > effectorShrink) effectorShrink = s;
            }
          }
          }
        }

        if (updateShape) {
          this.shapeCache[i] = this._getShapeData(dot.x, dot.y, time, this._shapeGeo).shapeStrength;
        }
        const shapeStrength = this.shapeCache[i];

        if (this.reduceMotion) {
          // Static circles everywhere (no animation); frozen height envelope
          // in the band so the dissolve still reads, bottom fade only.
          const edgeFade = clamp01(smoothstep(0, 5 * this.spacing, this.height - dot.y));
          const brightness = clamp01(shapeStrength) * edgeFade;
          const frozenGrad = dot._rowIdx < 3 ? 0 : (dot.y >= bandTop ? 1 : Math.pow(smoothstep(2.5, 11.5, dot._rowIdx), 0.9));
          const radius = (this.baseRadius + shapeStrength * 1.25) * frozenGrad;
          this._drawDot(dot.x, dot.y, radius, brightness, 0, 0, 0, edgeFade, buckets);
          continue;
        }

        dot.currentShapeStrength = lerp(dot.currentShapeStrength, shapeStrength, 0.12);

        // ponytail: head influence runs at any frame rate (full or ambient
        // scroll) so hover never detaches mid-scroll; only the trail
        // recompute stays full-rate gated (frozen glow decays right after).
        {
          // Cursor head influence: flat collapse plateau + crisp smoothstep edge
          let targetMouseStrength = 0;
          if (mouse.active) {
            const dx = dot.x - mouse.x;
            const dy = dot.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            const mrSq = this.mouseRadius * this.mouseRadius;
            if (distSq < mrSq) {
              const inner = this.mouseRadius * HOVER.innerPlateau;
              targetMouseStrength =
                distSq <= inner * inner
                  ? 1
                  : 1 - smoothstep(inner, this.mouseRadius, Math.sqrt(distSq));
            }
          }
          const kMouse =
            targetMouseStrength > dot.currentMouseStrength
              ? HOVER.attack
              : HOVER.release;
          dot.currentMouseStrength = lerp(
            dot.currentMouseStrength,
            targetMouseStrength,
            kMouse
          );
        }

        if (!ambient) {
          // Trail influence (distSq — no sqrt)
          // ponytail: spatial culling — skip dots far from any trail point
          let targetTrailStrength = 0;
          if (trailCull && dot.x >= tMinX && dot.x <= tMaxX && dot.y >= tMinY && dot.y <= tMaxY) {
            const trSq = this.trailRadius * this.trailRadius;
            for (let j = 0; j < mouse.trail.length; j++) {
              const pt = mouse.trail[j];
              const age = (now - pt.t) / this.trailFadeMs;
              if (age >= 1) continue;
              const ageFade = (1 - age) ** 3;
              const positionFade = (j + 1) / mouse.trail.length;
              const fade = ageFade * positionFade;
              const dx = dot.x - pt.x;
              const dy = dot.y - pt.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < trSq) {
                const proximity = 1 - smoothstep(0, 1, Math.sqrt(distSq) / this.trailRadius);
                const softProximity = proximity * proximity * proximity;
                targetTrailStrength = Math.max(targetTrailStrength, softProximity * fade);
              }
            }
          }
          dot.currentTrailStrength = lerp(dot.currentTrailStrength, targetTrailStrength, 0.08);
        }

        // Bottom fade only: the top white fade is gone — the band dissolves by
        // scale, blending homogeneously into the page.
        const edgeFade = clamp01(smoothstep(0, 5 * this.spacing, this.height - dot.y));
        const brightness = clamp01(dot.currentShapeStrength) * edgeFade;

        const mouseShrink = 1 - dot.currentMouseStrength * (1 - HOVER.minScale);
        const trailShrink = 1 - dot.currentTrailStrength * 0.65;
        const stableRadius =
          (this.baseRadius + dot.currentShapeStrength * 1.25) * waveScale * (1 - effectorShrink * 0.85);
        let radius = stableRadius * mouseShrink * trailShrink;
        // ponytail: rows 1–3 are ALWAYS zero — hard clamp at the single choke
        // point so no wave/effector/hover path can ever resurrect them.
        if (dot._rowIdx < 3) radius = 0;

        // ponytail: dead rows / fully-shrunk dots cost zero fill work.
        if (radius > 0.01) {
        this._drawDot(
          dot.x,
          dot.y,
          radius,
          brightness,
          0,
          dot.currentTrailStrength,
          dot.currentMouseStrength,
          edgeFade,
          buckets
        );
        }
      }

      // ponytail: one fill() per style bucket instead of thousands per frame
      for (const b of buckets.values()) {
        this.ctx.fillStyle = b.style;
        this.ctx.fill(b.path);
      }

      this.frameCount++;
      this.ctx.globalCompositeOperation = "source-over";
    }

    destroy() {
      cancelAnimationFrame(this.rafId);
      if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
      if (this._scrollDebounce) clearTimeout(this._scrollDebounce);
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      window.removeEventListener("scroll", this._onScroll);
      if (this._handlers) {
        window.removeEventListener("pointermove", this._handlers.pointermove);
        document.removeEventListener("pointerleave", this._handlers.deactivate);
        window.removeEventListener("blur", this._handlers.deactivate);
        this.canvas.removeEventListener("click", this._handlers.click);
        window.removeEventListener("resize", this._handlers.resize);
      }
    }
  }

  // ── Auto-init when DOM ready ──────────────────────────────────────
  // ponytail: auto-init only for unmanaged canvases — a canvas with
  // data-managed is owned by its component (e.g. Footer.jsx), which
  // constructs + destroys the instance itself. Prevents double loops.
  function autoInit() {
    const el = document.getElementById("dotted-grid-bg");
    if (!el || el.hasAttribute("data-managed")) return;
    window.dottedGridInstance = new DottedGrid();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }

  // Expose globally for customisation
  window.DottedGrid = DottedGrid;
})();
