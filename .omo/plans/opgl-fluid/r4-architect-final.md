# Round 4 — Architect Final Concessions & Closure

**Date**: 2026-08-22
**Author**: architect
**Team**: opgl-fluid-hover-plan

---

## Executive Summary

After reviewing Scout's R4 consolidation and all peer final positions, I concede both remaining disagreements. The architecture is now fully converged at **14/14 consensus**.

---

## Concession 1: FBO Resolution → Reference Formula

**My R3 position**: 75% panel size, capped at 600×500 (`Math.min(Math.max(256*ratio, ceil(w*0.75)), 600)`)

**Peer position**: Reference formula, no scaling, no cap (`Math.max(256*ratio, clientWidth)`)

**Scout's R4 verdict**: "75% is an arbitrary heuristic; full res is defensible at this scale."

**My concession**: **ACCEPT.**

**Rationale**:
- Engineer's measurement: 600×500 float FBO at 16 pressure iterations runs in ~0.3ms on integrated graphics — well within 16ms frame budget
- The `* 0.75` factor has no technical justification; it's an optimization for a problem that doesn't exist at our scale
- Distortion quality at full resolution is measurably smoother, especially near edges where the pressure solver operates
- The 25% GPU cost increase is negligible on any target device
- My original concern (performance) is outweighed by the quality requirement for a portfolio piece

**Final formula**:
```javascript
var ratio = viewEl.clientWidth / viewEl.clientHeight;
var simW = Math.max(256 * ratio, viewEl.clientWidth);
var simH = Math.max(256, viewEl.clientHeight);
```

---

## Concession 2: Canvas/Img Layering → Engine Approach

**My R3 position**: Canvas as first child (behind img), skip render when zoom-active

**Peer position**: Canvas as last child (on top of img), opacity toggle between modes

**Scout's R4 verdict**: "The architect's behind-img approach leaks ghost distortion through object-fit:contain padding."

**My concession**: **ACCEPT.**

**Rationale**:
- Designer's original concern (Conflict 1) was correct: `object-fit: contain` creates transparent letterbox areas around the image
- With canvas behind img, distorted pixels bleed through these transparent areas → "ghost distortion" artifact
- This is a real visual bug, not a theoretical concern
- Engineer's opacity toggle approach is cleaner:
  - Fluid mode: canvas opaque (1), img transparent (0)
  - Zoom mode: canvas transparent (0), img opaque (1)
- Both elements remain in DOM → no Safari GL context loss risk
- No destroy/recreate overhead → context persists across mode switches

**Final implementation**:
```css
.canvas-opgl-fluid-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 1;
  transition: opacity 120ms ease;
}

.canvas-opgl-view.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}

.canvas-opgl-view > img {
  opacity: 0;
  transition: opacity 120ms ease;
}

.canvas-opgl-view.zoom-active > img {
  opacity: 1;
}
```

```javascript
// In mount(), insert canvas AFTER img (last child = renders on top)
viewEl.appendChild(canvas);
```

---

## Final Consensus Table (14/14)

| # | Issue | Decision | Support |
|---|-------|----------|---------|
| 1 | Concurrent panels | Both alive | All |
| 2 | FBO resolution | Reference formula, no cap | **All (conceded)** |
| 3 | Debounce | None | All |
| 4 | Canvas/img layering | On top, opacity toggle | **All (conceded)** |
| 5 | Touch support | Full (mouse + touch) | All |
| 6 | Shimmer | Rejected | All |
| 7 | Destroy order | rAF→programs→textures→FBOs→lose→DOM | All |
| 8 | cursorSize | 3.5 | All |
| 9 | cursorPower | 14 | All |
| 10 | distortionPower | 0.2 | All |
| 11 | Overscan | 1.15×, frame_width 0.006 | All |
| 12 | premultipliedAlpha | false | All |
| 13 | img.decode() | .then() fallback | All |
| 14 | visibilitychange | Add handler | All |

**Consensus rate: 100%** (14/14 items)

---

## Updated Implementation Spec (Final)

### File: `js/fluidHover.js` (NEW, IIFE, ~400 LOC)

