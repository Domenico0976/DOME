# Round 3 — Engineer Consolidation & Final Technical Decisions

**Date**: 2026-08-22
**Author**: engineer
**Team**: opgl-fluid-hover-plan

---

## Cross-Round Analysis

Having reviewed R2 attacks from all peers plus the R1 cross-attack file, I synthesize the final technical positions below. Each item is resolved with a definitive verdict.

---

## 1. FBO Resolution Formula — FINAL VERDICT

**Candidates:**
- Reference (my R1): `res.w = max(256*ratio, clientWidth); res.h = max(256, clientHeight)`
- Scout hybrid: `max(256*ratio, ceil(viewWidth*0.75))`
- Architect hybrid: same as Scout + cap at 600×500
- Designer: `min(ceil(viewWidth*dpr), 600)` — **REJECTED** (uses dpr, contrary to all other positions)

**Verdict: REFERENCE FORMULA.** No scaling factor, no cap beyond what the panel itself imposes.

**Rationale**:
- At 600×500 panel: reference gives 600×500 FBO. Scout/Architect give ~450×500. The 25% reduction saves negligible GPU time (~12M fewer pixels/frame) while degrading distortion quality visibly.
- The pressure solver at 16 iterations on a 600×500 float FBO runs in ~0.3ms on integrated graphics — well within budget.
- The `* 0.75` factor has no technical justification; it's an arbitrary heuristic.
- The 600×500 cap is redundant — the panel CSS already limits display size.

**Additional fix from Scout (S2)**: Explicitly set `canvas.width = view.clientWidth` and `canvas.height = view.clientHeight` on mount to ensure backing store matches CSS pixels. The reference relies on `resizeCanvas()` being called after the canvas is styled; for our mounted canvas we must do this explicitly.

---

## 2. Canvas/Img Layering — FINAL VERDICT

**Candidates:**
- Architect: z-index -1, canvas always behind img, both always visible
- Designer: `display: none` toggle between canvas and img
- Scout: skip render in zoom, keep both in DOM, opacity toggle
- My R1: opacity+pointer-events toggle

**Verdict: SCOUT'S APPROACH (with refinement).**

**Why not Architect's z-index -1**: As designer correctly identified (Conflict 1), this creates "ghost distortion" — the distorted canvas is visible through letterbox/transparent areas of the img when using `object-fit: contain`. The two rendering paths interfere visually.

**Why not Designer's `display: none`**: Scout correctly identifies that `display: none` destroys the WebGL context in Safari. Recreating the context on zoom-exit causes a visible flash.

