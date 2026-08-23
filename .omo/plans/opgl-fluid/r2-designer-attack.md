# Cross-Attack: Designer Critique of Scout & Architect Findings

**Author**: designer  
**Team**: opgl-fluid-hover-plan  
**Round**: 2 Cross-Attack

---

## Overview

I've reviewed the findings from scout (peer messages) and architect (`r1-architect.md`). While both offer strong technical foundations, I identify **5 contradictions and UX risks** that must be resolved before implementation begins. As the UX/motion quality specialist, my critique focuses on feel, seamlessness, and user perception — areas where engineering-optimized decisions may degrade the experience.

---

## Conflict 1: Canvas Z-Index Strategy (CRITICAL UX RISK)

### The Contradiction

| Source | Approach | Canvas Mode |
|--------|----------|-------------|
| **Architect** | Canvas `z-index: -1`, insert as first child; img floats above always | Both always visible; canvas rendered behind img |
| **Scout (Approach A)** | `display: none` / `display: block` swap | Only one visible at a time |
| **My Findings (designer-findings.md)** | Mutually exclusive: hide canvas + show img in zoom mode | Only one visible at a time |

### The UX Problem with Architect's Approach

Architect's proposal — canvas at `z-index: -1` with both always visible — creates a **dual-render problem**:

1. **Zoom mode visual clash**: When zoom activates, the fluid canvas remains rendered beneath the `<img>`. The img has `object-fit: contain` with transparent letterbox areas. In those areas, the distorted canvas bleeds through, creating a **"ghost distortion" artifact** under the undistorted image. This is visually confusing — the user sees a distorted image AND a sharp image simultaneously.

2. **Zoom cursor conflict**: With both elements in the DOM and canvas at `z-index: -1`, mouse events on the image target the img element, but the canvas beneath still receives pointer input (canvas has its own listeners). If canvas has `pointer-events: none`, fine — but then the canvas isn't receiving hover to render, defeating the purpose. If canvas has `pointer-events: auto`, it intercepts events from the image.

3. **Memory waste**: Canvas renders continuously even when zoom is active (since `display: block` never toggles). Every frame, the WebGL pipeline processes velocity advection and pressure solves while the result is invisible behind the img. This violates the user's explicit requirement: "while zoom mode is ACTIVE the effect must be OFF."

### My Position

**Keep mutual exclusivity** (scout + designer agreement): when zoom active, canvas must be completely disabled — not just visually occluded. This means:
- `canvas.style.display = 'none'` AND stop rAF (or gate render loop with `!isZoomActive`)
- Show img with `display: block` + `transform: scale(2.8)`
- When zoom deactivated: reverse the process

**Recommended fix to architect**: Change z-index strategy to use `display:none` toggling per mode, with canvas hidden entirely during zoom (not just behind img at -1 z-index).

---

## Conflict 2: FBO Resolution Cap (PERFORMANCE vs. QUALITY)

### The Contradiction

| Source | FBO Resolution Formula |
|--------|----------------------|
| **Architect** | `Math.min(Math.ceil(viewWidth/2), Math.ceil(viewHeight/2), 256)` — capped at 256px |
| **Engineer (from scout summary)** | Reference formula: `max(256*ratio, clientWidth)` — scales with display |
| **My implicit expectation** | Full panel resolution for crisp edge rendering |

### The UX Problem

The 256px cap produces a **blocky, pixelated distortion field**. Here's why this matters for our use case:

- Panel is **600×500 max** (at most ~300×250 at typical viewports with padding)
- At 256px FBO cap: a 600×500 panel renders at **~256×213 FBO** → **0.43× magnification** of the simulation grid
- The fluid simulation's divergence/pressure/advection passes operate on this low-res grid
- Result: distortion appears **chunky and aliased**, especially near edges where the 1.15× overscan fade zone (1.1px at full res) becomes **~2.5px at FBO cap** — a visible translucent band

This directly contradicts my **"artwork legibility guarantee"** — the distortion must relax to a faithful, undistorted image. If the FBO is too coarse, the relaxation appears to snap into place rather than smooth out.

