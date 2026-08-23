# Round 2 Cross-Attack — Architect

**Date**: 2026-08-22
**Author**: architect
**Team**: opgl-fluid-hover-plan

---

## Executive Summary

My R1 findings hold on **destroy contract ordering**, **failure ladder design**, and **integration seam clarity**. Three positions require revision after peer feedback:

1. **Staggered activation** → REVERT to concurrent panels (spec allows two simultaneous)
2. **256px FBO cap** → REJECT (quality unacceptable for portfolio)
3. **550ms debounce** → REDUCE to 0ms (existing `is-canvas-open` gate is sufficient)

One position requires defense: **canvas/img mutual exclusivity** vs. **z-index layering**.

---

## Revisions (Conceded to Peer Evidence)

### R1. Staggered Activation → Concurrency Permitted

**Original claim**: "Only one FluidPanel alive at a time; `open()` destroys previous before mounting new."

**Peer evidence**: Scout correctly notes the spec states: *"There are TWO .opgl-stage instances on index.html; one panel per stage, but two panels could be open simultaneously."* Engineer and designer concur.

**Verdict**: **REVOKED.** Two concurrent WebGL contexts is well within browser limits (8-16). The staggered activation was an over-correction based on a misread of the constraint. Both panels may coexist.

**Revised stance**: Per-panel lifecycle with independent destruction. No cross-panel coordination needed. If user opens panel A then panel B without closing A, both remain active. Memory budget is not a concern at 2 contexts.

---

### R2. FBO Resolution Cap at 256px → REJECTED

**Original claim**: "`Math.min(Math.ceil(viewWidth/2), Math.ceil(viewHeight/2), 256)`"

**Peer evidence**: 
- Scout: "For a 600×500 panel, this gives a 256×213 FBO... visibly blocky distortion"
- Engineer: "4x fewer pixels than scout's recommended formula... visibly aliased flow fields... unacceptable for an art portfolio"
- Designer: "The 256px cap produces a blocky, pixelated distortion field... contradiction to 'artwork legibility guarantee'"

**Verdict**: **FULLY REJECTED.** For a portfolio site where artwork fidelity is paramount, a 256px cap produces unacceptable aliasing in the pressure solver and divergence/gradient steps.

**Revised formula**: Adopt engineer's reference-aligned approach with panel-aware scaling:
```js
var ratio = viewEl.clientWidth / viewEl.clientHeight;
var simW = Math.max(256 * ratio, Math.ceil(viewEl.clientWidth * 0.75));
var simH = Math.max(256, Math.ceil(viewEl.clientHeight * 0.75));
```
This gives ~450×375 for a 600×500 panel — adequate quality without retina over-rendering.

**Additional guard**: Cap at `Math.min(simW, 600)` and `Math.min(simH, 500)` to prevent oversized FBOs on large panels.

---

### R3. 550ms Debounce → ELIMINATED

**Original claim**: "Debounce: wait 550ms after close trigger before allowing new open."

**Peer evidence**:
- Scout: "550ms is imperceptibly slow... creates a jarring 'dead zone'"
- Designer: "A 550ms mandatory wait feels like friction... portfolio users interact in rapid succession"
- Engineer: "The rAF loop cancels in <1ms. No technical justification for this delay."

**Verdict**: **REMOVED.** The existing `is-canvas-open` class gate in `removeCanvas()` plus the 500ms card return animation already prevent double-open glitches. No additional debounce needed.

**Revised stance**: Remove all debounce logic. Rely on existing `isClosing` flag pattern if needed, but default to immediate reopen.

---

## Positions Requiring Defense

### D1. Canvas/Img Layering Strategy

**My original claim**: Canvas at `z-index: -1`, insert as first child of viewEl. Img floats above always.

**Peer positions**:
- Designer: "Mutually exclusive rendering paths" — hide canvas when zoom active
- Engineer: "REJECT. Follow designer's mutual exclusivity"

**My defense**:

The z-index layering approach has merit IF implemented correctly:

1. **Canvas is transparent** — the display shader outputs `vec4(img, opacity)` where opacity is derived from `get_img_frame_alpha()`. When no distortion is applied, the canvas renders the undistorted image identically to the `<img>` element.

2. **Pointer events** — canvas has `pointer-events: none`, so all mouse events target the `<img>`. The fluid sim receives events via a separate listener on the parent `.canvas-opgl-view`.

3. **Zoom mode** — when `isZoomActive` is true, the render loop skips rendering (no WebGL calls). The canvas remains in DOM but renders nothing. The `<img>` receives CSS `transform: scale(2.8)`. No visual conflict because canvas output is skipped entirely.

4. **Memory efficiency** — continuous rAF with a skip-check is cheaper than destroy/recreate cycles. The GL context persists; only the shader uniforms change.

