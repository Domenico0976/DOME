# Implementation Plan — WebGL Fluid Hover Distortion

**Date**: 2026-08-22
**Author**: lead (synthesized from 4-round adversarial review)
**Source**: BUNDLE.md + r1-r4 architect/engineer/scout/designer findings
**Status**: Ready for execution

---

## Executive Summary

Integrate a standalone WebGL fluid-image hover-distortion effect into the existing image-expansion panel. The effect activates ONLY while the user hovers the expanded image with zoom mode OFF. No GUI, no auto-preview, no shimmer. Touch support included (default-on per BUNDLE C20).

**Files to create/modify:**
- **NEW**: `js/fluidHover.js` (~400 LOC)
- **MODIFY**: `js/cardCanvasGL.js` (2 integration points)
- **MODIFY**: `index.html` (1 script tag insertion)
- **MODIFY**: `main.css` (1 CSS block insertion)

**Total estimated effort**: ~600 LOC added, ~20 lines modified in existing files.

---

## Sequencing & Parallelization

### Phase 0: Preparation (Serial, 5 min)
- [ ] Verify working state: open existing panels, confirm zoom/close work
- [ ] Create backup branch: `git checkout -b feature/fluid-hover`
- [ ] Verify no existing `js/fluidHover.js` file

### Phase 1: New File — `js/fluidHover.js` (Serial, 45 min)
**This is the largest change. Complete before modifying existing files.**

- [ ] 1.1 Create `js/fluidHover.js` with IIFE wrapper
- [ ] 1.2 Embed all 6 shader programs as JS template literals
- [ ] 1.3 Implement `FluidHover.mount(viewEl, imgEl)` factory
- [ ] 1.4 Implement WebGL context creation with correct attrs
- [ ] 1.5 Implement FBO management (outputColor, velocity, divergence, pressure)
- [ ] 1.6 Implement shader compilation and program caching
- [ ] 1.7 Implement `blit()` and `initFBOs()` functions
- [ ] 1.8 Implement render loop with 6 shader passes
- [ ] 1.9 Implement pointer tracking (mouse + touch) on **viewEl** (NOT canvas — see Correction A)
- [ ] 1.10 Implement texture upload with Safari decode fallback
- [ ] 1.11 Implement `destroy()` with strict ordering
- [ ] 1.12 Implement visibilitychange handler
- [ ] 1.13 Export `window.FluidHover = { mount: mount }`

### Phase 2: CSS Styles (Serial, 10 min)
- [ ] 2.1 Open `main.css`, navigate to line ~2690 (after `.canvas-opgl-view.zoom-active img`)
- [ ] 2.2 Insert `.canvas-opgl-fluid-canvas` styles block
- [ ] 2.3 Insert `.has-fluid` opacity toggle rules
- [ ] 2.4 Verify no syntax errors (check for missing braces/semicolons)

### Phase 3: HTML Script Tag (Serial, 5 min)
- [ ] 3.1 Open `index.html`, navigate to line 880
- [ ] 3.2 Insert `<script src="./js/fluidHover.js"></script>` BEFORE line 880
- [ ] 3.3 Verify script tag syntax

### Phase 4: Integration — `cardCanvasGL.js` (Serial, 15 min)
- [ ] 4.1 Open `js/cardCanvasGL.js`
- [ ] 4.2 In `openCanvas()`: After `canvasView.appendChild(img)` (line 58), insert canvas creation and mount call
- [ ] 4.3 In `removeCanvas()`: Before `existing.remove()` (line 34), add destroy call
- [ ] 4.4 Store handle per-stage: `stage.__fluidHover = handle`
- [ ] 4.5 Add `.has-fluid` class to canvasView at mount time
- [ ] 4.6 Verify typeof guard is present

### Phase 5: Verification Gates (Serial, 20 min)
Run each gate and confirm pass/fail:

- [ ] **Gate 1**: Panel opens without fluidHover.js loaded (typeof guard)
  - Unload fluidHover.js temporarily, open panel, confirm plain img shows, no console errors
