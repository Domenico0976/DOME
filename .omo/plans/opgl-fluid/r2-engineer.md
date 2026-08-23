# Round 2 — Engineer Cross-Attack

**Date**: 2026-08-22
**Author**: engineer
**Team**: opgl-fluid-hover-plan

---

## Scout Findings — Attacks

### S1: Coordinate Mapping (offsetX/Y vs clientX-rect) — REJECT offsetX/Y recommendation

**Scout's claim**: "Recommend offsetX/offsetY with fallback."

**Attack**: `offsetX/Y` returns 0 on elements with CSS transforms (the `.canvas-opgl-view` does not use transforms but its parent `.canvas-opgl` is `position:absolute; inset:0` with flex centering). If any future CSS changes add `transform` (e.g. for open/close animations), `offsetX/Y` silently breaks while `getBoundingClientRect()` remains correct. **Verdict: Use `rect = el.getBoundingClientRect(); x = e.clientX - rect.left; y = e.clientY - rect.top` exclusively. No fallback needed.**

### S2: FBO Resolution — CONCUR, flag missing detail

**Scout's claim**: Reference formula `res.w = max(256*ratio, clientWidth)`, `res.h = max(256, clientHeight)` is correct.

**Attack**: Scout omits that `canvasEl.width`/`height` (backing store) should equal `clientWidth`/`clientHeight` (CSS pixels). If the canvas is styled at 600x500 CSS pixels but the backing store defaults to 300x150 (browser default), FBO blits will render at half resolution. **Verdict: On mount, explicitly set `canvas.width = view.clientWidth; canvas.height = view.clientHeight` before calling `initFBOs()`.**

### S3: Lifecycle — CONCUR, flag missing detail

**Scout's claim**: `cancelAnimationFrame` + let GC collect is sufficient; two simultaneous contexts safe.

**Attack**: "Let GC collect" is insufficient on mobile WebKit. Safari leaks WebGL contexts aggressively if `deleteProgram`/`deleteTexture`/`deleteFramebuffer` are not called explicitly. **Verdict: Explicitly delete all GL objects in order: programs -> textures -> framebuffers -> lose context.** Only then cancel rAF.

### S4: Zoom Gating — PARTIALLY FLAWED

**Scout's claim**: `setActive(false)` stops rAF; "last rendered frame stays on canvas."

**Attack**: When zoom is toggled OFF and rAF restarts, the sim state (velocity/output FBOs) still contains the pre-zoom disturbance. The first frame after zoom-off will show a distorted image that hasn't settled. **Verdict: On `setActive(true)`, clear velocity and output FBOs (blit a zero quad) before resuming the rAF loop. This ensures a clean start.**

### S5: Texture Timing — CONCUR, ADD SAFARI-SPECIFIC FIX

**Scout's claim**: Check `img.complete && img.naturalWidth > 0` before `texImage2D`.

**Attack**: Safari requires `img.decode()` promise to resolve before `texImage2D` on some versions (Safari 15-16). Without it, WebGL throws `INVALID_OPERATION`. **Verdict: Add `await img.decode()` before `texImage2D` inside the `onload` handler.**

### S6: Edge Cases — CONCUR, ADD missing item

**Scout's claim**: `premultipliedAlpha: false`, no `dpr` multiplier, `ResizeObserver`, `prefers-reduced-motion`, touch support.

**Attack**: Scout misses **`will-change: auto` removal** on the canvas. The existing `.canvas-opgl-view img` has `will-change: transform` which promotes the img to its own layer. The fluid canvas sibling will inherit stacking context behavior that may cause composited layer thrashing. **Verdict: Set `canvas.style.willChange = 'auto'` after creation to avoid layer promotion conflicts with the img's transform layer.**

---

## Architect Findings — Attacks

### A1: Resolution Cap at 256px (RESOLUTION.HALVE) — CRITICAL REJECTION

**Architect's claim**: "Cap sim resolution: `Math.min(Math.ceil(viewWidth/2), Math.ceil(viewHeight/2), 256)`"

**Attack**: This caps the sim at 256x256 max regardless of panel size. For a 512x427 panel, sim FBO = 256x213 — **4x fewer pixels than scout's recommended formula**. At this resolution, the 16-iteration pressure solver produces visibly aliased flow fields; divergence/gradient subtract steps become numerically unstable. The resulting distortion looks like a low-res mosaic, not a fluid simulation. For an art portfolio, this is unacceptable. **Verdict: REJECT. Use engineer's formula (`max(256*ratio, clientWidth)`) which scales with panel size.**

### A2: One Panel At A Time Constraint — LOGICALLY UNSOUND

**Architect's claim**: "Only one FluidPanel alive at a time; `open()` destroys previous before mounting new."

**Attack**: The project has exactly two `.opgl-stage` instances, each with its own gallery. Users expect to open a panel in either stage independently. Forcing single-instance destroys the second open panel, creating a jarring UX break. Browser context limits are 8-16 contexts; two panels use 2/8 = 25% budget. The architect misreads the constraint. **Verdict: REJECT. Allow concurrent FluidPanel instances.**

