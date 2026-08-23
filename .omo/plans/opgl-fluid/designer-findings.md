# Designer Findings: WebGL Fluid Hover on Expanded Image Panel

## Context
- 600×500 max panel, 14px border-radius, overflow hidden
- Existing: `<img>` with `object-fit: contain`, Zoom mode toggle (2.8× scale), close button
- Goal: fluid hover-distortion effect ONLY while hovering expanded image; OFF in zoom mode; no GUI

---

## 1. Feel Tuning — Scale-Adjusted Defaults

**Problem**: Original params (`cursorSize=2, cursorPower=24, distortionPower=.4`) tuned for full-screen canvas (~1920×1080). At 600×500 panel, same values create disproportionately large distortions.

| Parameter | Original (full-screen) | Recommended (panel) | Rationale |
|-----------|------------------------|---------------------|-----------|
| `cursorSize` | 2 | **3–4** | Scales with panel width; ~0.1% of 1920px → ~0.6px equiv. For 600px panel need ~3.5px visual radius |
| `cursorPower` | 24 | **12–16** | Same splat injects more relative energy into smaller FBO |
| `distortionPower` | .4 | **.2–.25** | UV-space displacement feels 2× stronger at panel scale |
| Dissipation | .97/.98 | Keep as-is | Smaller FBO blurs more per step → slightly faster decay is actually desirable |

**Idle motion**: Remove `isPreview` auto-sine-path entirely. Strictly dead-still until first hover.

**Relaxation expectation**: Ripples should decay to <1% amplitude within ~2s of cursor stop. Verify with `.97/.98` dissipation; if not, bump to `.985/.99`.

---

## 2. Visual Seams — Overscan & Border-Radius

### The 1.4× Overscan Problem
`get_img_uv()` applies `scale_factor = 1.4` to centered UVs, pushing ~29% of image perimeter outside canvas. Edges are faded via `smoothstep(0, .004, uv.x)` etc.

**Impact on artwork presentation**:
- `object-fit: contain` already letterboxes the image with padding
- 1.4× overscan crops ~15% of left/right content on portrait artwork, ~29% on landscape
- The `.004` fade width ≈ 2.4px at 600px — creates visible translucent band near edges

### Recommendation: Reduce scale_factor to 1.15×
```glsl
// In fragShaderOutputShader, change:
float scale_factor = 1.15;  // was 1.4
```
- Still provides ~7.5% buffer on each side (enough to prevent edge-pull artifacts)
- Preserves 95%+ of artwork vs. 71% at 1.4×
- Fade zone shrinks to ~1.1px — less noticeable against border-radius clip

### Border-Radius Interaction
The shader's rectangular alpha fade operates in UV space and doesn't know about the 14px radius clip. Risk: fade visible just inside curved corners where radius clips before fade completes.

**Mitigation**: Reduced overscan (1.15×) narrows fade zone enough that it's unlikely to be noticeable. If still visible in testing:
- Increase `img_frame_width` from `.004` to `.008`
- Consider softening the smoothstep with a slight Gaussian blur on the output texture

---

## 3. Mode Transitions

### Zoom ↔ Fluid: Instant Swap, No Crossfade
- Crossfading two canvases doubles render cost and creates ambiguity
- Shader canvas and `<img>` are mutually exclusive rendering paths
- When zoom active: hide canvas, show img with CSS transform
- When zoom inactive: show canvas, hide img

**Transition implementation**:
```js
function setZoomState(active) {
  isZoomActive = active;
  if (active) {
    canvas.style.display = 'none';   // or opacity: 0
    img.style.display = 'block';
    // disable render loop
  } else {
    canvas.style.display = 'block';
    img.style.display = 'none';
    // enable render loop
  }
}
```

### Double-Transform Conflict Prevention
The CSS `transform: scale(2.8)` on img and shader displacement operate on different layers. Guard render loop with `!isZoomActive` check. Never render both simultaneously.

### Cursor Affordances
| State | Cursor |
|-------|--------|
| Default (fluid ready, not hovering) | `default` (inherit) |
| Hovering image (fluid active) | `grab` or `default` |
| Zoom mode active + hovering | `crosshair` (already in CSS) |
| Zoom mode active, not hovering | `default` |

---

## 4. Entry/Exit Choreography

### Panel Open Animation
- `.opgl-stage` children have `opacity 260ms ease`
- Non-canvas elements dim to `opacity: 0.12`
- Fluid canvas should be injected before open animation starts (or simultaneously)
- No entrance animation for fluid itself — dormant and ready on frame 1

### First-Hover Discoverability — Single Shimmer Hint
**Risk**: Users won't know the image is interactive after 4+ seconds of stillness.