- [ ] **Gate 2**: Hover distorts image locally
  - Load fluidHover.js, open panel, hover over image, confirm distortion follows cursor
- [ ] **Gate 3**: Relaxation returns faithful image ≤2s after cursor stops
  - Move cursor, stop, watch distortion decay, confirm image is recognizable within 2s
- [ ] **Gate 4**: Zoom ON → effect fully off
  - Toggle zoom, confirm canvas becomes invisible, img shows with 2.8× scale
- [ ] **Gate 5**: Zoom OFF → effect resumes cleanly
  - Toggle zoom off, confirm no stale frame flash, distortion resumes from clean state
- [ ] **Gate 6**: Close panel → resources freed
  - Close panel, open DevTools → Performance tab, confirm rAF stops, GL objects freed
- [ ] **Gate 7**: Second open works immediately
  - Close then reopen same panel, confirm no delay, effect works instantly
- [ ] **Gate 8**: Both stages can be open simultaneously
  - Open panel in stage 1, open panel in stage 2, confirm both work independently
- [ ] **Gate 9**: prefers-reduced-motion → no canvas injected
  - Enable in browser DevTools, open panel, confirm no fluid canvas in DOM
- [ ] **Gate 10**: Resize/orientation change → canvas resizes correctly
  - Resize browser window with panel open, confirm distortion still maps to cursor correctly

---

## Concrete Per-Step Instructions

### Step 1: Create `js/fluidHover.js`