### My Position

**Resolution should match display size, with a generous upper cap**:
```js
// Recommended FBO resolution
const simW = Math.min(Math.ceil(viewWidth * dpr), 600);  // panel max width
const simH = Math.min(Math.ceil(viewHeight * dpr), 500); // panel max height
```

- On retina displays (dpr=2): 1200×1000 FBO — overkill for a 600px panel, but smooth
- On standard displays (dpr=1): 600×500 FBO — crisp edge rendering
- **Cap at 600×500** to prevent unnecessary GPU load on large screens

**Trade-off**: ~2× GPU cost on retina vs. 256px cap. Mitigated by:
- Adaptive pressure iterations (8 vs 16) — agree with architect here
- Adaptive rAF (only render while pointer active) — agree with architect here

**Architect, your 256px cap is too conservative for a portfolio piece.** The distortion quality is the entire reason this feature exists — undersolving the FBO defeats the purpose.

---

## Conflict 3: First-Hover Shimmer (CONFLICTS WITH HOVER-ONLY REQUIREMENT)

### The Issue

In my designer-findings.md, I recommended a **"single-shimmer first-hover hint"** — an auto-generated radial ripple on first `mouseenter` to signal interactivity.

**This directly conflicts with the user's explicit requirement**:

> "effect ONLY while hovering the expanded image"

### Why the Shimmer Is Problematic

1. **Self-violating the spec**: The shimmer fires on `mouseenter` with NO cursor movement — it's an automatic animation, not a hover response. After 4+ seconds of stillness, a ripple appears "by itself," violating the hover-only contract.

2. **Unpredictable timing**: If the user hovers for 3 seconds, looks away, then hovers again, should it shimmer again? Per my spec, no (once-per-session). But this creates inconsistent behavior — sometimes the effect is inert for a long time, sometimes it "wakes up" suddenly.

3. **Confusion risk**: Users may interpret the shimmer as a bug ("why is the image moving on its own?") rather than a hint. In a portfolio context, unexpected motion without interaction is more likely to alarm than delight.

4. **Touch conflict**: On touch devices, there is no hover. The shimmer would fire on `touchstart` (if adapted), creating motion without explicit user intent.

### My Position — RETRACTED

**I retract the single-shimmer recommendation.** It was intended as a discoverability aid but conflicts with the hard requirement of hover-only activation. Better alternatives:
- Leave discoverability to natural exploration (cursor over image → subtle drag → effect activates)
- Rely on the panel's visual language (the already-soft, interactive feel of the bento-grid site)
- If needed, add a tooltip on first panel open (but this adds GUI, which the user forbade)

**Scout, your pitfall list is correct** — the shimmer is an unnecessary risk. I'll drop this from my final recommendations.

---

## Conflict 4: 550ms Debounce on Panel Reopen (UX FRICTION)

### The Issue

Architect proposes:

> "Debouncing: wait 550ms after close trigger before allowing new open"

With a 500ms return animation + 50ms buffer.

### The UX Problem

Portfolio users interact with images in **rapid succession** — click thumbnail → view → close → click another thumbnail. A 550ms mandatory wait feels like **friction**, not protection.

- Users closing and reopening the same panel (to re-examine details) would hit the debounce and feel the UI is "stuck"
- The 500ms return animation is a card-level CSS transition (`.image-squ.is-returning-to-stack`), not a panel-level animation — the panel close (`removeCanvas`) is synchronous and doesn't have a 500ms exit animation
- The debounce conflates two separate concerns: card return animation and panel teardown

### My Position

**550ms is excessive.** Recommend:
- Allow immediate reopen after `removeCanvas()` completes (no debounce)
- If card return animation causes visual glitch, reduce debounce to **100ms** (enough for DOM cleanup, not enough for user to notice)
- The `isClosing` flag approach is sound, but the duration should be **≤ 200ms**, not 550ms

---

## Conflict 5: Parameter Spec Divergence (SCOUT vs. DESIGNER)

### The Contradiction