**Counter-argument acknowledgment**: The designer raises a valid concern about "ghost distortion" in letterbox areas. However, this is mitigated by:
- The `get_img_frame_alpha()` function applies `smoothstep` fade at edges
- With 1.15× overscan (designer's recommendation), the fade zone is ~1.1px — imperceptible
- The canvas only renders when pointer is active (adaptive rAF)

**Compromise position**: Accept designer's mutual exclusivity for zoom mode (stop rendering when zoom active). For fluid mode, keep canvas behind img but ensure render loop skips when not needed. This avoids destroy/recreate overhead while preventing ghost artifacts.

---

### D2. Adaptive rAF vs. Continuous rAF

**My original claim**: "On pointer idle >300ms: let decay frames finish, then pause(). Resume on visibilitychange."

**Peer positions**:
- Engineer: "REJECT. Use continuous rAF with simple `isActive` gate"
- Scout: "Adding `requestIdleCallback` introduces non-deterministic scheduling"

**My defense**:

Continuous rAF wastes GPU when the panel is open but not hovered. For a portfolio site where users may leave panels open for extended periods, this is unnecessary power consumption.

The adaptive approach:
- Runs rAF only while pointer is over the panel
- Pauses after 300ms of idle (dissipation already decays to near-zero)
- Resumes on pointer re-entry or visibilitychange

**Revised stance**: Simplify to "rAF runs only while `pointerOver === true`". Remove the 300ms decay window — it's unnecessary complexity since the dissipation rates (.97/.98) already handle decay naturally. Just skip frames when not hovered.

---

### D3. Integration API: setZoom() vs. DOM Class Read

**My original claim**: `fluidPanel.setZoom(isZoomActive)`

**Engineer's counter**: "`isZoomActive` is declared as `var` inside the IIFE closure. It is not accessible from outside. The architect's proposed API requires exposing it."

**My defense**:

The engineer is correct about the scoping issue. My proposed API assumes `isZoomActive` is exposed or passed in. This is a design flaw.

**Revised API**: The fluid panel should read zoom state internally via DOM inspection:
```js
// Inside fluidImage.js, observe class changes:
var observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(m) {
    if (m.attributeName === 'class') {
      var isZoomed = viewEl.classList.contains('zoom-active');
      setActive(!isZoomed); // active when NOT zoomed
    }
  });
});
observer.observe(viewEl, { attributes: true });
```

This eliminates the external API dependency and works with the existing IIFE closure.

---

## Remaining Points of Contention

| Issue | My Position | Scout | Engineer | Designer | Path to Resolution |
|-------|-------------|-------|----------|----------|-------------------|
| Concurrent panels | Both alive (revised) | Both alive | Both alive | Not addressed | **CONSENSUS** |
| FBO resolution | 75% of panel, max 600×500 | Reference formula | Reference formula | Full res + DPR cap | **HYBRID** |
| Debounce | None (revised) | None | None | ≤200ms | **CONSENSUS** |
| Canvas/img layering | Behind img, skip render when zoom | Display:none (wrong) | Mutually exclusive (opacity toggle) | Mutually exclusive (display:none) | **COMPROMISE**: skip render in zoom, keep both in DOM |
| Adaptive rAF | Run only while hovered | Continuous | Continuous | Not specified | **ADAPTIVE** (my position) |
| Touch support | Mouse-only per requirements | Full touch | Full touch | Static only | **REQUIREMENTS SAY MOUSE-ONLY** |
| Shimmer hint | Not recommended | Unnecessary | Hard reject | Retracted | **NO SHIMMER** |
| Destroy order | rAF first, DOM last | rAF first | Vague ("dispose then delete") | Wrong order | **CONSENSUS ON ORDER** |

---

## Revised Architecture Summary (5 Lines)

**New file `js/fluidImage.js`** (IIFE, ~450 LOC) exposing `FluidPanel.mount(viewEl, imgEl)`. **Concurrent panels** permitted (2 WebGL contexts within budget). **FBO at 75% panel size**, capped at 600×500. **Adaptive rAF**: runs only while pointer hovered; skips frames otherwise. **Canvas behind img** with `pointer-events: none`; render loop skips when zoom-active (no destroy/recreate). **Destroy order**: rAF cancel → lose context → delete GL objects → remove listeners → disconnect ResizeObserver → remove canvas from DOM. **Touch**: mouse-only per requirements. **No shimmer**. **typeof guard** for load failure.

---

## Files to Create / Modify

1. **NEW: `js/fluidImage.js`** — IIFE, ~450 LOC. Shader sources as template literals. FluidPanel.mount()/destroy() API. Adaptive rAF with hover gate. Canvas injected as first child of viewEl (behind img). Reads zoom state via MutationObserver on class changes.

2. **MODIFY: `index.html`** — Insert `<script src="./js/fluidImage.js"></script>` BEFORE line 878 (`cardCanvasGL.js`).

3. **MODIFY: `js/cardCanvasGL.js`** — In `openCanvas()`, after creating `canvasView` and `img`:
   ```js
   var fluidPanel = typeof FluidPanel !== 'undefined' ? FluidPanel.mount(canvasView, img) : null;
   ```
   In `removeCanvas()`, before `existing.remove()`:
   ```js
   if (fluidPanel) { fluidPanel.destroy(); fluidPanel = null; }
   ```

4. **MODIFY: `main.css`** — Add:
   ```css
   .canvas-opgl-fluid-canvas {
     position: absolute;
     inset: 0;
     width: 100%;
     height: 100%;
     pointer-events: none;
     z-index: -1;
   }
   ```