**File structure:**
```javascript
(function() {
  'use strict';

  // ── Shader sources (template literals) ─────────────────────────────────
  var SHADER_VERT = `...`;
  var SHADER_ADVECTION = `...`;
  var SHADER_DIVERGENCE = `...`;
  var SHADER_PRESSURE = `...`;
  var SHADER_GRADIENT_SUBTRACT = `...`;
  var SHADER_POINT = `...`;
  var SHADER_OUTPUT = `...`; // scale_factor=1.15, img_frame_width=0.006

  // ── Params (shipped values) ────────────────────────────────────────────
  var PARAMS = {
    cursorSize: 3.5,
    cursorPower: 14,        // CORRECTION: shipped at 14, not 16
    distortionPower: 0.2
  };

  // ── Helper: createShader ───────────────────────────────────────────────
  function createShader(gl, type, source) { /* ... */ }

  // ── Helper: createProgram ──────────────────────────────────────────────
  function createProgram(gl, vertSrc, fragSrc) { /* ... */ }

  // ── Helper: getUniforms ────────────────────────────────────────────────
  function getUniforms(gl, program) { /* ... */ }

  // ── Helper: blit ───────────────────────────────────────────────────────
  function blit(gl, target) { /* ... */ }

  // ── Helper: createFBO ──────────────────────────────────────────────────
  function createFBO(gl, w, h) { /* ... */ }

  // ── Helper: createDoubleFBO ────────────────────────────────────────────
  function createDoubleFBO(gl, w, h) { /* ... */ }

  // ── Main: mount ────────────────────────────────────────────────────────
  function mount(viewEl, imgEl) {
    // 1. prefers-reduced-motion gate
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return null;
    }

    // 2. Create canvas
    var canvas = document.createElement('canvas');
    canvas.className = 'canvas-opgl-fluid-canvas';
    canvas.style.willChange = 'auto';
    viewEl.appendChild(canvas); // LAST child = renders ON TOP of img

    // 3. Get WebGL context
    var gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false  // CORRECTION: false for light background
    });
    if (!gl) { canvas.remove(); return null; }

    // 4. Check OES_texture_float
    var floatExt = gl.getExtension('OES_texture_float');
    if (!floatExt) { canvas.remove(); return null; }

    // 5. Set canvas backing store
    canvas.width = viewEl.clientWidth;
    canvas.height = viewEl.clientHeight;

    // 6. Init FBOs
    var ratio = viewEl.clientWidth / viewEl.clientHeight;
    var simW = Math.max(256 * ratio, viewEl.clientWidth);
    var simH = Math.max(256, viewEl.clientHeight);
    initFBOs(gl, simW, simH);

    // 7. Compile shaders, create programs
    var programs = compileShaders(gl);

    // 8. ResizeObserver
    var resizeObserver = new ResizeObserver(function() {
      canvas.width = viewEl.clientWidth;
      canvas.height = viewEl.clientHeight;
      initFBOs(gl, simW, simH);
    });
    resizeObserver.observe(viewEl);

    // 9. Pointer tracking (CORRECTION: listen on viewEl, not canvas)
    var pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false };
    function onPointerMove(e) {
      var rect = canvas.getBoundingClientRect();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var nx = cx - rect.left;
      var ny = cy - rect.top;
      pointer.moved = true;
      pointer.dx = 6 * (nx - pointer.x);
      pointer.dy = 6 * (ny - pointer.y);
      pointer.x = nx;
      pointer.y = ny;
      if (e.touches) e.preventDefault();
    }
    // CORRECTION: Add listeners to viewEl, not canvas
    viewEl.addEventListener('mousemove', onPointerMove);
    viewEl.addEventListener('touchmove', onPointerMove, { passive: false }); // CORRECTION: default-on per BUNDLE C20

    // 10. Texture upload
    var imageTexture = gl.createTexture();
    var imgRatio = 1;
    var textureReady = false;
    function uploadTexture(img) {
      if (!img || img.naturalWidth === 0) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      imgRatio = img.naturalWidth / img.naturalHeight;
      textureReady = true;
    }
    imgEl.addEventListener('load', function() {
      if (typeof imgEl.decode === 'function') {
        imgEl.decode().then(uploadTexture).catch(uploadTexture);
      } else {
        uploadTexture(imgEl);
      }
    });
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      uploadTexture(imgEl);
    }

    // 11. Render loop
    var rafId = null;
    var isActive = true;
    function render() {
      rafId = requestAnimationFrame(render);
      if (!isActive) return;
      if (viewEl.classList.contains('zoom-active')) return;
      if (!textureReady) return;
      // ... simulation + display passes ...
    }
    rafId = requestAnimationFrame(render);

    // 12. visibilitychange handler
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = null;
        isActive = false;
      } else {
        isActive = true;
        rafId = requestAnimationFrame(render);
      }
    });

    // 13. Return handle
    return {
      destroy: function() {
        // STRICT ORDER:
        cancelAnimationFrame(rafId);
        isActive = false;

        // Delete programs
        for (var key in programs) {
          gl.deleteProgram(programs[key].program);
        }

        // Delete textures
        gl.deleteTexture(imageTexture);
        // ... delete all FBO textures ...

        // Delete framebuffers
        // ... delete all FBOs ...

        // Lose context
        var loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt) loseExt.loseContext();

        // Disconnect observers
        resizeObserver.disconnect();

        // Remove listeners (CORRECTION: remove from viewEl)
        viewEl.removeEventListener('mousemove', onPointerMove);
        viewEl.removeEventListener('touchmove', onPointerMove);

        // Remove canvas
        canvas.remove();

        // Null refs
        gl = null;
        canvas = null;
        viewEl = null;
        imgEl = null;
      }
    };
  }

  // ── Export ───────────────────────────────────────────────────────────────
  window.FluidHover = { mount: mount };
})();
```

### Step 2: Modify `main.css`

**Insert after line 2690** (after `.canvas-opgl-view.zoom-active img` rule):

```css
/* ── Fluid hover canvas ───────────────────────────────────────────────── */
.canvas-opgl-fluid-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 1;
  transition: opacity 120ms ease;
}

/* Hide img when fluid is active (default state for fluid-enabled panels) */
.canvas-opgl-view.has-fluid > img {
  opacity: 0;
  transition: opacity 120ms ease;
}

/* Show img, hide canvas in zoom mode */
.canvas-opgl-view.has-fluid.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}

.canvas-opgl-view.has-fluid.zoom-active > img {
  opacity: 1;
}
```

