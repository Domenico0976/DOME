# Round 2 Attack — Scout Findings

**Date**: 2026-08-22
**Author**: scout
**Team**: opgl-fluid-hover-plan
**Angle**: Pragmatic breadth — enumerate every plausible approach, expose contradictions, flag edge cases the others missed

---

## Targeted Attacks by Name

### 1. ATTACK ON ARCHITECT

**Claim attacked**: "Staggered activation — only one FluidPanel alive at a time" (section 2, Context Budget Risk)

**Why it's wrong**: This directly contradicts the project requirements. The spec explicitly states: *"There are TWO .opgl-stage instances on index.html; one panel per stage, but two panels could be open simultaneously."* A staggered-activation policy forces a user to close one panel before opening the other. That's a product regression, not an optimization. Two WebGL contexts is trivially within browser limits (8-16 concurrent). The architect's own table acknowledges both panels can coexist, then proposes a solution that prevents it. This is an internal contradiction that must be resolved by keeping both alive.

---

**Claim attacked**: "550ms debounce after close trigger before allowing new open" (section 2, Rapid Open/Close)

**Why it's wrong**: 550ms is imperceptibly slow for a UI interaction. The existing return-to-stack animation is 500ms — adding another 50ms of artificial delay on top means the user waits ~600ms total before they can re-open. This creates a jarring "dead zone" where clicking does nothing. The correct fix is the existing `is-canvas-open` class gate + `removeSelectedCard` animation, which already prevents double-open without any additional debounce. The architect invented a problem that didn't exist.

---

**Claim attacked**: "~350 LOC" estimate for js/fluidImage.js (section Recommended Architecture)

**Why it's wrong**: Counting the shaders (6 programs × ~20 lines each = 120 LOC), FBO management (~60 LOC), shader compilation (~40 LOC), pointer tracking (~30 LOC), render loop (~80 LOC), ResizeObserver (~20 LOC), lifecycle (~30 LOC) — this is closer to **450-500 LOC minimum**. The architect's estimate would mislead the engineer into thinking this is a "small" addition. Accuracy matters for code review planning.

---

**Claim attacked**: "Adaptive rAF with requestIdleCallback fallback" (section 3, Frame Budget)

**Why it's wrong**: `requestIdleCallback` is not available in all browsers targeted by this project (it requires a modern browser, no IE support needed but older Edge/Chrome versions may lack it). More importantly: the reference code uses a simple `requestAnimationFrame(render)` loop. Adding `requestIdleCallback` introduces a non-deterministic scheduling layer that complicates the render loop without measurable benefit. The fixed dt=1/60 is sufficient. Keep it simple. If battery is a concern, the `visibilitychange` pause (mentioned by designer) covers it.

---

**Claim attacked**: "FBO resolution: Math.min(Math.ceil(viewWidth/2), Math.ceil(viewHeight/2), 256)" (section Key Implementation Details, item 3)

**Why it's wrong**: This conflicts with the engineer's formula (`Math.max(256*ratio, clientWidth)` / `Math.max(256, clientHeight)`). The architect's formula caps at 256px regardless of panel size — for a 600×500 panel, this gives a 256×213 FBO. The engineer's formula gives ~512×427. The difference is significant: 256px sim resolution produces visibly blocky distortion on a 600px canvas. The engineer's approach is more appropriate. Both should converge on a middle ground: `Math.max(256 * ratio, Math.ceil(viewWidth * 0.75))` for a reasonable balance.

---

### 2. ATTACK ON ENGINEER

**Claim attacked**: "Set `premultipliedAlpha: false` when calling getContext" (section 6, Edge Cases)

**Why it's wrong**: `premultipliedAlpha` defaults to `true` in WebGL, but the display shader in the reference code already handles alpha correctly: `gl_FragColor = vec4(img, opacity)`. Setting `premultipliedAlpha: false` is a defensive overcorrection that could actually break the edge fade if the shader assumes premultiplication. The reference Codepen works fine with the default. This recommendation is unsourced speculation, not a demonstrated issue.

---

**Claim attacked**: "Call `await img.decode()` or check `img.complete && img.naturalWidth > 0` before `texImage2D`" (section 5, Texture Loading Timing)

**Why it's wrong**: `HTMLImageElement.decode()` is an async API that returns a Promise. This project is ES5 — no `async`/`await`, no module system. The engineer is proposing an API that cannot be used in this codebase without rewriting the entire JS style. The correct ES5 approach is the existing `image.onload` callback pattern from the reference code, which already handles timing correctly. The engineer's suggestion shows a style mismatch with the project.

---

**Claim attacked**: "FBO resolution formula preserved exactly as reference" (section 2, FBO/Sim Resolution)

**Why it's wrong**: The reference formula is:
```js
res.w = Math.max(256 * ratio, canvasEl.clientWidth);
res.h = Math.max(256, canvasEl.clientHeight);
```
This produces FBOs sized to the **canvas element's CSS pixel dimensions** (which are window-sized in the reference). For a 600×500 panel, `clientWidth` ≈ 600, `clientHeight` ≈ 500, giving res.w ≈ 600, res.h ≈ 500. But the engineer then says "Keep the reference formula exactly as-is" — which means the FBO would be 600×500, not the 512×427 the engineer claims. The formula and the example number don't match. This is a factual inconsistency that will confuse the implementer.

---

**Claim attacked**: "Cap at `dpr = 1.5` max" (section 6, Edge Cases — DevicePixelRatio)

