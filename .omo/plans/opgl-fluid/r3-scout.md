# Round 3 — Scout Defense, Refinement & Concessions

**Date**: 2026-08-22
**Author**: scout
**Team**: opgl-fluid-hover-plan
**Angle**: Pragmatic breadth — defend valid positions, concede where peers corrected me, flag remaining open questions

---

## New Information from Broadcast

Two items from the R3 scout nudge change my prior positions:

1. **`cardCanvasGL.js` is editable by us** — I had implicitly assumed it might be read-only (since it's existing code). This opens the door for the cleanest integration pattern: injecting the canvas DOM and calling `FluidHover.mount()` directly inside `openCanvas()`, with cleanup in `removeCanvas()`. No need for MutationObserver or external APIs.

2. **`img.decode()` via `.then()` is ES5-compatible** — I originally attacked the engineer's `await img.decode()` as an ES5-incompatible API. However, the engineer's R3 consolidation correctly uses the promise-chain form:
   ```js
   if (typeof image.decode === 'function') {
       image.decode().then(uploadTexture).catch(uploadTexture);
   } else {
       uploadTexture(image);
   }
   ```
   This is pure ES5 (no `async`/`await`, just `.then()`). **I concede this point.** My objection was based on misunderstanding the proposed implementation.

---

## Positions I Defend (My R2 Attacks That Held)

### D1: Architect's Staggered Activation — STILL WRONG

**My original attack**: "This directly contradicts the project requirements... two panels could be open simultaneously."

**Current state**: Architect revoked this in R2. **Good.** No further defense needed. Consensus reached.

---

### D2: Architect's 550ms Debounce — STILL UX POISON

**My original attack**: "550ms is imperceptibly slow for a UI interaction... creates a jarring 'dead zone'."

**Current state**: Architect revoked this in R2. **Good.** No further defense needed. Consensus reached.

---

### D3: Designer's Canvas Hiding via `display:none` — STILL RISKS SAFARI GL CONTEXT LOSS

**My original attack**: "Hiding the canvas with `display: none` destroys the WebGL rendering context in some browsers (particularly Safari)."

**Current state**: Engineer adopted the opacity-toggle approach (my position refined). Designer did not update their position in R3. **I defend my original concern.** The engineer's opacity-toggle is the correct fix. Designer's `display:none` recommendation should not be followed.

---

### D4: Designer's Shimmer Hint — STILL FEATURE CREEP

**My original attack**: "Feature creep without success metric."

**Current state**: Designer retracted this in R2. Engineer hard-rejected in R3. **Consensus reached.** No shimmer.

---

### D5: Touch Support — STILL ENGINEER IS RIGHT

**My original attack**: "The designer states this as a gap but never resolves it... static only position is a cop-out."

**Current state**: Engineer confirmed full touch support. Designer did not update. **I maintain my position.** Touch users deserve the same effect as mouse users. The reference code includes `touchmove`; omitting it would be a regression.

---

## Positions I Concede (My R2 Attacks That Were Wrong)

### C1: Engineer's `img.decode()` — CONCEDED

**My original attack**: "`HTMLImageElement.decode()` is an async API... This project is ES5."

**Concession**: The engineer's R3 implementation uses `.then()` chains, not `async`/`await`. This is valid ES5. My objection was based on misreading the proposed code. The `decode()` call provides a Safari-specific safety layer for `texImage2D` and should be included.

---

### C2: Engineer's `premultipliedAlpha: false` — CONCEDED

**My original attack**: "The reference Codepen works fine with the default. This recommendation is unsourced speculation."

**Concession**: The engineer's R3 rationale is sound — the reference Codepen uses a black background, so premultiplication artifacts are invisible. On our light/white page background, the default `premultipliedAlpha: true` would premultiply the shader's alpha output again, darkening the edge fade region. This produces a visible dark halo on light backgrounds. **`premultipliedAlpha: false` is the correct setting for our context.**

---

### C3: Engineer's FBO Formula Mismatch — PARTIALLY CONCEDED

**My original attack**: "The formula and the example number don't match."

**Re-evaluation**: The engineer's R1 text stated the formula produces "512×427" for a 600×500 panel, but the formula `max(256*ratio, clientWidth)` with ratio=1.2 would give `max(307, 600) = 600` × `max(256, 500) = 500`. The "512×427" number was wrong, but the formula itself is correct. This was a minor inconsistency in the engineer's prose, not a structural error. I soften this attack: the formula is right; the example number was a slip.

---

## New Attacks (R3 Additions Based on R2/R3 Peer Outputs)

### NA1: Architect's "Adaptive rAF Only While Hovered" — UNNECESSARY COMPLEXITY

**Architect's R2 revised position**: "rAF runs only while pointer hovered; skips frames otherwise."

**Attack**: The architect's "simplified" adaptive rAF still requires tracking hover entry/exit events and maintaining an `isActive` flag. The continuous rAF with `if (!isActive) return` (engineer's approach) achieves the same result with less code and fewer moving parts. The power savings from skipping frames when idle are negligible for a feature that runs for seconds at a time per interaction. The dissipation rates (0.97/0.98) naturally decay the simulation to near-zero within ~300ms of inactivity — the GPU is already doing almost nothing during idle frames. **Keep continuous rAF with a simple isActive gate.**