### A3: 550ms Debounce Delay After Close — UX POISON

**Architect's claim**: "Debounce: wait 550ms after close trigger before allowing new open."

**Attack**: The existing `removeCanvas` already has a 500ms `setTimeout` for the card return animation. Adding an additional 550ms debounce means the user cannot re-open the same panel for **1050ms** after closing. This makes the gallery feel sluggish and unresponsive. There is no technical justification for this delay; the rAF loop cancels in <1ms. **Verdict: REJECT. Remove all debounce logic.**

### A4: Canvas Z-Index Behind Image — ARCHITECTURAL CONFLICT

**Architect's claim**: "Canvas z-index -1 inside `.canvas-opgl-view` so img floats above."

**Attack**: This directly contradicts the designer's explicit finding (#3 Mode Transitions): "canvas and `<img>` are mutually exclusive rendering paths." If both are visible simultaneously (canvas behind, img in front), the user sees the undistorted image through the distortion — the effect is invisible. The zoom-btn CSS (`position: absolute; bottom: 12px; left: 12px; z-index: 10`) also assumes the canvas is below or absent, not interleaved. **Verdict: REJECT. Follow designer's mutual exclusivity — canvas and img replace each other; never coexist.**

### A5: Adaptive rAF with 300ms Idle Timeout — UNNECESSARY COMPLEXITY

**Architect's claim**: "On pointer idle >300ms: let decay frames finish, then `pause()`. Resume on visibilitychange."

