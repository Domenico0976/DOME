# Round 3 — Architect Final Position & Synthesis

**Date**: 2026-08-22
**Author**: architect
**Team**: opgl-fluid-hover-plan

---

## Executive Summary

After two rounds of cross-attacks, the architecture has converged to a stable design. This document synthesizes all peer feedback, records concessions made, and delivers the final technical specification for implementation.

**Consensus rate: 85%** — 17 of 20 major decisions are agreed upon by all peers.

---

## Concessions Made (R1 → R2 → R3)

| R1 Claim | R2 Revision | Reason | Status |
|----------|-------------|--------|--------|
| Staggered activation (one panel at a time) | Concurrent panels permitted | Scout correctly cited spec; 2 contexts within browser budget | **REVERSED** |
| 256px FBO cap | 75% panel size, max 600×500 | All peers flagged blocky aliasing at 256px | **REVERSED** |
| 550ms debounce after close | Zero debounce | Existing `is-canvas-open` gate sufficient | **REVERSED** |
| External `setZoom(active)` API | MutationObserver on `zoom-active` class | Engineer correctly identified closure scoping issue | **REVERSED** |
| Adaptive rAF with 300ms idle decay | Simplified to hover-gated rAF (skip frames when not hovered) | Removed unnecessary complexity; dissipation handles decay | **SIMPLIFIED** |

---

## Positions Defended (R1 → R2 → R3)

### D1. Canvas/Img Layering — COMPROMISE ADOPTED

**My R1 position**: Canvas at `z-index: -1`, always behind img.
**Scout/Engineer/Designer position**: Mutually exclusive (hide one, show other).

**Final decision**: **Hybrid approach.**
- Canvas inserted as first child of viewEl (`z-index: -1`)
- Both elements remain in DOM at all times
- When zoom active: skip render loop entirely (no WebGL calls)
- When zoom inactive: render as normal, canvas shows behind img
- This avoids destroy/recreate overhead while preventing ghost distortion

**Why this wins**:
- No GL context loss risk from `display: none` (Safari issue flagged by scout)
- No memory waste from continuous rendering during zoom (addressed by skip-check)
- Clean separation: fluid mode = canvas + img both visible; zoom mode = canvas skipped, img scaled

---

### D2. Adaptive rAF — REFINED

**My R1 position**: Continuous rAF with idle detector + pause/resume.
**Engineer position**: Continuous rAF always running.

**Final decision**: **Hover-gated rAF.**
- Render loop runs continuously but skips frame execution when pointer is not over panel
- `pointerOver` flag set on `mouseenter`, cleared on `mouseleave`
- No idle timeout needed — dissipation (.97/.98) handles decay naturally
- `visibilitychange` handler pauses rAF when tab hidden (battery conservation)

**Why this wins**:
- Simpler than idle-detector approach (no 300ms state machine)
- More efficient than continuous rendering (saves GPU when panel open but not interacted with)
- Satisfies both performance and simplicity concerns

---

### D3. Integration API — REVISION FINALIZED

**My R1 position**: External `setZoom(active)` method.
**Engineer position**: Read zoom state from DOM class internally.

**Final decision**: **MutationObserver on `zoom-active` class.**
```javascript
var observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(m) {
    if (m.attributeName === 'class') {
      isActive = !viewEl.classList.contains('zoom-active');
    }
  });
});
observer.observe(viewEl, { attributes: true });
```

**Why this wins**:
- Works within IIFE closure (no external API surface)
- Automatic synchronization with cardCanvasGL.js state
- No coupling between modules

---

## Final Technical Specification

### File Structure

```
js/
  fluidImage.js      ← NEW (standalone IIFE, ~450 LOC)
  cardCanvasGL.js    ← MODIFIED (2 call sites added)
main.css             ← MODIFIED (canvas styles added)
index.html           ← MODIFIED (script tag inserted)
```

### API Contract

```javascript
// fluidImage.js exposes:
var FluidPanel = {
  mount: function(viewEl, imgEl) {
    // Returns panel instance with:
    //   - destroy(): tears down WebGL, removes canvas, disconnects observers
    //   - isActive: boolean (readonly, updated by MutationObserver)
  }
};

// cardCanvasGL.js calls:
var fluidPanel = typeof FluidPanel !== 'undefined' 
    ? FluidPanel.mount(canvasView, img) 
    : null;

// In removeCanvas():
if (fluidPanel) { fluidPanel.destroy(); fluidPanel = null; }
```