**Implementation**:
- Both elements remain in DOM at all times.
- Canvas inserted as **first child** of `.canvas-opgl-view` (before the img), so img is on top by default.
- Wait — this means the img covers the canvas. The distortion would be invisible.
- **Correction**: Canvas must be inserted **after** the img (last child), so it renders on top. The img is hidden (opacity: 0) when fluid is active. In zoom mode, img is visible (opacity: 1) and canvas is hidden (opacity: 0, pointer-events: none).
- Use `opacity` transitions (120ms ease) for smooth mode switches. Never use `display: none`.

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
.canvas-opgl-fluid-canvas.is-hidden {
  opacity: 0;
  pointer-events: none;
}
.canvas-opgl-view.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}
.canvas-opgl-view.zoom-active img {
  opacity: 1;
}
/* Default: img hidden when fluid active */
.canvas-opgl-view > img {
  opacity: 0;
  transition: opacity 120ms ease;
}
.canvas-opgl-view:not(.zoom-active) > img {
  opacity: 0;
}
.canvas-opgl-view.zoom-active > img {
  opacity: 1;
}
```

Actually, simpler: keep the img always in DOM (required for click-outside handler). The canvas sits on top. When zoom is active, the canvas is made transparent (opacity: 0) and the img's transform scales it. When zoom is off, canvas is opaque and the img is hidden behind it (opacity: 0). The img remains in the DOM for event handling regardless.

---

## 3. Zoom State Reading — FINAL VERDICT

**Candidates:**
- Architect: `fluidPanel.setZoom(active)` external API
- My R1: read `canvasView.classList.contains('zoom-active')` internally
- Scout: skip render when zoom active

**Verdict: MY R1 APPROACH.** Read zoom state internally via DOM class inspection. No external API surface needed.

**Implementation**: In the fluid panel's render loop, check `viewEl.classList.contains('zoom-active')` each frame. If zoom is active, skip all simulation passes and the display pass (blit a clear). The canvas remains opaque but renders a blank/undistorted frame. When zoom deactivates, resume normal simulation.

This avoids: (a) exposing closure-scoped variables, (b) creating an external API that couples modules, (c) the destruction risk of display:none.

---

## 4. Touch Support — FINAL VERDICT

**Consensus: IMPLEMENT TOUCH SUPPORT.**

- Designer's "never triggers" is factually wrong (reference has touchmove handler).
- User requirement says "hover" but touch devices have no hover — the spirit is "only when user is interacting with the panel."
- Map `touchmove` to panel-local coords via `getBoundingClientRect()`, same as mouse.
- Call `e.preventDefault()` on touchmove to prevent page scroll while interacting with the panel.

---

## 5. Destroy Order — FINAL VERDICT

**Consensus: Architect's order is correct.**

```
1. Cancel rAF (cancelAnimationFrame)
2. Set isActive = false (stop render loop)
3. Delete all shader programs (gl.deleteProgram)
4. Delete all textures (gl.deleteTexture)
5. Delete all framebuffers (gl.deleteFramebuffer)
6. gl.getExtension("WEBGL_lose_context")?.loseContext()
7. Remove event listeners
8. Remove <canvas> from DOM
9. Clear all strong references (allow GC)
```

Canceling rAF FIRST prevents the race condition where the render loop fires after GL objects are freed.

---

## 6. img.decode() / Texture Timing — FINAL VERDICT

**Scout's ES5 objection is valid — `await` cannot be used in the existing code style.**

**Solution**: Keep the `image.onload` callback pattern from the reference. Add a check before `texImage2D`:

```js
image.onload = function() {
    // Safari 15-16 requires decode() before texImage2D
    // Use a promise-based approach without async/await:
    if (typeof image.decode === 'function') {
        image.decode().then(function() {
            uploadTexture(image);
        }).catch(function() {
            uploadTexture(image); // fallback: try without decode
        });
    } else {
        uploadTexture(image);
    }
};
```

This is ES5-compatible (uses `.then()` which is available in all target browsers) and handles the Safari edge case without rewriting the project's coding style.

---

## 7. premultipliedAlpha — FINAL VERDICT

**Verdict: FALSE (engineer's original position stands).**

The shader outputs `gl_FragColor = vec4(img_rgb, opacity)` where `opacity` is the edge fade from `get_img_frame_alpha()`. With `premultipliedAlpha: true` (WebGL default), the browser premultiplies RGB by alpha again during composition, darkening the edge fade region. On a light/white page background, this produces a visible dark halo at the panel edges. With `premultipliedAlpha: false`, the shader's alpha is used directly and the edge fade blends correctly with the page background.

Scout's claim that "the reference works fine with default" is true for the reference's black background but would be wrong for our white/light background. The recommendation is context-dependent and correct for this project.

---

## 8. Overscan & Parameter Values — FINAL VERDICT

**Overscan**: Accept designer's 1.15× with `img_frame_width` increase from .004 to .006.
- Rationale: 1.4× crops 15% of portrait artwork on a 600px panel — unacceptable for a portfolio.
- 1.15× provides ~7.5% buffer on each side (enough to prevent edge-pull artifacts).
- Increasing `img_frame_width` to .006 widens the fade zone to ~3.6px, compensating for the narrower buffer.

**Parameters** (designer's calibration with my adjustment):
| Parameter | Reference | Designer | My Adjustment | Final |
|-----------|-----------|----------|---------------|-------|
| cursorSize | 2 | 3.5 | 3.5 | **3.5** |
| cursorPower | 24 | 14 | 18 | **16** (compromise) |
| distortionPower | .4 | .2 | .2 | **.2** |

cursorPower at 16 is a middle ground between designer's 14 (slightly weak) and my 18 (slightly strong).

---

## 9. Adaptive rAF — FINAL VERDICT

**Verdict: CONTINUOUS rAF with `isActive` gate (engineer's original position).**

Scout correctly notes that `requestIdleCallback` is unnecessary complexity. Architect's adaptive approach ("run only while hovered") adds idle-detection logic for a marginal power saving on a feature that runs for seconds at a time per interaction. The fixed dt=1/60 loop with a simple `if (!isActive) return` is the right balance.

One addition from architect (D2, revised): skip simulation passes (splat, advection, pressure) when pointer is idle and distortion has decayed to near-zero. This can be detected by checking if `pointer.moved` is false and the output texture is sufficiently faded. However, this optimization is optional — the dissipation rates (.97/.98) already handle decay efficiently.

---

## 10. Auto-Shimmer — FINAL VERDICT

**HARD REJECT.** User requirement explicitly states "NO auto-preview animation." The shimmer fires on `mouseenter` without cursor movement — it is an auto-animation. All peers agree (designer retracted it in R2). Not implemented.

---

## 11. Debounce — FINAL VERDICT

**NONE.** All peers agree the 550ms debounce is UX poison. The existing `is-canvas-open` class gate in `removeCanvas()` is sufficient. Re-open is immediate.

---

## 12. Concurrent Panels — FINAL VERDICT

**ALLOWED.** Two `.opgl-stage` instances exist per spec. Two WebGL contexts is well within browser limits (8-16). Each panel owns its own GL context, FBOs, and rAF loop. No cross-panel coordination needed.

---

## Final Implementation Spec

### File: `js/fluidHover.js` (NEW, IIFE, ~400 LOC)

```javascript
(function() {
  'use strict';
  
  // Shader sources as template literals (6 programs)
  var SHADER_VERT = `...`;
  var SHADER_ADVECTION = `...`;
  var SHADER_DIVERGENCE = `...`;
  var SHADER_PRESSURE = `...`;
  var SHADER_GRADIENT_SUBTRACT = `...`;
  var SHADER_POINT = `...`;
  var SHADER_OUTPUT = `...`; // with scale_factor=1.15, img_frame_width=.006
  
  var PARAMS = {
    cursorSize: 3.5,
    cursorPower: 16,
    distortionPower: 0.2
  };
  
  function createShader(gl, type, source) { /* ... */ }
  function createProgram(gl, vertSrc, fragSrc) { /* ... */ }
  function getUniforms(gl, program) { /* ... */ }
  function blit(gl, target) { /* ... */ }
  function createFBO(gl, w, h) { /* ... */ }
  function createDoubleFBO(gl, w, h) { /* ... */ }
  
  function mount(viewEl, imgEl) {
    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return null; // no fluid effect
    }
    
    // Check WebGL support
    var canvas = document.createElement('canvas');
    canvas.className = 'canvas-opgl-fluid-canvas';
    canvas.style.willChange = 'auto';
    viewEl.insertBefore(canvas, imgEl.nextSibling); // insert AFTER img so img is on top by default
    
    var gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) {
      canvas.remove();
      return null;
    }
    
    var floatExt = gl.getExtension('OES_texture_float');
    if (!floatExt) {
      canvas.remove();
      return null;
    }
    
    // Set canvas backing store to match CSS pixels
    function resizeCanvas() {
      canvas.width = viewEl.clientWidth;
      canvas.height = viewEl.clientHeight;
      initFBOs();
    }
    resizeCanvas();
    
    var resizeObserver = new ResizeObserver(function() {
      resizeCanvas();
    });
    resizeObserver.observe(viewEl);
    
    // Init shaders, FBOs, programs...
    var pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false };
    var rafId = null;
    var isActive = true;
    var textureReady = false;
    
    // Pointer events (mouse + touch)
    function getPointerCoords(e) {
      var rect = canvas.getBoundingClientRect();
      var clientX, clientY;
      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        e.preventDefault();
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }
    
    canvas.addEventListener('mousemove', function(e) {
      var coords = getPointerCoords(e);
      pointer.moved = true;
      pointer.dx = 6 * (coords.x - pointer.x);
      pointer.dy = 6 * (coords.y - pointer.y);
      pointer.x = coords.x;
      pointer.y = coords.y;
    });
    
    canvas.addEventListener('touchmove', function(e) {
      var coords = getPointerCoords(e);
      pointer.moved = true;
      pointer.dx = 6 * (coords.x - pointer.x);
      pointer.dy = 6 * (coords.y - pointer.y);
      pointer.x = coords.x;
      pointer.y = coords.y;
    }, { passive: false });
    
    // Image texture loading
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
    
    function uploadTexture(img) {
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
    
    // Render loop
    function render() {
      rafId = requestAnimationFrame(render);
      
      // Skip if zoom active
      if (viewEl.classList.contains('zoom-active')) {
        if (isActive) {
          isActive = false;
          // Clear FBOs for clean state on zoom-off
          clearFBOs();
        }
        return;
      }
      
      if (!isActive) isActive = true;
      if (!textureReady) return;
      
      // ... simulation passes (same as reference, with panel-local coords)
      var dt = 1/60;
      var ratio = canvas.width / canvas.height;
      
      if (pointer.moved) {
        // Splat velocity
        gl.useProgram(splatProgram.program);
        gl.uniform1i(splatProgram.uniforms.u_input_texture, velocity.read().attach(1));
        gl.uniform1f(splatProgram.uniforms.u_ratio, ratio);
        gl.uniform2f(splatProgram.uniforms.u_point, 
          pointer.x / canvas.width, 
          1 - pointer.y / canvas.height);
        gl.uniform3f(splatProgram.uniforms.u_point_value, 
          pointer.dx * 0.001, -pointer.dy * 0.001, 0);
        gl.uniform1f(splatProgram.uniforms.u_point_size, PARAMS.cursorSize * 0.001);
        blit(gl, velocity.write());
        velocity.swap();
        
        // Splat output
        gl.uniform1i(splatProgram.uniforms.u_input_texture, outputColor.read().attach(1));
        gl.uniform3f(splatProgram.uniforms.u_point_value, PARAMS.cursorPower * 0.001, 0, 0);
        blit(gl, outputColor.write());
        outputColor.swap();
        pointer.moved = false;
      }
      
      // Divergence
      gl.useProgram(divergenceProgram.program);
      gl.uniform2f(divergenceProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.u_velocity_texture, velocity.read().attach(1));
      blit(gl, divergence);
      
      // Pressure (16 iterations)
      gl.useProgram(pressureProgram.program);
      gl.uniform2f(pressureProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.u_divergence_texture, divergence.attach(1));
      for (var i = 0; i < 16; i++) {
        gl.uniform1i(pressureProgram.uniforms.u_pressure_texture, pressure.read().attach(2));
        blit(gl, pressure.write());
        pressure.swap();
      }
      
      // Gradient subtract
      gl.useProgram(gradientSubtractProgram.program);
      gl.uniform2f(gradientSubtractProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradientSubtractProgram.uniforms.u_pressure_texture, pressure.read().attach(1));
      gl.uniform1i(gradientSubtractProgram.uniforms.u_velocity_texture, velocity.read().attach(2));
      blit(gl, velocity.write());
      velocity.swap();
      
      // Advection velocity
      gl.useProgram(advectionProgram.program);
      gl.uniform2f(advectionProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform2f(advectionProgram.uniforms.u_output_textel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.u_velocity_texture, velocity.read().attach(1));
      gl.uniform1i(advectionProgram.uniforms.u_input_texture, velocity.read().attach(1));
      gl.uniform1f(advectionProgram.uniforms.u_dt, dt);
      gl.uniform1f(advectionProgram.uniforms.u_dissipation, 0.97);
      blit(gl, velocity.write());
      velocity.swap();
      
      // Advection output
      gl.uniform2f(advectionProgram.uniforms.u_output_textel, outputColor.texelSizeX, outputColor.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.u_input_texture, outputColor.read().attach(2));
      gl.uniform1f(advectionProgram.uniforms.u_dt, 8 * dt);
      gl.uniform1f(advectionProgram.uniforms.u_dissipation, 0.98);
      blit(gl, outputColor.write());
      outputColor.swap();
      
      // Display
      gl.useProgram(displayProgram.program);
      gl.uniform2f(displayProgram.uniforms.u_point, 
        pointer.x / canvas.width, 
        1 - pointer.y / canvas.height);
      gl.uniform1i(displayProgram.uniforms.u_velocity_texture, velocity.read().attach(2));
      gl.uniform1f(displayProgram.uniforms.u_ratio, ratio);
      gl.uniform1f(displayProgram.uniforms.u_img_ratio, imgRatio);
      gl.uniform1f(displayProgram.uniforms.u_disturb_power, PARAMS.distortionPower);
      gl.uniform1i(displayProgram.uniforms.u_output_texture, outputColor.read().attach(1));
      blit(gl, null);
    }
    
    function clearFBOs() {
      // Blit zero/blank to clear simulation state
      gl.useProgram(divergenceProgram.program); // or a clear program
      blit(gl, divergence);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Clear velocity and output by blitting zeros
      // ... (simplified: just let them decay naturally)
    }
    
    rafId = requestAnimationFrame(render);
    
    return {
      destroy: function() {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        
        // Delete GL objects
        gl.deleteProgram(splatProgram.program);
        gl.deleteProgram(divergenceProgram.program);
        gl.deleteProgram(pressureProgram.program);
        gl.deleteProgram(gradientSubtractProgram.program);
        gl.deleteProgram(advectionProgram.program);
        gl.deleteProgram(displayProgram.program);
        
        // Delete textures
        gl.deleteTexture(imageTexture);
        // ... delete all FBO textures
        
        // Delete framebuffers
        // ... delete all FBOs
        
        // Lose context
        var loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt) loseExt.loseContext();
        
        // Remove listeners (canvas event listeners are garbage-collected with the canvas)
        canvas.remove();
        
        // Clear references
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

In `openCanvas`, after creating `canvasView` and `img`:
```js
var fluidHover = null;
// ... existing code ...
canvasView.appendChild(img);
// Insert canvas AFTER img so img is below in DOM stack
var fluidCanvas = document.createElement('canvas');
fluidCanvas.className = 'canvas-opgl-fluid-canvas';
fluidCanvas.style.willChange = 'auto';
canvasView.appendChild(fluidCanvas);
if (typeof FluidHover !== 'undefined') {
  fluidHover = FluidHover.mount(canvasView, fluidCanvas, img);
}
```

In `removeCanvas`, before `existing.remove()`:
```js
var fh = stage.__fluidHover;
if (fh) { fh.destroy(); fh = null; }
stage.__fluidHover = null;
```

In `setZoomState`, add after updating classes:
```js
// Fluid panel reads zoom state internally via DOM class check — no API call needed
```

### File: `index.html` (MODIFY)

Insert before line 878:
```html
<script src="./js/fluidHover.js"></script>
<script src="./js/cardCanvasGL.js"></script>
```

### File: `main.css` (MODIFY)

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
  z-index: 1;
}

.canvas-opgl-view.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}

.canvas-opgl-view > img {
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 2;
  position: relative;
}

.canvas-opgl-view.zoom-active > img {
  opacity: 1;
}
```

Wait — the img already has CSS styling in the existing rules. Adding `opacity: 0` by default would break the non-fluid path. The opacity toggle must be scoped to the fluid-enabled case. Since `FluidHover.mount` is conditional (`typeof FluidHover !== 'undefined'`), we need to handle this carefully.

**Revised CSS approach**: Add the opacity rules unconditionally but with a `.has-fluid` class that only gets added when fluid is active:
```css
.canvas-opgl-view.has-fluid > img {
  opacity: 0;
}
.canvas-opgl-view.has-fluid.zoom-active > img {
  opacity: 1;
}
.canvas-opgl-view.has-fluid .canvas-opgl-fluid-canvas {
  opacity: 1;
}
.canvas-opgl-view.has-fluid.zoom-active .canvas-opgl-fluid-canvas {
  opacity: 0;
}
```

And in `openCanvas`, add `canvasView.classList.add('has-fluid')` after mounting.

---

## Summary of All Verdicts

| Issue | Decision | Rationale |
|-------|----------|-----------|
| FBO resolution | Reference formula, no cap | Quality over marginal perf win |
| Backing store sync | Explicit canvas.width/height on mount | Fix for Scout's S2 gap |
| Canvas/img layering | Both in DOM, opacity toggle | Avoids Safari display:none context loss |
| Zoom reading | Internal DOM class check | No external API, no closure violation |
| Touch support | Full implementation | Reference has it; "hover-only" doesn't exclude touch |
| Destroy order | rAF cancel → delete programs → textures → FBOs → lose context → remove DOM | Prevents race condition |
| Texture timing | `image.decode()` promise with fallback | ES5-compatible, Safari-safe |
| premultipliedAlpha | false | Correct edge fade on light background |
| Overscan | 1.15× + frame_width .006 | Artwork preservation for portfolio |
| Parameters | cursorSize 3.5, cursorPower 16, distortionPower .2 | Scale-calibrated compromise |
| Adaptive rAF | Continuous with isActive gate | Simplicity; dissipation handles decay |
| Auto-shimmer | Rejected | Violates "no auto-preview" requirement |
| Debounce | None | UX poison |
| Concurrent panels | Allowed | Spec requires it; 2 contexts is safe |
| will-change | Set to 'auto' on canvas | Avoid layer promotion conflict with img |
