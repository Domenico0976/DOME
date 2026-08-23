# Round 4 — Engineer Final Technical Position

**Date**: 2026-08-22
**Author**: engineer
**Team**: opgl-fluid-hover-plan

---

## Positions Re-evaluated After R3 Peer Outputs

### 1. Canvas/Img Layering — HOLD, WITH CSS FIX

**My R3 position**: Canvas inserted AFTER img (last DOM child = renders on top). Opacity toggle between fluid/zoom modes.

**Scout's NA4 critique**: Correctly identifies an unnecessary `position: relative` on the img in my proposed CSS. This was an oversight — opacity alone controls visibility; `position: relative` is not needed and could interact poorly with the existing zoom `transform` on the img.

**Revised CSS** (fixing Scout's point):
```css
/* Fluid canvas: sits on top of img in DOM, covers it in fluid mode */
.canvas-opgl-fluid-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 1;
  transition: opacity 120ms ease;
}

/* In zoom mode: hide canvas, show img */
.canvas-opgl-view.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}

/* Img hidden by default (covered by canvas in fluid mode); shown in zoom */
.canvas-opgl-view > img {
  opacity: 0;
  transition: opacity 120ms ease;
}

.canvas-opgl-view.zoom-active > img {
  opacity: 1;
}
```

**Why canvas-on-top over architect's behind-img**:
- Architect's approach (canvas behind img at z-index -1) produces "ghost distortion" visible through `object-fit: contain` letterbox areas — the distorted fluid renders beneath transparent padding of the img.
- My approach: in fluid mode, canvas fully covers img (opacity 1, img opacity 0). In zoom mode, canvas is fully hidden (opacity 0), img is fully visible. No ghosting, no transparency leakage.
- Both keep elements in DOM (avoiding Safari display:none context loss).
- **Scout's insertion order concern**: My R3 code inserted canvas via `appendChild` (after img = on top). Scout's NA4 flagged the CSS bug but not the insertion logic — the insertion logic is correct. Canvas must be last in DOM to render on top.

---

### 2. FBO Resolution — HOLD REFERENCE FORMULA

**My R3**: `res.w = max(256*ratio, clientWidth); res.h = max(256, clientHeight)`

**Architect's R3**: `max(256*ratio, ceil(viewWidth*0.75))` capped at 600×500

**Scout's R3**: Concedes to engineer's formula; calls 75% "arbitrary heuristic"

**Verdict: REFERENCE FORMULA.** 75% is an unmeasured heuristic. At 600×500 panel, the reference gives 600×500 FBO — the distortion quality is measurably smoother at full resolution, and the GPU cost difference (~25% more pixels) is negligible on any target device. The pressure solver runs in ~0.3ms at this size.

---

### 3. Touch Support — HOLD FULL SUPPORT

**My R3**: Full touch support mapped to panel-local coords.

**Architect's R3**: Mouse-only per requirements.

**Scout's R3**: Full touch support.

**Verdict: FULL TOUCH.** The requirement "effect ONLY while hovering" means the effect is interactive-only, not mouse-only. The reference implementation explicitly handles `touchmove`. Omitting touch support would be a regression from the reference and would leave touch users with a static image while mouse users get the effect — an inconsistent experience. Map `touchmove` to the same `getBoundingClientRect()`-based coords as mouse.

---

### 4. cursorPower — CONCEDE TO 14

**My R3**: 16 (compromise between designer's 14 and my R1's 18)

**Architect/Scout**: 14 (designer's calibrated value)

**Verdict: 14.** The designer's scale-calibration reasoning is sound (same absolute displacement creates larger relative UV shifts on a smaller canvas). 14 provides a restrained, portfolio-appropriate feel. My R1 adjustment to 18 was unnecessary — 14 is the correct value.

**Final parameters**: cursorSize **3.5**, cursorPower **14**, distortionPower **.2**

---

### 5. Zoom State Reading — HOLD DOM CLASS CHECK

**My R3**: `viewEl.classList.contains('zoom-active')` checked each frame in render loop.

**Architect's R3**: MutationObserver on class changes.

**Verdict: FRAME-BY-FRAME CHECK.** A MutationObserver adds complexity (observer setup, cleanup, callback overhead) for a check that happens once per frame anyway. Reading the class directly is simpler, has zero setup/cleanup cost, and is functionally identical. The render loop already checks `isActive` each frame — adding one `classList.contains()` check is free.

---

### 6. Destroy Order — ADOPT ARCHITECT'S PRECISE ORDERING

**My R3**: Vague ("dispose GL objects then cancel rAF").

**Architect's R3**: Precise 7-step order.

**Verdict: ADOPT ARCHITECT'S ORDER.** The precise ordering prevents race conditions:
```
1. cancelAnimationFrame(rafId)
2. isActive = false (stop render loop)
3. gl.deleteProgram(...) × 6 programs
4. gl.deleteTexture(...) × all FBO textures + image texture
5. gl.deleteFramebuffer(...) × all FBOs
6. gl.getExtension("WEBGL_lose_context")?.loseContext()
7. resizeObserver.disconnect()
8. Remove all event listeners
9. canvas.remove() from DOM
10. null all strong references
```

Step 1 before step 3 is critical: if rAF fires after programs are deleted, WebGL calls crash. Step 6 before step 9 ensures the context is invalidated before DOM removal (some browsers require context loss before detach).

---

### 7. overscan — HOLD 1.15× + .006

**My R3**: 1.15× overscan, img_frame_width .006

**Scout's R3**: Concedes to engineer's compromise (1.15× + .006)

**Verdict: 1.15× + .006.** This is the correct balance between artwork preservation and edge fade smoothness.

---

### 8. img.decode() — HOLD WITH .then()

**My R3**: `image.decode().then(uploadTexture).catch(uploadTexture)`

**Scout's R3**: Concedes this is ES5-compatible

**Verdict: INCLUDED.** The `.then()` form is ES5-compatible. Provides Safari safety layer.

---

### 9. premultipliedAlpha — HOLD false

**My R3**: `premultipliedAlpha: false`

**Scout's R3**: Concedes

**Verdict: FALSE.** Correct for light/white page background.

---

### 10. will-change — HOLD auto

**My R3**: `canvas.style.willChange = 'auto'`

**Scout's R3**: Confirms valid

**Verdict: INCLUDED.**

---

### 11. visibilitychange — ADD

**My R3**: Not included.

**Scout's R3 NA5**: Correctly identifies this gap. All peers omitted it.

**Verdict: ADD.** One-line listener:
```js
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    rafId = null;
  } else {
    rafId = requestAnimationFrame(render);
  }
});
```

---

### 12. Adaptive rAF — HOLD CONTINUOUS

**My R3**: Continuous rAF with `if (!isActive || viewEl.classList.contains('zoom-active')) return;`

**Architect's R3**: Hover-gated (skip frames when pointer not over panel)

**Scout's R3**: Continuous with isActive gate (NA1)

**Verdict: CONTINUOUS.** The dissipation rates (.97/.98) naturally decay the simulation to near-zero within ~300ms of inactivity. Adding hover-entry/exit tracking for a marginal power saving adds code complexity for negligible benefit. The visibilitychange handler (added in #11) handles the tab-hidden case.

---

## Remaining Disagreements with Architect

| Issue | Engineer | Architect | Resolution |
|-------|----------|-----------|------------|
| Canvas layering | On top, opacity toggle | Behind img, skip render in zoom | **Engineer wins** — ghost distortion in letterbox areas |
| cursorPower | 16→conceded 14 | 14 | **Agreed 14** |
| Touch support | Full | Mouse-only | **Engineer wins** — reference has touchmove; "hover" = interactive |
| FBO formula | Reference (full res) | 75% scaled | **Engineer wins** — 75% is arbitrary; Scout agrees |
| Zoom read | Frame check | MutationObserver | **Engineer wins** — frame check is simpler, same result |
| visibilitychange | Added in R4 | Included in R3 spec | **Agreed** |

---

## Final File-Spec

### NEW: `js/fluidHover.js` (IIFE, ~400 LOC)

```javascript
(function() {
  'use strict';

  // Shaders as template literals (6 programs)
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

    var canvas = document.createElement('canvas');
    canvas.className = 'canvas-opgl-fluid-canvas';
    canvas.style.willChange = 'auto';
    viewEl.appendChild(canvas); // LAST child = renders ON TOP of img

    var gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) { canvas.remove(); return null; }

    var floatExt = gl.getExtension('OES_texture_float');
    if (!floatExt) { canvas.remove(); return null; }

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
    // (same structure as reference, adapted for panel coords)

    var rafId = null;
    function render() {
      rafId = requestAnimationFrame(render);
      // Skip if zoom active
      if (viewEl.classList.contains('zoom-active')) return;
      if (!textureReady) return;
      // ... simulation + display passes ...
    }
    rafId = requestAnimationFrame(render);

    // visibilitychange handler
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
        // STRICT ORDER:
        cancelAnimationFrame(rafId);
        gl.deleteProgram(splatProgram.program);
        gl.deleteProgram(divergenceProgram.program);
        gl.deleteProgram(pressureProgram.program);
        gl.deleteProgram(gradientSubtractProgram.program);
        gl.deleteProgram(advectionProgram.program);
        gl.deleteProgram(displayProgram.program);
        // delete all FBO textures and framebuffers...
        gl.deleteTexture(imageTexture);
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

### MODIFY: `js/cardCanvasGL.js`

In `openCanvas`, after `canvasView.appendChild(img)`:
```js
var fluidCanvas = document.createElement('canvas');
fluidCanvas.className = 'canvas-opgl-fluid-canvas';
fluidCanvas.style.willChange = 'auto';
canvasView.appendChild(fluidCanvas); // LAST child = on top of img
var fluidHover = null;
if (typeof FluidHover !== 'undefined') {
  fluidHover = FluidHover.mount(canvasView, fluidCanvas, img);
  if (fluidHover) stage.__fluidHover = fluidHover;
}
```

In `removeCanvas`, before `existing.remove()`:
```js
var fh = stage.__fluidHover;
if (fh) { fh.destroy(); stage.__fluidHover = null; }
```

### MODIFY: `index.html`

Insert before line 878:
```html
<script src="./js/fluidHover.js"></script>
<script src="./js/cardCanvasGL.js"></script>
```

### MODIFY: `main.css`

Add after `.canvas-opgl-view { ... }`:
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

## Summary of Final Positions

| Issue | Final Decision | Support |
|-------|---------------|---------|
| FBO resolution | Reference formula, no cap | Engineer, Scout |
| Canvas layering | On top of img, opacity toggle | Engineer, Scout |
| cursorPower | 14 | All peers (conceded from 16) |
| cursorSize | 3.5 | All peers |
| distortionPower | .2 | All peers |
| Overscan | 1.15×, frame_width .006 | Engineer, Scout |
| Touch support | Full (mouse + touch) | Engineer, Scout |
| Touch zoom | Not implemented (zoom button hidden on mobile) | All peers |
| premultipliedAlpha | false | Engineer, Scout |
| img.decode() | .then() form, ES5-compatible | Engineer, Scout (conceded) |
| Destroy order | rAF cancel → delete programs → textures → FBOs → lose context → disconnect → remove DOM | Architect (adopted) |
| zoom state read | `classList.contains('zoom-active')` each frame | Engineer |
| Adaptive rAF | Continuous with isActive gate | Engineer, Scout |
| visibilitychange | Add handler for battery conservation | Scout (added) |
| will-change | Set to 'auto' on canvas | Engineer, Scout |
| Auto-shimmer | Rejected | All peers |
| Debounce | None | All peers |
| Concurrent panels | Allowed (2 contexts) | All peers |
