# Round 1 — Architect Findings

**Date**: 2026-08-22
**Author**: architect
**Team**: opgl-fluid-hover-plan

---

## Reference Analysis

**Webgl-image.txt** is a monolithic ~600-line ESM module (Pavel Dobryakov / Ksenia K Codepen):
- 6 shader programs: vert, advection, divergence, pressure, gradientSubtract, pointSplat, output/display
- Ping-pong FBOs: `outputColor`, `velocity` (double), `divergence`, `pressure` (single)
- Fixed dt: 1/60s in rAF loop
- Pointer tracking: `pageX/pageY` mapped to window UVs; `dx/dy = 6*(eX-pointer.x)`
- Image texture: loaded via `Image` + `gl.texImage2D`, crossOrigin="anonymous"
- Default params: `cursorSize=2`, `cursorPower=24`, `distortionPower=0.4`
- Auto-preview: animated sine-wave pointer until first interaction
- lil-gui controls present — must be removed per requirements
- FBO resolution: `Math.max(256*ratio, clientWidth)` / `Math.max(256, clientHeight)` — full window sized
- **No teardown path** — designed as single-use demo

---

## Existing Context

**cardCanvasGL.js** (IIFE, ~155 lines, ES5 style):
- `openCanvas(stage, imageSrc, selectedCard)` → creates `.canvas-opgl > .canvas-opgl-view > img` + zoom btn + close btn
- Zoom mode: local `isZoomActive` flag; when active, view gets `.zoom-active`, mousemove sets `transform-origin` + `scale(2.8)` on img
- `removeCanvas(stage)` → removes `.canvas-opgl` DOM node entirely, resets selected card return animation (500ms setTimeout)
- Two `.opgl-stage` instances exist; each panel independent
- All code inside one IIFE, uses `var`/`function` patterns

**main.css** (lines 2655-2792):
- `.canvas-opgl`: `position: absolute; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px`
- `.canvas-opgl-view`: `position: relative; display: inline-flex; max-width: min(100%, 600px); max-height: 500px; border-radius: 14px; overflow: hidden`
- `.canvas-opgl-view img`: `display: block; max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 14px; transition: transform 0.12s ease; will-change: transform`
- `.canvas-opgl-close`: absolute top-right, opacity 0 by default, shows on hover/focus-within
- `.canvas-opgl-zoom-btn`: absolute bottom-left, hidden on mobile (<1024px)

**index.html** (lines 870-878):
```html
<script src="./js/slider.js"></script>
<script src="./js/cardCanvasGL.js"></script>
```

---

## 1) Module/File Organization

**Recommendation: New standalone file `js/fluidImage.js` (IIFE-wrapped), exposing `FluidPanel` namespace.**

### Alternatives Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **A: Standalone file** (recommended) | Clean separation, blast radius containment, testable in isolation | Requires modifying cardCanvasGL.js at 2 call sites |
| B: Embed in cardCanvasGL.js | Single file, no global namespace | Couples two concerns, 155→550 LOC, harder to debug |
| C: MutationObserver | Zero changes to cardCanvasGL | Fragile, observer overhead, cleanup via MutationRecord removal is tricky, hard to pass image URL before DOM appears |

### Rationale
- **Blast radius containment**: cardCanvasGL.js stays <200 LOC; fluid sim logic isolated
- **Observer decoupling**: FluidPanel owns lifecycle independently; mounts into existing DOM subtree
- **ESM vs IIFE**: Reference uses ESM (`import GUI from ...`); our project is vanilla IIFE + script tags. Keep fluidImage.js as IIFE to avoid module system mismatch
- **No lil-gui dependency**: User requirement — no GUI. Hardcode params.

---

## 2) Instance & Resource Management

### Per-Panel Lifecycle
**Keyed by `stage` element reference + `canvasView` element reference.**

### Context Budget Risk
- Browsers allow ~8-16 live WebGL contexts
- Two simultaneous panels × 6 programs × multiple FBOs = 12+ contexts if both stay open
- **Solution**: Staggered activation — only one FluidPanel alive at a time; `open()` destroys previous before mounting new

### Destroy Contract (Strict Order)
```
1. Cancel rAF (cancelAnimationFrame)
2. gl.getExtension('WEBGL_lose_context')?.loseContext()  // fast context drop
3. Delete FBO textures + framebuffers (gl.deleteTexture, gl.deleteFramebuffer)
4. Delete programs (gl.deleteProgram)
5. Remove pointer/mousemove listeners
6. Disconnect ResizeObserver
7. Remove <canvas> from DOM
```

### Rapid Open/Close
- Gate `openCanvas` with `isClosing` flag to prevent spawning during exit animation
- `removeCanvas()` has 500ms setTimeout for return animation — do NOT spawn FluidPanel during this window
- Debounce: wait 550ms after close trigger before allowing new open

---

## 3) Frame Budget

### Reference Behavior
Continuous rAF with fixed 1/60s dt, idle preview animation (sine-wave pointer motion). Wasteful for panel use case.