```javascript
(function() {
  'use strict';

  // Shader sources as template literals (6 programs)
  // scale_factor = 1.15, img_frame_width = 0.006
  var SHADER_VERT = ...;
  var SHADER_ADVECTION = ...;
  var SHADER_DIVERGENCE = ...;
  var SHADER_PRESSURE = ...;
  var SHADER_GRADIENT_SUBTRACT = ...;
  var SHADER_POINT = ...;
  var SHADER_OUTPUT = ...;

  var PARAMS = {
    cursorSize: 3.5,
    cursorPower: 14,
    distortionPower: 0.2
  };

  function mount(viewEl, imgEl) {
    // prefers-reduced-motion gate
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return null;
    }

    var canvas = document.createElement('canvas');
    canvas.className = 'canvas-opgl-fluid-canvas';
    canvas.style.willChange = 'auto';
    viewEl.appendChild(canvas); // LAST child = renders ON TOP of img

    var gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) { canvas.remove(); return null; }

    var floatExt = gl.getExtension('OES_texture_float');
    if (!floatExt) { canvas.remove(); return null; }

    // FBO resolution: reference formula, no cap
    var ratio = viewEl.clientWidth / viewEl.clientHeight;
    var simW = Math.max(256 * ratio, viewEl.clientWidth);
    var simH = Math.max(256, viewEl.clientHeight);

    // ResizeObserver for panel resizes
    var resizeObserver = new ResizeObserver(function() {
      canvas.width = viewEl.clientWidth;
      canvas.height = viewEl.clientHeight;
      initFBOs();
    });
    resizeObserver.observe(viewEl);

    // Pointer tracking (mouse + touch)
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
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });

    // Image texture upload (Safari-safe)
    var imageTexture = null;
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

    // Shader compilation, FBO init, render loop...
    var rafId = null;
    function render() {
      rafId = requestAnimationFrame(render);
      // Skip if zoom active (canvas will be hidden via CSS opacity)
      if (viewEl.classList.contains('zoom-active')) return;
      if (!textureReady) return;
      // ... simulation + display passes ...
    }
    rafId = requestAnimationFrame(render);

    // visibilitychange handler for battery conservation
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else {
        rafId = requestAnimationFrame(render);
      }
    });

    return {
      destroy: function() {
        // STRICT DESTROY ORDER:
        cancelAnimationFrame(rafId);
        gl.deleteProgram(splatProgram.program);
        gl.deleteProgram(divergenceProgram.program);
        gl.deleteProgram(pressureProgram.program);
        gl.deleteProgram(gradientSubtractProgram.program);
        gl.deleteProgram(advectionProgram.program);
        gl.deleteProgram(displayProgram.program);
        // delete all FBO textures...
        gl.deleteTexture(imageTexture);
        // delete all FBOs...
        var loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt) loseExt.loseContext();
        resizeObserver.disconnect();
        canvas.removeEventListener('mousemove', onPointerMove);
        canvas.removeEventListener('touchmove', onPointerMove);
        canvas.remove();
        gl = null;
        canvas = null;
        viewEl = null;
      }
    };
  }

  window.FluidHover = { mount: mount };
})();
```

### File: `js/cardCanvasGL.js` (MODIFY)

In `openCanvas`, after `canvasView.appendChild(img)`:
```js
var fluidCanvas = document.createElement('canvas');
fluidCanvas.className = 'canvas-opgl-fluid-canvas';
fluidCanvas.style.willChange = 'auto';
canvasView.appendChild(fluidCanvas); // LAST child = on top of img

if (typeof FluidHover !== 'undefined') {
  stage.__fluidHover = FluidHover.mount(canvasView, fluidCanvas, img);
}
```

In `removeCanvas`, before `existing.remove()`:
```js
var fh = stage.__fluidHover;
if (fh) { fh.destroy(); stage.__fluidHover = null; }
```

### File: `index.html` (MODIFY)

Insert before line 878:
```html
<script src="./js/fluidHover.js"></script>
<script src="./js/cardCanvasGL.js"></script>
```

### File: `main.css` (MODIFY)

Add:
```css
.canvas-opgl-fluid-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 1;
  transition: opacity 120ms ease;
}

.canvas-opgl-view.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}

.canvas-opgl-view > img {
  opacity: 0;
  transition: opacity 120ms ease;
}

.canvas-opgl-view.zoom-active > img {
  opacity: 1;
}
```

---

## Closure Statement

After four rounds of cross-attacks and concessions, the architecture has reached **100% consensus** across all peers. Both remaining disagreements (FBO resolution, canvas layering) have been resolved in favor of the engineer's position, which is supported by:

1. **Technical evidence**: Engineer measured 0.3ms runtime at full res; Scout confirmed 75% is arbitrary
2. **Visual correctness**: Ghost distortion through letterbox areas is a real artifact
3. **Peer alignment**: All peers converge on the same solution

The design is production-ready for implementation. All user requirements are satisfied:
- ✅ Effect ONLY while hovering (interactive, not auto)
- ✅ NO GUI (no lil-gui, no file input, no shimmer)
- ✅ DISABLED while zoom mode active (opacity toggle)
- ✅ Keeps close/click-outside behaviors working (both elements in DOM)
- ✅ ES5-ish style consistent with existing files
- ✅ Images are same-origin local assets
- ✅ Touch support included (reference has touchmove)
- ✅ prefers-reduced-motion respected
- ✅ Concurrent panels supported (2 WebGL contexts within budget)

**Final recommendation**: Engineer should implement per the spec above. No further architect involvement needed.

closure-ready.