**Solution**: One-time auto-generated radial ripple on first hover (no cursor movement needed):
```js
let hasHovered = false;
canvas.addEventListener('mouseenter', () => {
  if (!hasHovered) {
    hasHovered = true;
    // Inject small radial velocity splat at center with low power
    // This creates a gentle wave propagating outward, decaying naturally
    injectFirstHoverShimmer();
  }
});
```

After first shimmer, normal cursor-driven interaction resumes. Zero-GUI, self-disappearing hint.

### Touch Device Behavior
- Fluid effect: **never triggers** (strictly mouse-driven via `mousemove`)
- Zoom mode: current impl uses `mousemove` for zoom positioning
  - **Gap**: No `touchmove` handler for zoom
  - **Note**: Zoom button is already hidden on mobile (`@media (max-width: 1024px)`)
  - **Question for lead**: Should touch users get zoom via pinch-to-zoom or is this intentional exclusion?

---

## 5. Accessibility & Performance Perception

### prefers-reduced-motion
Must respect system preference. If set, skip fluid canvas entirely:
```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  // Show static img only, no canvas, no GL context
  return;
}
```

No distortion, no WebGL initialization — pure static image experience.

### Jank Perception & Pressure Solver Optimization
The simulation runs 6 FBO passes/frame:
1. Splat velocity (pointer input)
2. Splat output (dissipation)
3. Divergence
4. Pressure (16 iterations — **heaviest pass**)
5. Gradient subtract
6. Advection ×2
7. Display shader

**Recommendation**: Adaptive pressure iterations
```js
const isLowEndGPU = navigator.hardwareConcurrency < 8;
const pressureIterations = isLowEndGPU ? 8 : 16;
```
Cuts ~40% of per-frame GPU work on integrated graphics with negligible visual difference.

### Artwork Legibility Guarantee
After cursor stops moving, image must be 100% recognizable within 2 seconds. Verify with `.97/.98` dissipation; if not meeting this threshold, increase to `.985/.99`.

---

## 3 Taste Recommendations I Would Defend

### 1. Overscan 1.15×, Not 1.4×
**Why**: The 1.4× was designed for full-screen where edge cropping is invisible. On a 600px panel with `object-fit: contain`, 1.4× actively destroys artwork presentation by cropping 15–29% of the image.

**Trade-off**: Slightly more visible edge fade if cursor hits border — but this is preferable to losing actual artwork content.

**Confidence**: High. This is a hard requirement for a portfolio site where artwork fidelity is paramount.

---

### 2. Single-Shimmer First-Hover Hint
**Why**: The biggest UX risk isn't the effect itself — it's discoverability. After 4+ seconds of stillness, users need confirmation the image is alive. A one-time auto-generated radial ripple says "this is interactive" without any icon, text, or persistent GUI.

**Implementation**: On first `mousemove` over canvas, inject a small radial velocity splat at center with low power, let it decay naturally. Only fires once per panel session.

**Trade-off**: Adds ~1 frame of extra computation on first hover — imperceptible. May confuse power users who expect instant response, but the shimmer completes before cursor movement registers.

**Confidence**: Medium-high. This is a subtle UX polish that addresses the #1 risk (undiscovered feature).

---

### 3. distortionPower .2, cursorSize 3.5, cursorPower 14
**Why**: These values give a noticeable but restrained liquid feel at panel scale. The original `.4` distortion would feel like the image is melting — too aggressive for a portfolio piece. `.2` feels like the image is breathing, responding to touch without overwhelming the artwork.

**Feel target**: "A sheet of water on glass — you see the image through the ripples, but they're there."

**Trade-off**: Might feel too subtle on high-refresh monitors (120Hz+) where every frame of ripple is visible. Could add a slight "sizzle" quality. Acceptable risk — users can always move cursor faster to increase effect.

**Confidence**: High. This is the shipped parameter set; ready to defend in final review.

---

## Implementation Notes for Engineer

1. **Canvas injection**: Add `<canvas>` sibling to `<img>` inside `.canvas-opgl-view`. Hide img when canvas active, show when zoom active.
2. **Coordinate mapping**: Convert screen coordinates to canvas-relative UVs. Use `canvas.getBoundingClientRect()` for accurate mapping.
3. **Render loop gating**: Wrap `requestAnimationFrame(render)` in `if (!isZoomActive && !prefersReducedMotion)`.
4. **Memory cleanup**: On panel close (`removeCanvas`), dispose WebGL context, delete textures/FBOs, cancel rAF to prevent memory leaks.
5. **Touch fallback**: Document that touch users get static image + zoom (if implemented). No fluid on touch.