### Proposed: Adaptive rAF
- On `pointermove`: set `needsRender = true`, schedule rAF
- When `pointer.idleTime > 300ms`: let decay frames finish (u_dissipation=0.97 already handles this), then `pause()`
- **Visibilitychange**: Pause rAF when `document.hidden === true`
- Resume on `visibilitychange` → visible + pointer still over panel

### Mobile GPU Reality
- Cap sim resolution: `Math.min(Math.ceil(viewWidth/2), Math.ceil(viewHeight/2), 256)`
- Use `devicePixelRatio` only for display canvas, NOT for sim FBOs
- **Pressure iterations**: Adaptive — 8 on touch devices, 16 on desktop
- **Dissipation rates**: Keep reference values (velocity=0.97, output=0.98) — they already decay nicely

---

## 4) Failure/Degradation Ladder

| Failure Point | Fallback Behavior |
|---------------|-------------------|
| `gl = canvas.getContext('webgl')` → null | Return no-op `{mount(){}, destroy(){}, setZoom(){}}`. Plain img visible, zero overhead. |
| `gl.getExtension('OES_texture_float')` unavailable | Same no-op fallback. |
| `webglcontextlost` event | Call `destroy()` + hide canvas. Plain img remains behind via z-index. |
| `webglcontextrestored` | Re-initialize FBOs/programs if panel still active. |
| Texture upload failure | Log error, continue with blank distortion field. (Should not happen for same-origin local images.) |

**Critical**: All fallbacks must be silent — no console errors visible to user, no broken panel behavior.

---

## 5) Integration API — Minimal Seam

### Proposed Interface
```javascript
// cardCanvasGL.js — after creating canvasView:
var fluidPanel = typeof FluidPanel !== 'undefined' 
    ? FluidPanel.mount(canvasView, img) 
    : null;

// In setZoomState():
if (fluidPanel) fluidPanel.setZoom(isZoomActive);

// In removeCanvas(), before existing.remove():
if (fluidPanel) { fluidPanel.destroy(); fluidPanel = null; }
```

### Why This Beats Alternatives
| Alternative | Problem |
|-------------|---------|
| Global singleton | Can't handle two stages simultaneously; unclear ownership |
| cardCanvasGL-internal | Couples unrelated concerns; increases code review surface |
| MutationObserver-wired | Fragile; depends on DOM structure stability; harder to test |
| **Explicit mount/destroy** (recommended) | Deterministic, traceable, testable, clean separation |

`setZoom(active)` tells fluid sim to disable input splats and stop rendering. Canvas hidden via `display: none` or render loop skip.

---

## 6) Sequencing Risks

### Script Tag Order
```html
<!-- fluidImage.js MUST load before cardCanvasGL.js -->
<script src="./js/fluidImage.js"></script>
<script src="./js/cardCanvasGL.js"></script>
```
Current line 878: `<script src="./js/cardCanvasGL.js"></script>`
Insert before it.

### Failure Mitigation
- **If fluidImage.js fails to load**: `FluidPanel` is undefined → cardCanvasGL.js must NOT throw
- **Mitigation**: `typeof FluidPanel !== 'undefined'` guard before mount call
- Graceful fallback to plain img behavior

### Shader Embedding
- Reference uses `<script type="x-shader/x-fragment">` DOM tags
- **Recommendation**: Inline shaders as JS template literals to avoid DOM dependency
- Shaders are static strings — no runtime generation needed

---

## Recommended Architecture (5 Lines)

**New file `js/fluidImage.js`** (IIFE, ~350 LOC) exposing `FluidPanel.mount(viewEl, imgEl) → {setZoom(active), destroy()}`. **Per-panel lifecycle** with explicit destroy (cancel rAF → lose context → delete GL objects → remove listeners). **Adaptive rAF**: runs only while pointer active + 300ms decay, pauses on visibility change. **Fails silently** to plain img if WebGL/OES_texture_float unavailable. **Loads before cardCanvasGL.js**; mount call wrapped in typeof-check.

---

## Key Implementation Details (For Engineer)

1. **Coordinate mapping**: Use `event.offsetX / rect.width` and `1 - event.offsetY / rect.height` (NOT pageX/pageY — reference assumed full-window canvas)
2. **Canvas z-index**: `position:absolute; inset:0; pointer-events:none; z-index:-1` inside `.canvas-opgl-view`, OR insert as first child so img floats above
3. **FBO resolution**: `Math.min(Math.ceil(viewWidth/2), Math.ceil(viewHeight/2), 256)` — combines scout's halving with my 256px cap
4. **ResizeObserver**: Over window.resize listener — handles panel resizing without global listeners. Disconnect on destroy.
5. **Shaders as JS strings**: Avoid DOM script tag injection for cleaner cleanup
6. **CSS overflow:hidden**: View has `border-radius:14px; overflow:hidden` — canvas must match view dimensions exactly to avoid distortion leakage