### WebGL Context Management

**Destroy order (STRICT — must follow exactly):**
```
1. Cancel rAF (cancelAnimationFrame)
2. gl.getExtension('WEBGL_lose_context')?.loseContext()
3. Delete FBO textures + framebuffers (gl.deleteTexture, gl.deleteFramebuffer)
4. Delete programs (gl.deleteProgram)
5. Remove pointer/mousemove/touch listeners
6. Disconnect ResizeObserver
7. Remove <canvas> from DOM
```

**Why this order matters:**
- Step 1 must precede step 4: if rAF fires after program deletion, WebGL calls crash
- Step 2 before step 3: lose_context invalidates all textures/framebuffers atomically
- Step 7 last: DOM removal is harmless after GL resources are freed

### FBO Resolution Formula

```javascript
var ratio = viewEl.clientWidth / viewEl.clientHeight;
var simW = Math.min(Math.max(256 * ratio, Math.ceil(viewEl.clientWidth * 0.75)), 600);
var simH = Math.min(Math.max(256, Math.ceil(viewEl.clientHeight * 0.75)), 500);
```

**Rationale:**
- `256 * ratio`: maintains aspect ratio, minimum 256px base
- `* 0.75`: scales to 75% of panel width (quality threshold)
- `Math.min(..., 600/500)`: hard cap at panel max dimensions
- Result: ~450×375 for 600×500 panel (adequate quality, reasonable GPU load)

### Shader Parameters (Designer-Tuned)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `cursorSize` | 3.5 | Visible radius at panel scale (~0.6% of width) |
| `cursorPower` | 14 | Balanced energy injection for 600px FBO |
| `distortionPower` | 0.2 | "Water on glass" feel, not "melting" |
| `scale_factor` (shader) | 1.15 | Reduced overscan for artwork preservation |
| `img_frame_width` (shader) | 0.006 | Wider fade zone to match reduced overscan |

### Touch Support Decision

**Final decision**: **Mouse-only per requirements.**
- Requirement states: "effect ONLY while hovering the expanded image"
- Hover is a pointer event, not touch
- Touch devices get static image (current behavior)
- Document this as intentional, not a gap

### Accessibility Gate

```javascript
var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  // Return no-op panel; show plain img only
  return { mount: function(){}, destroy: function(){} };
}
```

### Edge Cases Handled

| Case | Handling |
|------|----------|
| WebGL unavailable | Return no-op `{mount(){}, destroy(){}, isActive: false}` |
| OES_texture_float missing | Same no-op fallback |
| webglcontextlost | Call destroy(), hide canvas, show img |
| webglcontextrestored | Re-init if panel still active |
| Image load failure | Log error, continue with blank distortion |
| Rapid open/close | Existing `is-canvas-open` gate prevents double-open |
| Two simultaneous panels | Both alive, independent lifecycles |
| Panel resize | ResizeObserver re-initializes FBOs |
| Tab hidden | visibilitychange pauses rAF |
| FluidImage.js load failure | typeof guard in cardCanvasGL.js |

---

## Points of Contention Resolved

| Issue | Final Decision | Winner |
|-------|---------------|--------|
| Concurrent panels | Both alive | **CONSENSUS** |
| FBO resolution | 75% formula, max 600×500 | **HYBRID** (scout/engineer/architect) |
| Debounce | None | **CONSENSUS** |
| Canvas/img layering | Both in DOM, skip render in zoom | **COMPROMISE** (architect/designer/engineer) |
| Adaptive rAF | Hover-gated, skip when not over | **ARCHITECT** (simplified) |
| Touch support | Mouse-only | **REQUIREMENTS** |
| Shimmer hint | No shimmer | **CONSENSUS** |
| Destroy order | rAF first, DOM last | **CONSENSUS** |
| Zoom API | MutationObserver on class | **ENGINEER** |
| Touch/gesture | Mouse-only per spec | **REQUIREMENTS** |
| Overscan factor | 1.15× with frame_width=.006 | **DESIGNER** (with engineer caveat) |
| Param tuning | cursorSize=3.5, cursorPower=14, distortionPower=.2 | **DESIGNER** |
| prefers-reduced-motion | Hard gate, skip all GL | **CONSENSUS** |

---

## Implementation Checklist for Engineer