**Why it's wrong**: The engineer recommends NOT using `devicePixelRatio` for FBO sizing (correct), but then suggests capping it at 1.5 for display canvas scaling (also correct). However, the engineer conflates two separate concerns: FBO resolution (simulation quality) and canvas display size (pixel density). The cap at 1.5 is arbitrary — why 1.5 and not 2.0? On a Retina MacBook, dpr=2.0 is standard. Capping at 1.5 would make the canvas look slightly soft on HiDPI screens. The simpler rule is: FBO at logical pixels (no dpr), canvas at logical pixels with CSS `width/height` set to CSS pixels. This avoids the question entirely.

---

### 3. ATTACK ON DESIGNER

**Claim attacked**: "Hide canvas, show img when zoom active" (section 3, Mode Transitions)

**Why it's wrong**: Hiding the canvas with `display: none` destroys the WebGL rendering context in some browsers (particularly Safari). When the user exits zoom mode and shows the canvas again, the GL context may need to be recreated, causing a visible flash. The architect's attack (C2) correctly identifies this. The fix is simpler than the designer suggests: keep both elements in DOM at all times, use `opacity: 0` on the canvas during zoom (or skip rendering when zoom is active). The canvas can remain invisible without being disconnected from GL.

---

**Claim attacked**: "Single-shimmer first-hover hint" (section 4, Entry/Exit Choreography)

**Why it's wrong**: The designer recommends this as a discoverability feature but provides no implementation details beyond a pseudocode snippet. The risk is real: a shimmer on first hover may confuse users who expect immediate response. More critically, the shimmer is an additional velocity splat that must be carefully tuned — if it's too strong, it distracts; if too weak, it's invisible. The designer marks confidence as "Medium-high" but offers no testing methodology. This is a feature creep that adds complexity without a clear success metric. A better approach: let the effect speak for itself. If users don't discover it after 10 seconds of hovering, that's a UX problem with the panel design, not the effect.

---

**Claim attacked**: "Touch devices get plain static image only, no fluid, no zoom" (section 4, Touch Device Behavior)

**Why it's wrong**: The designer states this as a gap but never resolves it. The existing zoom button is already hidden on mobile (`@media (max-width: 1024px)`). The requirement says "effect ONLY on hover" — hover doesn't exist on touch. But the designer should explicitly recommend whether touch users get: (a) no effect at all, (b) a tap-to-distort interaction, or (c) a permanent subtle distortion. The current "static only" position is a cop-out that leaves the lead with an unresolved decision. The engineer's touch support (mapping `targetTouches[0].pageX/pageY` to canvas coords) is actually more useful — it gives touch users the same experience with one hand.

---

**Claim attacked**: "Reduce scale_factor to 1.15×" (section 2, Visual Seams)

**Why it's wrong**: The designer provides a good argument for reducing overscan but misses a critical detail: the `scale_factor` in the shader is used for **both** the distortion buffer AND the image UV sampling. Reducing it to 1.15× means less buffer for the distortion field, which causes the distortion to "wrap around" at the edges of the visible area when the cursor is near the border. The original 1.4× was designed to give the velocity field enough room to decay naturally before hitting the edge. A 1.15× overscan on a 600px panel means the distortion buffer has only ~45px of padding — the velocity field doesn't have enough space to dissipate, causing edge artifacts. The fix isn't to reduce overscan; it's to increase the `img_frame_width` fade zone to match, OR to keep 1.4× but ensure the `smoothstep` fade is wide enough to hide the effect. The designer's recommendation would actually make edge artifacts MORE visible, not less.

---

## Summary of Contradictions Between Peers

| Issue | Architect | Engineer | Designer | Scout Verdict |
|-------|-----------|----------|----------|---------------|
| Simultaneous panels | Proposes staggered (contradicts spec) | Assumes both alive | Doesn't address | **Both must be alive** |
| FBO resolution | Cap at 256px | ~512×427 (formula mismatch) | Not specified | Engineer's magnitude, but formula needs fixing |
| Canvas visibility during zoom | Don't hide img | Not addressed | Hide canvas (breaks GL context) | **Keep both in DOM; skip render when zoom active** |
| Touch support | Not addressed | Full touch support | Static only (cop-out) | **Engineer's approach is correct** |
| Shimmer hint | Not addressed | Not addressed | Recommended | **Unnecessary feature creep** |
| Destroy order | Correct (rAF first) | Vague ("dispose then delete") | Wrong (vague ordering) | **Architect correct** |
| premultipliedAlpha | Not addressed | Recommend false (unsourced) | Not addressed | **Default is fine; skip** |
| Overscan 1.15× | Not addressed | Not addressed | Recommends | **Too aggressive; keeps 1.4× with wider fade** |

---

## Recommendations for Lead (Scout's Synthesis)

1. **Drop architect's staggered activation** — both panels must coexist per spec
2. **Drop engineer's `img.decode()` suggestion** — ES5 incompatibility
3. **Drop designer's canvas-hiding during zoom** — GL context destruction risk
4. **Drop designer's shimmer hint** — feature creep without success metric
5. **Keep architect's destroy order** (rAF first, DOM last) — correct
6. **Keep engineer's touch support** — consistent with requirement
7. **Keep designer's tuning params** (3.5/14/.2) — reasonable for panel scale
8. **Reject designer's 1.15× overscan** — 1.4× is correct; widen fade zone if needed
9. **Adopt a hybrid FBO formula**: `Math.max(256 * ratio, Math.ceil(viewWidth * 0.7))` — balances quality and performance
10. **Add a `prefers-reduced-motion` gate** — agreed by all, must be implemented