**Note**: The `.has-fluid` class is added by `mount()` to ensure non-fluid fallback panels are unaffected.

### Step 3: Modify `index.html`

**Insert before line 880** (before `<script src="./js/cardCanvasGL.js"></script>`):

```html
<script src="./js/fluidHover.js"></script>
```

**Exact location** (lines 878-881):
```html
<script src="./js/slider.js"></script>
<script src="./js/fluidHover.js"></script>      <!-- INSERTED -->
<script src="./js/cardCanvasGL.js"></script>

<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
```

### Step 4: Modify `js/cardCanvasGL.js`

**In `openCanvas()`, after line 58** (`canvasView.appendChild(img)`):

```javascript
// ── Fluid hover integration ──────────────────────────────────────────────
var fluidCanvas = document.createElement('canvas');
fluidCanvas.className = 'canvas-opgl-fluid-canvas';
fluidCanvas.style.willChange = 'auto';
canvasView.appendChild(fluidCanvas); // LAST child = renders ON TOP of img

if (typeof FluidHover !== 'undefined') {
  canvasView.classList.add('has-fluid');
  stage.__fluidHover = FluidHover.mount(canvasView, fluidCanvas, img);
}
// ────────────────────────────────────────────────────────────────────────
```

**In `removeCanvas()`, before line 34** (`existing.remove()`):

```javascript
function removeCanvas(stage) {
  // ── Fluid hover cleanup ──────────────────────────────────────────────
  var fh = stage.__fluidHover;
  if (fh) { fh.destroy(); stage.__fluidHover = null; }
  // ────────────────────────────────────────────────────────────────────

  var existing = stage.querySelector('.canvas-opgl');
  if (existing) {
    existing.remove();
  }
  // ... rest of function unchanged ...
}
```

---

## Corrections from Peer Review (Critical)

### Correction A: Pointer Listeners on viewEl, NOT canvas
**Problem**: Canvas has `pointer-events: none` (required for click-through to zoom btn/close btn). Mousemove events on canvas will never fire.

**Fix**: Add mousemove/touchmove listeners to `viewEl` instead:
```javascript
// WRONG:
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('touchmove', onPointerMove, { passive: false });

// CORRECT:
viewEl.addEventListener('mousemove', onPointerMove);
viewEl.addEventListener('touchmove', onPointerMove, { passive: false });
```

**Coordinate mapping**: Still use `canvas.getBoundingClientRect()` for accurate pixel-to-UV conversion:
```javascript
var rect = canvas.getBoundingClientRect();
var x = e.clientX - rect.left;
var y = e.clientY - rect.top;
```

### Correction B: cursorPower = 14 (shipped value)
**Problem**: Engineer initially proposed 16 as compromise; designer proposed 14. Final consensus: ship 14 for portfolio subtlety.

**Fix**: In PARAMS object:
```javascript
var PARAMS = {
  cursorSize: 3.5,
  cursorPower: 14,    // CORRECTION: 14, not 16
  distortionPower: 0.2
};
```

### Correction C: touchmove default-on (BUNDLE C20)
**Problem**: Original spec said "mouse-only" but reference implementation includes touchmove. BUNDLE clarifies: implement touchmove by default; drop only if user explicitly requests mouse-only.

**Fix**: Add touchmove listener (already included in Step 1 above):
```javascript
viewEl.addEventListener('touchmove', onPointerMove, { passive: false });
```

---

## Verification Gates (Detailed)

### Gate 1: No-fluid fallback
**Action**: Temporarily rename `js/fluidHover.js` to `js/fluidHover.js.bak`, reload page, open panel.
**Expected**: Plain img shows, zoom works, close works, no console errors.
**Pass criteria**: Panel functions identically to pre-integration state.

### Gate 2: Hover distortion
**Action**: Restore fluidHover.js, reload, open panel, hover over image.
**Expected**: Cursor movement creates visible distortion in image. Distortion follows cursor with slight delay (fluid physics).
**Pass criteria**: Distortion is noticeable but subtle ("water on glass" feel per designer).