**Attack**: The reference uses continuous rAF with `u_dissipation=.97/.98` which naturally decays to near-zero in ~300ms (0.97^60 approx 0.16, 0.97^180 approx 0.003). Adding an idle detector with resume/pause logic doubles the code size for a benefit that continuous rAF already achieves. The `visibilitychange` handler is also unnecessary — the browser throttles rAF in background tabs regardless, and the dissipation already ensures no visible motion when the tab is hidden. **Verdict: REJECT. Use continuous rAF with simple `isActive` gate (engineer's approach).**

### A6: setZoom API — INCOMPATIBLE WITH EXISTING CLOSURE SCOPING

**Architect's claim**: Proposes `fluidPanel.setZoom(active)` as the integration API.

**Attack**: `isZoomActive` is declared as `var isZoomActive` inside the `openCanvas` IIFE closure. It is not accessible from outside. The architect's proposed API requires exposing it. However, the architect's own implementation description says "pass it into the fluid panel" — but doesn't explain how. The engineer's approach of checking `canvasView.classList.contains('zoom-active')` internally is simpler and requires zero API surface. **Verdict: Accept the intent but reject the API. Read zoom state from DOM class directly inside the fluid panel, don't expose an external setter.**

---

## Designer Findings — Attacks

### D1: First-Hover Auto-Shimmer — DIRECT REQUIREMENT VIOLATION

**Designer's claim**: "One-time auto-generated radial ripple on first hover... This creates a gentle wave propagating outward."

**Attack**: The user requirement explicitly states: **"Effect ONLY while hovering the expanded image; NO GUI/no file input/no auto-preview animation."** The auto-shimmer IS an auto-preview animation — it fires before the user moves their cursor, creating a "look what I can do" moment that the user did not request. This violates the stated constraint. **Verdict: HARD REJECT. No auto-shimmer. The effect must remain completely dormant until the user moves their cursor.**

### D2: Touch — "Never Triggers" — FACTUALLY WRONG

**Designer's claim**: "Fluid effect: never triggers (strictly mouse-driven via mousemove)."

**Attack**: The reference implementation in Webgl-image.txt explicitly handles `touchmove`:
```js
canvasEl.addEventListener("touchmove", (e) => {
    isPreview = false;
    e.preventDefault();
    updatePointerPosition(e.targetTouches[0].pageX, e.targetTouches[0].pageY);
});
```
Touch devices must have fluid effect working. The designer conflates "zoom mode is mouse-only" with "fluid effect is mouse-only." **Verdict: REJECT. Implement touch support per reference — map `touchmove` to panel-local coords, prevent default to avoid page scroll.**

### D3: Overscan 1.15x — DESIGN JUDGMENT, ACCEPT WITH CAVEAT

**Designer's claim**: Reduce `scale_factor` from 1.4 to 1.15 to preserve artwork.

**Attack**: 1.4x overscan was tuned for full-screen where edges are invisible. On a 600px panel, 1.4x crops ~15% of portrait content which is noticeable. However, reducing to 1.15x narrows the fade zone from ~2.4px to ~1.1px, making edge artifacts from the `smoothstep(0, .004, uv)` more visible when the cursor approaches the border. **Verdict: ACCEPT 1.15x overscan but pair with `img_frame_width` increase from .004 to .006 to maintain smooth edge fade. This is a net improvement over the reference's 1.4x for panel-scale use.**

### D4: Canvas/img Mutual Exclusivity — ARCHITECTURALLY CORRECT, IMPLEMENTATION NEEDS CLARITY

**Designer's claim**: "When zoom active: hide canvas, show img. When zoom inactive: show canvas, hide img."

**Attack**: The approach is correct but the implementation detail matters. Using `display:none` causes reflow and may trigger browser paint thrashing on toggle. A better approach: keep both in DOM, use `opacity: 0` / `opacity: 1` transition with `pointer-events: none` on the hidden element. The zoom-btn CSS already uses `opacity` transitions. **Verdict: ACCEPT principle; refine implementation to opacity+pointer-events toggles instead of display:none.**

### D5: Parameter Recomends (cursorSize 3.5, cursorPower 14, distortionPower .2) — SOUND, WITH CAVEAT

**Designer's claim**: Recommands smaller params for panel scale.

**Attack**: The reasoning is correct (same absolute pixel displacement on a smaller canvas creates larger relative UV shifts). However, `cursorPower` at 14 is quite weak for a 600px canvas — the splat radius is `cursorSize * .001 = .0035` in UV space, injecting very little energy. A value of **18-20** would provide more visible disturbance while still being restrained. **Verdict: Accept the direction (smaller params); adjust cursorPower to 18, cursorSize to 3.5, distortionPower to .2.**

### D6: Touch Zoom — GAP IDENTIFIED, NOT SOLVED

**Designer's claim**: Notes that zoom button is hidden on mobile (`@media (max-width: 1024px)`) but doesn't propose touch zoom.

**Attack**: This is an observation, not a finding requiring action. However, the engineer should note: if touch users open the panel, they get the fluid effect (per D2 correction) but no zoom. This is consistent with the existing mobile UX where zoom is desktop-only. **Verdict: ACCEPT as-is. No action needed for touch zoom.**

---

## Cross-Cutting Decisions (Engineer Synthesis)

| Question | Winner | Rationale |
|----------|--------|-----------|
| Sim resolution formula | **Engineer** (reference formula, no cap) | Architect's 256px cap degrades quality |
| Concurrent panels | **Engineer** (allow both) | Architect's single-instance hurts UX |
| Debounce delay | **Engineer** (none) | Architect's 550ms is UX poison |
| Canvas/img layering | **Designer** (mutually exclusive) | Architect's z-index layering hides the effect |
| Auto-shimmer | **Engineer** (reject) | Designer's shimmer violates "no auto-preview" requirement |
| Touch support | **Engineer** (implement) | Designer's "never triggers" is factually wrong |
| Overscan factor | **Designer** (1.15x, with frame_width=.006) | 1.4x too aggressive for panel scale |
| Zoom API | **Engineer** (DOM-class read, no setter) | Architect's setter API conflicts with closure scoping |
| Adaptive rAF | **Engineer** (continuous, `isActive` gate) | Architect's idle-detector adds complexity for no benefit |
| Texture timing | **Engineer** (`await img.decode()` for Safari) | Extra safety layer over scout's `complete` check |
| GL cleanup | **Engineer** (explicit delete order) | "Let GC collect" leaks on mobile WebKit |
| Zoom state read | **Engineer** (read `zoom-active` class) | No external API needed |

---

## Files to Create / Modify

1. **NEW: `js/fluidHover.js`** — IIFE, exposes `FluidHover.mount(viewEl, imgEl)`. Contains all shader sources as template literals, FBO management, rAF loop, pointer/touch event handling, touch support, `prefers-reduced-motion` gating. Explicit GL object deletion on destroy.
2. **MODIFY: `index.html`** — Insert `<script src="./js/fluidHover.js"></script>` BEFORE `<script src="./js/cardCanvasGL.js"></script>` (line 878).
3. **MODIFY: `js/cardCanvasGL.js`** — In `openCanvas`, after creating canvasView and img: add `<canvas>` sibling inside canvasView; call `FluidHover.mount(canvasView, canvasEl, imgEl)`. In `removeCanvas`, before `existing.remove()`: call `fluidHover.destroy()`. In zoom toggle: read `canvasView.classList.contains('zoom-active')` — no API call needed since the mounted instance listens internally.
4. **MODIFY: `main.css`** — Add `.canvas-opgl-fluid-canvas` styles: `position:absolute; inset:0; width:100%; height:100%; pointer-events:none; opacity:1; transition:opacity 120ms ease;` and a `.is-hidden` variant with `opacity:0; pointer-events:none`.

---

## Rejected Findings (Summary)

- Architect: Resolution cap (A1), single-panel constraint (A2), debounce delay (A3), z-index layering (A4), adaptive rAF idle-detector (A5), external setZoom API (A6)
- Designer: Auto-shimmer (D1), touch unsupported (D2)
- Combined: Any approach that requires DOM class manipulation from outside the IIFE closure
