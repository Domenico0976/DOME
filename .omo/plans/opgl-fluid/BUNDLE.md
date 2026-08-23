# BUNDLE — Distilled Defensible Insights (Lead Synthesis)

**Source**: 3-round adversarial review (scout/unspecified-low, engineer/unspecified-high, architect/ultrabrain, designer/artistry). Files: r1-*, r2-*, r3-* in this directory.
**Note on degradation**: designer did not deliver r3-designer.md despite 3 nudges; its final positions are taken from r2-designer-attack.md (shimmer retraction, overscan/params retention) and resolved by consensus in the other three r3 docs.

---

## A. CONSENSUS DECISIONS (all members agree)

1. **New standalone file `js/fluidHover.js`** (IIFE, ES5 style, ~400–450 LOC), exposing `FluidHover.mount(viewEl, imgEl) → handle{destroy}`. Loaded via `<script>` BEFORE `cardCanvasGL.js`; call site guarded by `typeof FluidHover !== 'undefined'`.
2. **Integration seam inside cardCanvasGL.js** (we own and edit it): mount in `openCanvas()` right after `canvasView.appendChild(img)`; destroy in `removeCanvas()` before `existing.remove()`. Handle stored per-stage.
3. **NO GUI of any kind**: no lil-gui, no file input, no sine auto-preview animation, NO first-hover shimmer (violates "hover-only"; designer formally retracted).
4. **Effect gates**: active ONLY while pointer is over the expanded image AND zoom mode is OFF.
5. **Zoom gating mechanism**: fluid instance checks `viewEl.classList.contains('zoom-active')` internally each frame — no external setter API needed. On entering zoom: stop sim+display passes; on exiting: clear/freeze FBO state so no stale distortion pops (engineer S4 fix).
6. **Layering = opacity toggle, never display:none** (Safari WebGL context-loss risk): canvas inserted AFTER img inside `.canvas-opgl-view`, absolutely positioned `inset:0`, `pointer-events:none`. Normal mode: canvas opacity 1 / img opacity 0. Zoom mode: canvas opacity 0 / img opacity 1 (img keeps CSS transform scale 2.8). All new opacity rules gated behind a `.has-fluid` class added at mount so non-fluid fallback stays untouched.
7. **Coordinate mapping rewrite**: `rect = canvas.getBoundingClientRect()`; `x = clientX − rect.left; y = clientY − rect.top`; UV = `(x/canvas.width, 1 − y/canvas.height)`; `dx/dy = 6*(new−old)` as reference. Never offsetX/pageX.
8. **FBO resolution = reference formula**: `res.w = max(256*ratio, clientWidth); res.h = max(256, clientHeight)`. Architect's 256px cap REJECTED (blocky aliasing), his 75% heuristic REJECTED (arbitrary), designer's dpr-scaling REJECTED (contradicts panel-scale rationale). Explicitly set `canvas.width/height = viewEl.clientWidth/clientHeight` at mount and on resize.
9. **WebGL context attrs**: `{ alpha: true, premultipliedAlpha: false }` — light page background would show dark halo at edge fade with default premultiplication (engineer position, scout conceded).
10. **Capability ladder, all silent no-op fallbacks** (plain img remains): no webgl context → abort mount; missing OES_texture_float → abort; script load failure → typeof guard in cardCanvasGL.js; webglcontextlost → destroy + plain img.
11. **Texture timing**: if `img.complete && naturalWidth>0` upload immediately, else onload; wrap in `img.decode().then(upload).catch(upload)` when available (Safari 15–16 texImage2D fix; `.then()` is ES5-valid — scout concession C1).
12. **prefers-reduced-motion: reduce** → skip mounting entirely (no GL context created), static image only.
13. **rAF strategy**: continuous loop while mounted behind ONE gate (`isActive`): false when zoom-active OR document.hidden (visibilitychange listener — scout addition adopted), true otherwise. No idle detectors, no requestIdleCallback, no hover-only gating (architect simplified away). Splat only when `pointer.moved`.
14. **Destroy order (STRICT)**: cancelAnimationFrame → delete programs → delete textures → delete framebuffers → `WEBGL_lose_context.loseContext()` → remove listeners + disconnect ResizeObserver → `canvas.remove()` → null refs.
15. **Two concurrent panels allowed** (one per .opgl-stage; 2 contexts well within browser budget). Architect revoked single-instance staggered activation.
16. **No reopen debounce** (550ms rejected unanimously); existing `is-canvas-open` gate suffices.
17. **`canvas.style.willChange='auto'`** on the fluid canvas (avoid layer-promotion conflict with img's `will-change: transform`).

## B. CONSENSUS WITH PARAMETER SPREAD (decision needed, small)

18. **Shader tuning**: `scale_factor` 1.4 → **1.15** (artwork preservation at panel scale; unanimous after debate), `img_frame_width` .004 → **.006** (engineer/scout compromise over designer's .008).
19. **Effect params**: `cursorSize=3.5`, `distortionPower=0.2` (unanimous); `cursorPower`: designer 14 vs engineer compromise 16 vs scout defends 14 → **ship 14** (portfolio subtlety; 16 acceptable alternative).

## C. OPEN QUESTIONS FOR USER (flagged, not blocking plan)

20. **Touch behavior**: user said "hover" (mouse concept) but reference supports touchmove-drag distortion. Team consensus = implement touchmove (spirit: "effect while user interacts with expanded image"). If strict mouse-only is desired, drop one event listener. Plan implements touchmove by default.

## D. FILE TOUCH LIST

- NEW `js/fluidHover.js`
- MODIFY `js/cardCanvasGL.js` (mount/destroy seam + `.has-fluid` class)
- MODIFY `index.html` (script tag before cardCanvasGL.js, ~line 877)
- MODIFY `main.css` (`.canvas-opgl-fluid-canvas` styles + `.has-fluid` opacity rules, near line ~2674)

## E. VERIFICATION GATES (for planner to sequence)

1. Panel opens normally without fluidImage.js loaded (typeof guard) — no console errors, plain img shown.
2. Hover moves distort image locally; relaxation returns faithful undistorted image ≤2s after cursor stops.
3. Zoom ON: effect fully invisible/off (opacity swap correct, sim skipped, FBOs cleared on exit) and zoom pan/scale unaffected.
4. Zoom OFF: effect resumes cleanly, no stale frame flash.
5. Close panel: rAF stopped (CPU/GPU back to idle), GL objects freed, second open works immediately, both stages can be open simultaneously.
6. prefers-reduced-motion → no canvas injected at all.
7. Resize/orientation change while open → canvas + FBOs resize correctly.