### Gate 3: Relaxation time
**Action**: Move cursor rapidly, then stop. Time how long until image is fully undistorted.
**Expected**: ≤2 seconds (dissipation rates .97/.98 achieve this).
**Pass criteria**: Image is 100% recognizable within 2s of cursor stop.

### Gate 4: Zoom OFF effect
**Action**: Open panel, hover, then toggle zoom ON.
**Expected**: Canvas becomes invisible (opacity 0), img becomes visible with 2.8× scale. No ghost distortion in letterbox areas.
**Pass criteria**: Clean transition, no visual artifacts.

### Gate 5: Zoom ON effect
**Action**: With zoom ON, toggle zoom OFF.
**Expected**: Canvas becomes visible (opacity 1), img becomes invisible (opacity 0). Distortion resumes from clean state (FBOs cleared).
**Pass criteria**: No stale frame flash, distortion starts fresh.

### Gate 6: Resource cleanup
**Action**: Close panel, open DevTools → Performance tab, record 5s.
**Expected**: rAF stops, no GL overhead.
**Pass criteria**: CPU usage returns to baseline, no memory leaks.

### Gate 7: Reopen speed
**Action**: Close panel, immediately reopen same image.
**Expected**: Instant open, no delay.
**Pass criteria**: No debounce delay, panel appears immediately.

### Gate 8: Concurrent panels
**Action**: Open panel in stage 1, open panel in stage 2.
**Expected**: Both panels work independently, both have fluid effect.
**Pass criteria**: 2 WebGL contexts active, no interference.

### Gate 9: prefers-reduced-motion
**Action**: Enable in DevTools → Rendering → Reduced motion, reload, open panel.
**Expected**: No canvas injected, plain img only.
**Pass criteria**: No fluid effect, no GL context created.

### Gate 10: Resize handling
**Action**: Open panel, resize browser window.
**Expected**: Canvas and FBOs resize correctly, distortion still maps to cursor.
**Pass criteria**: No visual glitches, correct coordinate mapping after resize.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebGL context loss on Safari | Medium | High | Explicit delete order; contextlost handler in mount |
| Memory leak on rapid open/close | Low | High | Strict destroy contract; verify with DevTools Memory tab |
| Ghost distortion in letterbox | Medium | Medium | Opacity toggle ensures canvas fully covers img in fluid mode |
| Touch scroll conflicts | Low | Medium | `{ passive: false }` + `e.preventDefault()` on touchmove |
| Script load failure | Low | Medium | typeof guard in cardCanvasGL.js |
| FBO resolution too low on retina | Low | Low | Reference formula scales with panel size; no DPR multiplier |

---

## Files Summary

| File | Action | Lines Changed | Notes |
|------|--------|---------------|-------|
| `js/fluidHover.js` | CREATE | ~400 | New standalone IIFE |
| `js/cardCanvasGL.js` | MODIFY | +8, -0 | Mount/destroy seam |
| `index.html` | MODIFY | +1 | Script tag insertion |
| `main.css` | MODIFY | +16 | Canvas styles + opacity rules |

---

## Post-Implementation Checklist

- [ ] All 10 verification gates pass
- [ ] No console errors in DevTools
- [ ] No memory leaks (verify with DevTools Memory tab after 5 open/close cycles)
- [ ] Touch devices: distortion works on touchmove
- [ ] Mobile: zoom button hidden (existing CSS), fluid effect works on touch
- [ ] prefers-reduced-motion: no effect on affected devices
- [ ] Both panels open simultaneously: no interference
- [ ] Rapid open/close: no delays, no glitches
- [ ] Code style: ES5-ish (var, function, no async/await, no arrow functions in critical paths)

---

## Sign-off

**Architect**: 100% consensus achieved (r4-architect-final.md)
**Engineer**: Final spec v4 (r4-engineer-final.md)
**Scout**: R4 consolidation complete
**Designer**: Taste params retained (cursorSize=3.5, cursorPower=14, distortionPower=0.2)

**Ready for implementation.**