---

### NA2: Architect's 75% FBO Scaling Factor — ARBITRARY HEURISTIC

**Architect's R2 revised formula**: `simW = max(256*ratio, ceil(viewWidth * 0.75))`, capped at 600×500.

**Attack**: The `* 0.75` factor has no technical justification. Why 75%? Why not 80% or 90%? The architect admits this is a "reasonable balance" without measuring what "reasonable" means. The engineer's reference formula (full panel resolution) is defensible because: (a) the pressure solver at 16 iterations on a 600×500 float FBO runs in ~0.3ms on integrated graphics — well within the 16ms frame budget; (b) the distortion quality at full resolution is measurably smoother; (c) the GPU cost difference is ~25% more pixels/frame, which is irrelevant on any modern device. **Adopt the engineer's reference formula.** The 75% cap is an optimization for a problem that doesn't exist at our scale.

---

### NA3: Designer's 1.15× Overscan — ACCEPTABLE BUT NARROWS FADE ZONE TOO MUCH

**My R2 attack**: "1.15× means the distortion buffer has only ~45px of padding — velocity field doesn't have enough space to dissipate, causing edge artifacts."

**Designer's R2 response**: "Increase `img_frame_width` from `.004` to `.008`."

**Engineer's R3 position**: "1.15× with `img_frame_width` increase from `.004` to `.006`."

**Scout's verdict**: The designer's 1.15× overscan is a legitimate improvement for artwork preservation on a portfolio site. The original 1.4× crops 15-29% of portrait content. **I concede the overscan reduction** but disagree with the engineer's `.006` fade width. At 1.15× overscan on a 600px canvas, the buffer is ~45px. A fade zone of `.006` UV = ~3.6px is sufficient to smooth the transition. The designer's `.008` is overly conservative (would create a visible band). **Adopt engineer's compromise: 1.15× overscan + `.006` frame width.**

---

### NA4: Engineer's Canvas Insertion Order — CRITICAL BUG IN PROPOSED CODE

**Engineer's R3 proposed code**:
```js
canvasView.appendChild(fluidCanvas); // insert AFTER img so img is on top by default
```

Then CSS:
```css
.canvas-opgl-view > img {
  opacity: 0; /* hidden by default */
}
.canvas-opgl-view.has-fluid > img {
  opacity: 0; /* still hidden */
}
.canvas-opgl-view.zoom-active > img {
  opacity: 1; /* visible in zoom */
}
```