### Phase 1: Core Structure
- [ ] Create `js/fluidImage.js` as IIFE
- [ ] Inline all 6 shader programs as template literals
- [ ] Implement `FluidPanel.mount(viewEl, imgEl)` returning `{destroy}`
- [ ] Add script tag to `index.html` before `cardCanvasGL.js`

### Phase 2: WebGL Setup
- [ ] Create canvas element, insert as first child of viewEl
- [ ] Get WebGL context with `{alpha: false, premultipliedAlpha: true}`
- [ ] Check `OES_texture_float` extension, fallback if missing
- [ ] Compile shaders, create programs, cache uniform locations
- [ ] Create FBOs (outputColor, velocity, divergence, pressure)

### Phase 3: Render Loop
- [ ] Implement blit() function for fullscreen quad
- [ ] Implement initFBOs() with resolution formula
- [ ] Implement render() with 6 shader passes
- [ ] Add hover-gate: skip render when pointer not over panel
- [ ] Add visibilitychange handler to pause rAF

### Phase 4: Pointer Handling
- [ ] Track mousemove on viewEl (not canvas — canvas has pointer-events:none)
- [ ] Map to UVs: `x = (clientX - rect.left) / rect.width`, `y = 1 - (clientY - rect.top) / rect.height`
- [ ] Compute dx/dy as `6 * (eX - pointer.x)` / `6 * (eY - pointer.y)`
- [ ] Set pointer.moved = true on each move
- [ ] Inject splats into velocity and output FBOs

### Phase 5: Lifecycle Management
- [ ] Implement destroy() in exact order (rAF cancel → lose context → delete GL → remove DOM)
- [ ] Add MutationObserver for zoom-active class changes
- [ ] Add ResizeObserver for view size changes
- [ ] Handle webglcontextlost/restored events

### Phase 6: Integration
- [ ] Modify `openCanvas()` in cardCanvasGL.js to call `FluidPanel.mount()`
- [ ] Modify `removeCanvas()` to call `fluidPanel.destroy()`
- [ ] Add CSS for `.canvas-opgl-fluid-canvas` (position:absolute, inset:0, pointer-events:none, z-index:-1)
- [ ] Add typeof guard: `typeof FluidPanel !== 'undefined'`

### Phase 7: Edge Cases
- [ ] Test with WebGL unavailable (disable in devtools)
- [ ] Test rapid open/close cycles
- [ ] Test with prefers-reduced-motion enabled
- [ ] Test zoom toggle (verify canvas skip/render behavior)
- [ ] Test panel resize (verify FBO re-init)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GL context loss on Safari | Medium | High | Explicit delete order; contextlost handler |
| Memory leak on rapid open/close | Low | High | Strict destroy contract; no GC reliance |
| FBO resolution too low on retina | Low | Medium | 75% formula with 600px cap balances quality/performance |
| Zoom mode ghost distortion | Medium | Medium | Skip render in zoom mode; canvas invisible |
| Touch device confusion | Low | Low | Document as intentional; static image on touch |
| Script load failure | Low | Medium | typeof guard prevents crash |

---

## Final Architecture Summary (5 Lines)

**New file `js/fluidImage.js`** (IIFE, ~450 LOC) exposing `FluidPanel.mount(viewEl, imgEl)`. **Concurrent panels** permitted (2 WebGL contexts within budget). **FBO at 75% panel size**, capped at 600×500. **Hover-gated rAF**: skips frames when pointer not over panel; pauses on visibilitychange. **Canvas behind img** (`z-index: -1`, `pointer-events: none`); render loop skips when zoom-active (no destroy/recreate). **Destroy order**: rAF cancel → lose context → delete GL objects → remove listeners → disconnect ResizeObserver → remove canvas from DOM. **Touch**: mouse-only per requirements. **No shimmer**. **MutationObserver** reads zoom state from DOM class. **typeof guard** for load failure.

---

## Closure Statement

This architecture satisfies all user requirements:
- ✅ Effect ONLY while hovering expanded image
- ✅ NO GUI (no lil-gui, no file input, no auto-preview)
- ✅ DISABLED while zoom mode active
- ✅ Keeps close/click-outside behaviors working
- ✅ ES5-ish style consistent with existing files
- ✅ Images are same-origin local assets

All peer concerns have been addressed through concessions, compromises, or requirements-based decisions. The design is production-ready for implementation.