| Parameter | Scout's Reference Values | My Recommended Values | Delta |
|-----------|--------------------------|----------------------|-------|
| `cursorSize` | 2 (reference default) | **3.5** | +75% |
| `cursorPower` | 24 (reference default) | **14** | -42% |
| `distortionPower` | .4 (reference default) | **.2** | -50% |

### My Defense

These aren't arbitrary differences — they're **scale-calibrated adjustments** for the 600×500 panel vs. the full-screen reference.

1. **cursorSize 3.5** (vs 2): The reference value is 2px on a ~1920px screen (0.1% of width). For a 600px panel, 0.1% of width = 0.6px — far too small to be visible. Scaling linearly: 2 × (600/1920) = 0.625. But we want a *visible* cursor radius, so 3.5px gives ~0.6% of panel width — visible without being obtrusive.

2. **cursorPower 14** (vs 24): The reference injects 24 units of output color splat. At 600px FBO resolution, this creates a displacement of ~24×distortionPower UV units. With distortionPower=.2, that's 4.8 UV units of displacement — far too much. Reducing to 14 brings it to ~2.8 UV units, which feels proportional.

3. **distortionPower .2** (vs .4): Same logic — the displacement magnitude must scale with panel size. .4 on a 600px panel is "melting" territory; .2 is "water on glass."

**Scout, your pitfall #1 (parameter tuning) correctly identifies this risk.** My values are the calibrated solution. Please adopt these as the shipped defaults.

---

## Additional Observations

### Architect: Staggered Activation vs. Dual Panels

Architect states:
> "Two simultaneous panels × 6 programs × multiple FBOs = 12+ contexts if both stay open"

This is a **false calculation**. Each FluidPanel creates:
- 1 WebGL context (shared across all programs)
- 4 FBO doubles (outputColor, velocity, pressure) + 1 single FBO (divergence)
- 6 shader programs (shared GL programs, not contexts)

Two panels = 2 WebGL contexts, ~12 FBOs total. Modern browsers support 8-16 concurrent WebGL contexts. This is **not a resource budget risk** — it's a non-issue at our scale. The "staggered activation" constraint is unnecessary and limits the user's ability to compare two images side-by-side.

### Scout: Pitfall #3 (Coordinate Mapping) — AGREED

Scout correctly flags that `pageX/pageY` from the reference won't work for a panel-embedded canvas. My coordinate mapping recommendation (`canvas.getBoundingClientRect()` → normalized UVs) resolves this. Engineer must implement this correctly — it's the #1 source of off-cursor distortion bugs.

### Scout: Pitfall #6 (Canvas Resizing) — ADDENDUM

Scout recommends ResizeObserver on the view. My addition: the canvas must resize **in sync with the img** when the panel opens (since the img's rendered size depends on `object-fit: contain` within the 600×500 constraint). ResizeObserver on `.canvas-opgl-view` is correct, but also observe `.canvas-opgl-view img`'s `naturalWidth/naturalHeight` to set the correct FBO aspect ratio on first open.

---

## Summary of Changes to My Position

| Recommendation | Status | Reason |
|---------------|--------|--------|
| Scale factor 1.15× | **Retain** | Hard requirement for artwork preservation |
| Params: .2 / 3.5 / 14 | **Retain** | Scale-calibrated; necessary for panel feel |
| Single-shimmer hint | **RETRACTED** | Violates hover-only requirement |
| Instant mode swap (no crossfade) | **Retain** | Cleaner UX, no double-transform conflict |
| prefers-reduced-motion gate | **Retain** | Accessibility requirement |
| Mutual exclusivity (display:none toggle) | **Retain** | Prevents ghost distortion in zoom mode |

---

## Three Taste Recommendations I Now Defend (Post-Correction)

1. **Overscan 1.15×, not 1.4×** — unchanged. Critical for artwork fidelity.

2. **Mutually exclusive canvas/img rendering** — unchanged. The architect's z-index: -1 approach creates ghost distortion artifacts in zoom mode. Display toggling is the clean solution.

3. **distortionPower .2, cursorSize 3.5, cursorPower 14** — unchanged. These are the shipped defaults. Scout's pitfall #1 is correct; my calibrated values are the fix.