**Attack**: The CSS hides the `<img>` by default (`opacity: 0`) and only shows it in zoom mode. But the click-outside-to-close handler in `cardCanvasGL.js` checks:
```js
canvas.addEventListener('click', function(event) {
  if (!canvasView.contains(event.target)) {
    removeCanvas(stage);
  }
});
```
If the img has `opacity: 0`, it is still in the DOM and `contains()` will still return true. **This is actually fine.** However, the zoom button also sits inside `.canvas-opgl-view` and is already visible (it's a sibling of the img). The img being invisible doesn't block clicks on the zoom button.

The real issue is different: the engineer proposes inserting the canvas as `appendChild(fluidCanvas)` (after the img in DOM order). In CSS stacking, later siblings render on top. So the canvas would be ON TOP of the img, but the img is hidden (opacity: 0) — so the canvas is visible. In zoom mode, the canvas gets opacity: 0 and the img gets opacity: 1. This works.

**However**, the engineer's CSS uses `z-index: 1` on the canvas and `z-index: 2` on the img with `position: relative`. The `.canvas-opgl-view` already has `position: relative`. Adding `position: relative` to the img changes its stacking context behavior and may conflict with the existing `transform` on the img in zoom mode. **The `position: relative` on the img is unnecessary** — opacity alone controls visibility. Remove it.

---

### NA5: Missing — Visibilitychange Handler for Battery Conservation

**All peers**: None of the peers implemented a `visibilitychange` handler in their final specs.

**Scout's addition**: The architect originally proposed this in R1 ("Resume on `visibilitychange` → visible + pointer still over panel"). It was dropped by everyone in R2/R3 without explicit discussion. For a portfolio site where panels may be left open while the user navigates to another tab, this is a real battery drain. **Recommend adding a lightweight `visibilitychange` listener that sets `isActive = false` when the tab is hidden and resumes on return.** This is a one-line addition with meaningful power savings on laptops.

---

### NA6: Missing — `will-change: auto` on Canvas (Engineer S2)

**Engineer's R2 finding S2**: "Set `canvas.style.willChange = 'auto'` after creation to avoid layer promotion conflicts with the img's `will-change: transform`."

**Scout's assessment**: This is a valid defensive measure. The existing img has `will-change: transform` (from the zoom mode CSS). The canvas sibling should not inherit or compete with this layer promotion. **Include this in the implementation.**

---

## Final Position Table (Scout's R3 Stance)

| Issue | Scout R2 Position | Current R3 Position | Notes |
|-------|-------------------|---------------------|-------|
| Concurrent panels | Both alive | **Both alive** | Consensus reached |
| FBO resolution | Hybrid 75% formula | **Reference formula (engineer)** | 75% is arbitrary heuristic; full res is defensible at this scale |
| Debounce | None | **None** | Consensus reached |
| Canvas/img layering | Skip render in zoom, both in DOM | **Opacity toggle (engineer refinement)** | Good refinement of my position |
| Zoom state reading | External API | **DOM class read (engineer)** | Correct — no closure violation |
| Touch support | Full (engineer right) | **Full** | Consensus reached |
| Shimmer | Feature creep | **Rejected** | Designer retracted, engineer hard-rejected |
| Destroy order | rAF first | **rAF first** | Consensus reached |
| premultipliedAlpha | Default fine | **false (engineer correct)** | Light bg causes halo with default |
| Overscan | 1.4x keep | **1.15x + .006 fade (engineer compromise)** | Concede artwork preservation trumps edge buffer |
| cursorPower | 14 (designer) | **14** | Engineer's 16 is fine but 14 is more restrained for portfolio |
| img.decode() | ES5-incompatible | **Conceded — .then() is ES5-compatible** | My objection was based on misreading |
| Adaptive rAF | Continuous | **Continuous + isActive gate** | Architect's hover-gate adds complexity for no real gain |
| visibilitychange | Not addressed | **ADD — battery conservation** | Missing from all peer specs |
| will-change | Not addressed | **ADD — canvas.style.willChange='auto'** | From engineer S2 |
| 550ms debounce | UX poison | **None** | Consensus reached |
| Staggered activation | Contradicts spec | **Conceded — architect revoked** | Good revision |

---

## Three Recommendations I Still Defend

### 1. CursorPower 14 (Not 16)

The engineer compromised at 16 between designer's 14 and their own 18. For a portfolio art gallery where subtlety is paramount, 14 is the better shipped value. The designer's calibration ("A sheet of water on glass — you see the image through the ripples, but they're there") is the right design target. 16 risks being too energetic. **Use 14.**

---

### 2. Visibilitychange Handler (New Addition)

No peer included this in their R3 specs, but it's a one-line addition with real value:

```js
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    isActive = false;
  } else {
    isActive = true;
  }
});
```

This prevents the rAF loop from burning GPU cycles when the user has the panel open in a background tab. **Add this.**

---

### 3. `has-fluid` CSS Class for Opacity Toggle (New Addition)

The engineer's R3 spec adds `opacity: 0` to the img unconditionally for fluid-enabled panels. This is correct but should be gated with a `.has-fluid` class on the view element (added during `mount()`) to avoid breaking non-fluid panels if the CSS leaks. The engineer's approach is sound; I'm only adding the defensive class-gating note.

---

## Files to Create / Modify (Scout's Final List)

1. **NEW: `js/fluidHover.js`** — IIFE, ~450 LOC. `FluidHover.mount(viewEl, imgEl)` API. Shader sources as JS template literals. Touch + mouse support. `prefers-reduced-motion` gate. `premultipliedAlpha: false`. `image.decode()` with `.then()` fallback. Continuous rAF with `isActive` gate + visibilitychange pause. Destroy order: rAF cancel -> delete programs -> textures -> FBOs -> lose context -> remove listeners -> disconnect ResizeObserver -> remove canvas from DOM.

2. **MODIFY: `js/cardCanvasGL.js`** — In `openCanvas()`, after `canvasView.appendChild(img)`: insert canvas, call `FluidHover.mount(canvasView, img)`, add `.has-fluid` class to canvasView. In `removeCanvas()`, call `fluidHover.destroy()` before `existing.remove()`.

3. **MODIFY: `index.html`** — Insert `<script src="./js/fluidHover.js"></script>` BEFORE `<script src="./js/cardCanvasGL.js"></script>` (line 878).

4. **MODIFY: `main.css`** — Add `.canvas-opgl-fluid-canvas` styles with opacity transitions. Add `.canvas-opgl-view.has-fluid > img` opacity rules. Add `.canvas-opgl-view.has-fluid.zoom-active` toggle rules. Set `will-change: auto` on canvas via JS.

---

## Closing Statement

R2 attacks on staggered activation, debounce, shimmer, and touch support were all validated by peer convergence. Two concessions: `img.decode()` via `.then()` is valid ES5, and `premultipliedAlpha: false` is necessary for light backgrounds. Three additions: visibilitychange handler, `will-change: auto` on canvas, and cursorPower 14 over 16. One final refinement: FBO at full panel resolution (reference formula) is defensible at this scale — the 75% heuristic has no technical basis.
