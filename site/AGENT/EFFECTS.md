# EFFECTS — Effect Reference

## §GENERAL RULE — Desktop vs Mobile Effect Usage

### Desktop
- All WebGL effects are **always active** when the cursor is within range
- Effects are driven by `cursorRef.current` (desktop pointer position)
- ArchiveHoverCanvas, PendulumCanvas, FeaturedGallery, SelectedProjects all read from the same cursor source

### Mobile
- **All mobile effects must behave IDENTICALLY to desktop** — same shaders, same transitions, same distortion
- The ONLY difference: mobile effects are driven by the mobile cursor position (`cursorRef.current` updated via touch events)
- When the user has NOT opened the canvas, effects respond to cursor movement only (no touch-to-drag distortion unless over the canvas)
- ArchiveHoverCanvas in MobileCanvas receives `glLockRef` to prevent GL churn during resize drag
- When the mobile canvas opens from a tap, it renders the SAME effect as the
  source section (`canvasState.effectType`): `featured-ripple` reuses the
  FeaturedGallery ripple shader (with the card's `alignX/alignY`),
  `tile-reveal` reuses the SelectedProjects tile shader with `uReveal: 1`
  (already revealed, no entry sweep), `archive-wind` keeps ArchiveHoverCanvas.
  Hover inside the open canvas is position-based (cursor inside the box).

### 🚨 Hard rule — mobile effect gating (machine-enforced since 2026-09-30)
**A tap on touch fires `mouseenter`.** Any hover/click effect gated on
`onMouseEnter` therefore pops on a bare tap, with no drag behind it.

- **Desktop**: `onMouseEnter` / `onMouseLeave` is the correct gate.
- **Mobile**: the gate is the **mobile cursor** — read it through
  `useCursorGate()`, never by touching the drag flags directly.

**This rule is no longer a convention, it fails the build.**
`tests/structure/effectGate.structure.test.js` scans `src/**` for WebGL/canvas
surfaces and rejects two things:

1. a surface that takes cursor input without going through `useCursorGate`
2. **any** file that reads `isCursorActiveRef` / `isDraggingRef` / `isDragging`
   at all, unless it is one of three roles that legitimately own the drag:
   the provider (`useArchiveCursor.js`), the sanctioned reader
   (`useCursorGate.js`), and the cursor's own drag implementation
   (`ArchiveCursor.jsx`)

The old advice in this file — "gate on `isDragging` or `isCursorActiveRef`" —
is exactly what test 2 now rejects. Do not follow it.

**Use `isAwake`, not `isCursorActive`.** They are not synonyms:
`isCursorActiveRef` means "a drag is happening right now" and is cleared on
`pointerup`, so a parked cursor would stop steering the instant the finger
lifted. `isAwake` means "the cursor is parked and still steering", which is the
behaviour the parked cursor exists to provide. It also falls asleep on its own
after 4s, so a forgotten cursor stops driving effects.

```js
// rAF / event callbacks — the ref form, no re-render:
const { isTouch, isAwake, parked, isOver } = useCursorGate()

// when the value decides what to RENDER, use the state form:
const awake = useAwakeState()
```

Reference implementation: `FocusCalloutShader.jsx`.

**A surface that cannot gate itself must be added to the test's `EXEMPT` set
with a stated reason.** Two entries are prop-driven (`ArchiveHoverCanvas`,
`MobileSectionCanvas` receive an already-gated cursor as a prop) and the hero is
exempt by product decision. Adding an entry is deliberate: a third test fails if
an exempt path no longer exists, so the list cannot silently outlive its code.

### Cursor Archive on Mobile
- `useArchiveCursor` provides `cursorRef` and `setCursor(x, y)` as the unified cursor writer
- Mobile touch events update `cursorRef` through `updateCursor()` or `setCursor()`
- When canvas is open, effects follow cursor position exactly like desktop
- When canvas is closed, effects are inactive (no distortion from passive touch)

---

## Cross-Link Index
- **[AGENTS.md](./AGENTS.md)** — Work protocol, testing procedures, rules
- **[NOTES.md](./NOTES.md)** — Non-WebGL logic changelog
- **[NOTES_WEBGL.md](./NOTES_WEBGL.md)** — WebGL shader fixes and changes

---

Two families of effects live in this project. This file is the single source of
truth for how they work, their timings/easings, and the rules for porting them
to other components. Supersedes the scattered notes (NOTES_WEBGL.md covers the
early hero research; SHADER_DEBUG_ALIGNMENT.md the gallery shader debugging).

---

## 1. TEXT EFFECTS — Title pixel/tiles (project-row hover)

**File:** `src/components/SelectedProjects.jsx` → `ProjectRow`
**Surface:** 2D canvas (`<canvas class="pr-name__canvas">`, text-sized, clipped
by the title wrapper's `overflow: hidden`). **No WebGL contexts are created for
this effect.**

### How it works

On row hover the title runs a synchronized two-layer exchange, then the canvas
becomes the title itself:

1. **Wave** (per character, `power3.inOut`, shared by both layers so the pair
   stays locked): the base glyph travels down and out of the clip window
   (y: 0 → line height) while its clone descends from above into the exact
   same slot. The DOM clone never renders — **the canvas draws the clone as a
   mosaic of 7px tiles**, and each tile inherits its character's animated Y
   every frame (per-char proxy objects tweened by the same GSAP timeline as
   the base chars). The pixel effect is therefore on the incoming text from
   frame zero — no handoff, no flash.
2. **Interactive phase** (whole row hover): the tile field is a spring system.
   Tiles near the cursor are pushed away by a light force; springs integrate
   velocity, so pursuit and return are fluid and organic. On canvas exit
   (pointer leaves the text but stays on the row) the springs carry every tile
   home and the layer stays alive for the next pass.
3. **Reverse exchange** (row leave): the pixel clone climbs back up through
   the clip window (proxies → −line height) while the base characters return
   into the line (y → 0, opacity → 1), staggered. No fade-pop: the base rises
   exactly while the pixels leave. The pass then stops and the base text is
   the title again.
4. **Re-hover**: if a leave is still reversing, it is finished cleanly and the
   wave restarts from the current glyph positions (no snap). If the row was
   left long ago, the wave replays in full. DOM is built once and reused —
   rebuilding under the pointer re-fires `mouseenter` and loops the sequence.

### Constants (single source in `ProjectRow`)

| Constant | Value | Notes |
|---|---|---|
| `pairDuration` | 0.48s | per-character exchange |
| `pairStep` | 0.05s | per-character stagger (wave) |
| wave/rev ease | `power3.inOut` | gentle launch (base) + gentle landing (clone); one shared ease keeps pairs locked |
| reverse | 0.45s, stagger 0.02s, `power3.inOut` | leave transition, ~0.6s total |
| `cell` | 7px | tile size |
| `STIFF / DAMP` | 0.16 / 0.78 | spring: ~0.3–0.5s settle, slight overshoot |
| `RADIUS / FORCE` | 120px / 9px | pointer push: light, `f²` falloff |
| canvas fade-in | 0.3s, delay 0.08s, `power2.out` | |
| coverage sampling | 5 offsets across the descent | no tile flicker mid-travel |

### Reuse contract (port to another component)

The effect needs exactly: a host element, a measured text box, and these refs —
`cvsRef` (canvas), `heightRef` (line height = travel), `mouseRef`
(pointer relative to the wrapper), `pixelCtxRef`/`pixelSourceRef` (2D context +
scratch source canvas), `proxiesRef` (per-char `{ y }` proxies), plus the
controller trio `enter / leave / finishNow`. Copy `initPixelCanvas`,
`startWebGL` (misnomer: it is the 2D pixel pass), `resetTextState`,
`restoreText`, `attachPointerHandlers`, and the timeline block in
`handleEnter`/`handleLeave` as a unit. Glyph metrics: baseline from
`fontBoundingBoxAscent/Descent`, per-char X from the live spans (keeps the
negative letter-spacing layout identical to the DOM).

### b) Focus callout — Undertones 4 (shaders/react WebGPU composition, REWRITE 2026-09-22)

**File:** `src/components/FocusCalloutShader.jsx` (+ CSS `.focus-callout*` in
`src/styles/global.css`); used in `SelectedProjects.jsx`:
`<FocusCalloutShader lines={calloutLines} />`.

**Copy is breakpoint-dependent (2026-09-28).** `CALLOUT_LINES_DESKTOP` /
`CALLOUT_LINES_MOBILE` in `SelectedProjects.jsx`; `calloutLines = isMobile ? … : …`
feeds **both** the `lines` prop and the DOM, because the mask pairs DOM line *i* to
raster *i*. Desktop: `somebody say / it' just music / and if could be /
different thinghs?`. Mobile: `Music / Are / Generative`, one word per row. Both
use the single title face — a per-word script face (Ballet) was tried and
**reverted**; the mask raster only supports one font per line. `isMobile` comes
from the shared `useIsMobile()` via `ArchiveCursorProvider` — no second listener.

**Callout entrance (2026-09-28). The characters MOVE, the line is the container.**
Each line's text starts at a **random offset** and travels to its own natural
position, clipped the whole way by the box of its own line. Desktop keeps the four
two-word lines; mobile swaps in the three-word phrase split one word per row. The
DOM ink is never painted — the shader is what you see slide in.

`gsap.from`, deliberately, **not** `fromTo`: the tween ends on the element's own
layout position, so the last frame is exact by construction instead of by a
hand-written end value that has to be kept in sync with the CSS.

| Piece | Value / rule |
|---|---|
| ease | `power3.out` |
| duration | `CALLOUT_REVEAL_DURATION = 1.1` |
| stagger | `CALLOUT_REVEAL_STEP = 0.62` — high overlap, so the entrance reads as one gesture rather than four words arriving in sequence |
| side | alternates `i % 2` (left/right/left/right) |
| travel | `CALLOUT_REVEAL_TRAVEL_X = [0.45, 1.15]`, `CALLOUT_REVEAL_TRAVEL_Y = [0.9, 2.1]`, randomised, scaled by the line's own measured size. Both ranges start above 1, so a line always begins **entirely clear** of its box instead of peeking in already half-placed |
| trigger | `scrollTrigger` on the timeline, `start: 'top 82%'`, `once: true` — it must not replay on scroll-back |
| reduced motion | no timeline is built at all; the lines sit in their natural position |

**The mask replays the same motion.** `compositeLinesUrl` draws each line's cached
raster at its **live** span rect and clips it to the line's **final** ink window
(`entry.winTop`/`winBottom`, measured once at cache time with the transform
neutralised — `getBoundingClientRect` on a transformed element returns the
*displaced* rect, and the window has to be where the line ends up). That is the
whole mechanism: the glyphs travel, the box does not, and at rest the word fills
its own box exactly.

Clipping happens on the per-line **scratch** canvas, so a window can only ever
touch its own line's pixels. The lines overlap on purpose at `line-height: 0.66`
and must never clip each other — a shared canvas cannot do this, because it has no
per-line alpha.

**Performance ceiling — read this before "optimising" the entrance.** The mask
redraws per frame while the entrance plays, and each redraw costs
`toDataURL('image/png')` (a **synchronous** PNG encode) **plus** a re-render of the
whole `<Shader>` tree **plus** an `ImageTexture` reload. The vendor's `ImageTexture`
only accepts a URL, so the encode is unavoidable. Consequences:

- `MASK_MIN_INTERVAL_MS = 33` caps the redraw at ~30/s. The entrance therefore
  **steps slightly**; that is the cost of driving the reveal through the mask, and
  it is not fixable by lowering the interval (the thread is already saturated).
- The rAF loop is gated on `useInView` and only redraws when a line's rounded live
  position changed. There is deliberately **no "settled" latch**: the entrance is
  created lazily by its ScrollTrigger, so a stable signature is also the state
  *before* it starts, and latching on that would kill the loop before the entrance
  ever played.
- `lastSig` only advances when a redraw actually happens, so a throttled frame is
  retried next tick instead of latching the skipped state.

If the entrance ever needs true 60fps, the only real lever is to stop driving it
through the mask (e.g. per-line shader instances with CSS transforms) — at the cost
of N WebGL contexts. Ask before going there.

The line's CSS box is `line-height: 1.2` + `margin-bottom: -0.54em` → 1.2em box,
0.66em net advance, `overflow: hidden`. It has to be **taller than the glyphs**: at
0.66 the line box is shorter than the ink, and a clip that short shaves ascenders
and descenders off the finished text. In the `--no-gl` / `--reduced` fallbacks the
box stops overlapping (`margin-bottom: 0; overflow: visible`), because with real
ink showing an overlapping clip would cut the neighbour's ascenders.

`STROKE_ALPHA = 0.4` adds a dilated low-alpha halo under each crisp glyph
(`cacheLine` sums `cov[i] + blurred[i] * STROKE_ALPHA`) so the deliberate glyph
overlap stays legible; set it to `0` to disable.

Do not re-add a scroll-linked playhead or a parallax scrub on the callout without
asking. `tests/components/SelectedProjects.calloutEntrance.test.jsx` pins the
contract above.

**The reveal channel is `--reveal`, and its base is 0 IN THE STYLESHEET.** Not a
JS flag: `FocusCalloutShader` multiplies each line's mask coverage by it, so a line
is invisible from first paint and cannot be seen before its entrance has positioned
it — no effect-ordering assumption, no race window. GSAP tweens it 0 → 1 **in
parallel** with the slide, on the same `position` and `duration`; if the two clocks
drifted, a word would fade in while still somewhere it was never meant to be visible.
The `--no-gl` / `--reduced` fallbacks pin it to **1** in CSS, because there the real
ink is what you see and no timeline is built.

The slide alone is not enough: a line with a small offset can already sit *partly*
inside its own box while still "outside", and be visible before being placed. The
gate makes invisibility a property of the base state rather than of the geometry.

**Do NOT gate the mask loop on intersection.** It used to be gated on `useInView` to
avoid work off screen, and that gate can silently stop the mask from tracking the
DOM — which is indistinguishable from a broken entrance, because the shader keeps
showing the text at rest while the invisible DOM slides. The loop is cheap when idle
(four rect reads, no redraw unless a line's offset or reveal changed). Correctness
wins. `useInView` is no longer imported here.

**Cost of a redraw, and the two dials.** Every redraw pushes a new URL through
`ImageTexture` and re-renders the whole `<Shader>` tree, and it encodes the mask —
whose cost scales with area. Two mitigations are in place:

- `encodeMask` uses `toBlob` + `URL.createObjectURL`, not `toDataURL`, so the encode
  leaves the main thread in Chrome. Being async, it needs a **sequence guard** (a
  superseded encode must never overwrite a newer one) and **revocation** of every
  replaced blob, or the entrance leaks one per frame. `toDataURL` is only the
  fallback for a canvas without `toBlob`.
- `MASK_DPR` is **pinned to 1 and is not a perf dial.** An attempt to set it to 0.5
  (to make the encode ~4× cheaper) put every glyph at twice its position, mostly
  off-canvas: the composite draws in **CSS pixels** into a canvas sized
  `w * MASK_DPR`, so any value other than 1 desynchronises the two. Lowering it
  needs the composite transform scaled by dpr *and* the per-line scratch clip
  scaled to match — not just the number. Do not "optimise" this constant alone.

`MASK_MIN_INTERVAL_MS = 33` still exists because the two above do not remove the
React re-render or the texture reload. If the entrance still steps after this, the
only real path to 60fps is to stop driving it through the mask — one shader instance
per line with CSS transforms, at the cost of N WebGL contexts. Ask first.

Raster bounds come from the span. `cacheLine` measures
`fontBoundingBoxAscent/Descent` **before** sizing the canvas and shifts by the
half-leading, because `textBaseline: 'top'` anchors the em box while `entry.h` is
the line-box top; a negative shift without matching headroom crops the ascenders.
`ctx.font` must be re-set after the resize (sizing a canvas resets the 2D
context). `.focus-callout` is `text-align: left`, so the span's left edge *is* the
line's — that is what keeps the shader text left-aligned like the DOM's.

**Known defects, deliberately NOT fixed.** Do not "repair" these without asking:

- The mask font omits `fontStyle`, so mask glyphs are **upright** while the DOM is
  `font-style: italic`. Invisible while the DOM ink is transparent; visible the
  moment DOM ink is shown (i.e. in the `--no-gl` / `--reduced` fallback). Fixed
  only by making the raster walk per-run fonts.
- The mask raster handles **one font per line** — a second face inside a line is
  not supported. The fix is a run-based raster (`collectRuns` + pen advance, and a
  run signature in the cache key), which also needs `document.fonts` `loadingdone`
  to clear the cache key or a late webfont stays in the fallback face.

**REWRITE 2026-09-22 — library-based Undertones recipe.** The old hand-written
Three.js satin-flute shader is gone. The component now composes the shaders.com
"Undertones 4" preset (collection recipe extracted from the public site API,
variant 4 = reference video `tests/bg-flutes.mp4`) with the `shaders` npm
package's React components.

> **The shader values live in the JSX as literals — the code IS the spec.** A
> previous revision of this doc carried a `TUNED` constant and a list of numbers;
> both were removed with the reverted bloom, and the numbers below had already been
> overtaken by the 2026-09-27 retune. Read the props in `FocusCalloutShader.jsx` as
> the source of truth and do not restore values from any doc. As of 2026-09-28:
> `Swirl` `#ffffff`/`#cfcfcf` detail 1.9 blend 55 · `ChromaFlow` base `#fc4040` up
> `#4a2afd` down `#c56e6e` left `#f314b4` right `#f195d6`, radius 2.5, momentum 18,
> intensity 2.5 idle / 0.6 hovered · `FlutedGlass` shape `waves` angle 31 frequency
> 10 refraction 6 aberration 0.61 (1.9 hovered) waveAmplitude 0.2 waveFrequency 0.2
> speed 0.25 highlight 1.9 · `FilmGrain` strength 0.05.

**Only `FilmGrain` carries the mask** — `maskSource="glyphMask" maskType="alpha"`.
It is deliberately the *last* node: three draws opaque → transmissive →
transparent, so a per-layer mask breaks the `FlutedGlass` refraction continuity.
`ChromaFlow` IS the hover interaction (momentum = the organic propagation); it is
gated by `effectOn` so a touch device needs the cursor held, not merely tapped.

The mask bridge is `compositeLinesUrl`, fed by `draw()`: cached per-line glyph
rasters (so a redraw is N `drawImage` calls, not per-pixel JS) composited into the
hidden 2D canvas and encoded to an alpha dataURL for
`<ImageTexture id="glyphMask">`. Redraws are throttled by `MASK_MIN_INTERVAL_MS`
(= 60 ms, ~16/s) and only when the position signature changes.

**Engine: WebGPU (TypeGPU), NOT WebGL.** `<Shader>` renders
`div.shader.focus-callout__canvas > canvas[data-renderer="shaders"]`; CSS
positions the wrapper absolute inset-0 (see `global.css`). Pointer/touch input
is captured globally by the engine — section keeps `pointer-events:none`.
`onUnavailable` → `focus-callout--no-gl` (visible ink). Reduced-motion →
no GL (`focus-callout--reduced`).

**Intentionally dropped (user decision):** the grab/click time-freeze and the
old uniform/dataset probes — ChromaFlow's momentum replaces both. No
`window.__calloutUniforms` anymore.

**Test env note:** the bundled Chromium has no `navigator.gpu`; tests MUST run
on real Chrome: `chromium.launch({ channel: 'chrome', headless: true })`
(verified adapter intel/gen-12lp). Canvas readback is impossible →
`tests/callout-check.mjs` verifies via compositor screenshots + ffmpeg pixel
analysis. Baseline green 2026-09-22: idle anim diff 0.42, idle field lum
242.5 (reference f1.png ≈ 243), FPS 145 (real GPU), mobile mounts, 0 fatal.

---

**PRE-REWRITE (historical): WebGL satin-flute text (section divider)**

**File:** `src/components/FocusCalloutShader.jsx` (+ CSS `.focus-callout*` in
`src/styles/global.css` ~391–432); used in `SelectedProjects.jsx` line 1584:
`<FocusCalloutShader lines={['bring new idea', 'build solution']} />`.
Reference: Undertones / Fluted Glass (shaders.com).

**Two-canvas architecture.** The DOM text stays in the layout as the sole
source of size/mask/AT but is **never visible**: `color/text-fill/caret:
transparent` + `user-select:none` from first paint (`.focus-callout__text-
line--reveal`, `.reveal-inner`). A GL canvas (`.focus-callout__canvas`,
absolute inset-0, `pointer-events:none`) renders the effect on top; the only
text-visible path is the `.focus-callout--no-gl` fallback when WebGL init
fails, and `--reduced` (prefers-reduced-motion → no GL at all, plain text).

**Luminance mask.** A hidden 2D canvas (`#FFF` bg + `#000` glyphs) is
sampled **by luminance** so linear-filter AA edges read as bright gray, never
transparent black (edge-bleed-proof). A 5-tap `min()` (center + cross at
`uTexel`) dilates the dark interior 1 texel so the AA transition samples
inward; `glyphAlpha = smoothstep(0.45, 0.55, mask)`.

**Idle — SATIN FLUTE (mono, Undertones look).** Aspect-corrected space
(`p = vec2(uv.x*uAspect, uv.y)`), **no lean/tilt**. Vertical S-arched bands:
lateral displacement `d` (4 sines + fbm), cosine crest/valley profile
`prof = mix(0.58, 1.0, 0.5+0.5*cos(bandPos*PI))` at `fluteCount 9.0` (satin,
not zebra), vertical luminance flow `yFlow = p.y*3.0 − t*1.6`, per-flute
**cascade** (`cascadeLag 0.35`, `cascadeDecay 0.490`, `fid mod(..., 9.0)`),
`flow = pow(clamp(sin(flowShape*PI),0,1), 2.2)`. Palette CHROME-TENUE:
`colLight #EFEEEC`, `colMid 0.80`, `colDark 0.58`, `colShad` graphite — flow
lifts toward colLight by 0.90 (integrated, not additive); sheen from
`profDeriv`; grain + vignette (luminance only, never alpha). Output
`vec4(clamp(ink,0,1), glyphAlpha)` — **no paper quad, alpha 0 outside
glyphs** (page shows through).

**Hover = tint, not patch.** Soft influence field from `uMouse` (already
lerped in JS, `exp(-dt*10)`): `hField` wide smoothstep (0.30), `along`
stretches the light along the flutes (vertical smoothstep 0.12), `ridgeLift`
0.10 mixes toward colLight; 28-stamp trail (`TRAIL_LIFE 1500ms`, min-dist
0.009) is **luminance-adapted** (`trailKey * idleLum/keyLum`) and gated by
`uHover` → absorbed into the glass, `fade = pow(1−age, 1.6)`.

**Edge + CA.** `edgeBand = clamp(glyphAlpha*(1−glyphAlpha)*4, 0, 1)` →
`mix(hoverInk, vec3(0.99,0.985,1.0), edgeBand*0.55)` makes the AA fringe read
as light, never a dark cut (idle + hover). Subtle chromatic aberration from
`profDeriv*0.010` (r+0.5 / b−0.5).

**Fallbacks (desktop + mobile).** WebGL unavailable → no-GL class → text
visible. Reduced motion → no GL, text visible. Effect is inside the glyph
bounds at all times (no overflow on any breakpoint).

---

## 2. IMAGE EFFECTS

### a) Tile-reveal gallery (expanded project)

**File:** shader + geometry in `src/shaders/tileReveal.js` (re-exported by
`src/components/SelectedProjects.jsx` → `ProjectExpanded`, which owns
`initWebGL` / `startRenderLoop` / `disposeWebGL`); also consumed by
`MobileSectionCanvas.jsx` (tiles branch, `uReveal: 1`).

One `THREE.WebGLRenderer` per image frame (`.gl-frame`), created **only when a
project expands**, disposed on close. Orthographic camera at z=1 over a **single
full-screen `PlaneGeometry(2, 2)`** — there is no per-cell geometry. Every cell
is recovered in the fragment stage from `floor(vUv * uGrid)`; the whole effect
is a **UV warp** (compute `uv' = f(uv)`, re-sample), exactly like the www-gl
`GridDistortion` / `Bend` `warp` templates: it never touches colours.

All per-cell logic runs in the **fragment stage**. The vertex stage is a trivial
passthrough (`vUv = uv`). The displacement (`idle` wobble + `mousePush`) is
applied to the cover-fit sample coordinate `suv = coverUv(vUv)`; the fragment
does `texture(uTex, target)` with alpha `tileOn` — **no `clamp()`**.

- `uReveal` sweep by column with per-row jitter (`hash21`), random
  "ahead-of-sweep" flicker tiles, idle wobble that stops once revealed;
- mouse displacement: graded / faded radial push around `uMouse` scaled by
  `uHover` — `strength = pow(smoothstep(0.7, 0.0, d), 1.5) * uHover * 0.18`, so
  even the closest cell peaks below full strength and far cells fade out
  entirely (the "sfumato" pointer: not every cell follows at 100%);
- cover-fit UV mapping (`uPlaneAspect` / `uImgAspect`) so images are never
  stretched.

**Edge "tensioned-fabric" taper (no smear, no gaps):** `target = suv +
offset * k` where `k = 1.0 - smoothstep(room * 0.5, room, length(offset))` and
`room = min(suv, 1.0 - suv)` is the sample's distance to the nearest image
border. Near a border the offset fades to zero, so `target` always stays inside
`[0, 1]` and the sample lands on the real edge texel — the warp-template
equivalent of `Surface3D`'s `edgePinning`. This removes the old `clamp`
smear band (the original effect slid the sample under a fixed quad and clamped
it) AND the rigid-geometry "cells breaking apart" gaps, while letting the
border region still bend under the pointer like taut fabric.

**Precision rule:** `uPlaneAspect` now lives only in the fragment stage (the
vertex passthrough does not declare it), so there is no cross-stage precision
mismatch and the fragment shader does not redeclare `precision mediump float;`
(three.js injects matching precision itself).

`prefers-reduced-motion` skips WebGL entirely (`.gl-frame--fallback`).

**Static ghost layer (under the cells):** `.project-expanded__img` (the
non-WebGL `<img>`/`<video>` inside each `.gl-frame`) is kept visible under the
canvas as a blended ghost — `mix-blend-mode: difference; opacity: 0.65;`
on the base rule, and `.gl-frame.is-ready .project-expanded__img` is no longer
forced to `opacity: 0` (it now matches the `0.65` ghost). The canvas paints on
top, so the difference blends against the page backdrop; on WebGL fallback
(`.gl-frame--fallback`) there is no canvas, so the static img shows at full
`opacity: 1`. This is the "static image showing through under the moving cells"
the user liked; the difference/0.65 styling was added on request.

### b) Hero cursor-trail contact (WebGPU)

**Files:** `src/webgl-water/shader-hero.jsx` (component) + `src/webgl-water/index.jsx`
(re-export thin wrapper) + `src/components/SplitScreenHero.jsx` (public export).

Uses the **`shaders/react`** library (WebGPU via TypeGPU) instead of Three.js.
The component tree inside `<Shader>`:

1. **`<ImageTexture id="heroDay" url="/hero-day.png" objectFit="cover" />`** —
   base layer, always visible. `objectFit="cover"` matches the CSS fallback.
2. **`<ImageTexture id="heroNight" url="/hero-night.jpeg" objectFit="cover"
   maskSource="DotMask" />`** — night image, only visible where the halftone
   dot grid has alpha (i.e. along the cursor trail).
3. **`<ChromaFlow id="Flow" intensity={1.4} radius={2.9} visible={false} />`**
   — invisible data pass that generates a directional flow field from pointer
   movement. Its `alpha` channel drives the DotGrid's `dotSize`.
4. **`<DotGrid id="DotMask" density={40}
   dotSize={{ driver: 'Flow', property: 'alpha' }} twinkle={0.9}
   visible={false} />`** — invisible halftone mask. Density 40 dots on the
   longest edge; `dotSize` is a `PropDriver` reading ChromaFlow alpha so dots
   grow/shrink based on cursor velocity and direction. Twinkle 0.9 adds subtle
   per-row shimmer.
5. **`<CursorRipples intensity={10} decay={10} radius={0.5}
   chromaticSplit={1} />`** — ripples distort the entire composition (both
   images) centered on the pointer. `decay=10` ensures fast fade when the
   cursor stops.
6. **`<FilmGrain strength={0.1} />`** — subtle grain overlay.

**WebGPU fallback:** `<Shader onUnavailable={…}>` fires `onUnavailable` when
the browser/GPU cannot run WebGPU shaders. On failure, `webgpuFailed` state
flips to `true` and the component renders a plain `<img class="hero-static-image">`
instead. No Three.js, no WebGL, no manual render loop.

**No manual animation loop.** The `shaders` library owns the render loop
internally — no `requestAnimationFrame`, no `visibilitychange` handler, no
idle auto-stop. Cursor tracking is handled automatically by `CursorRipples`
and `ChromaFlow`.

**Key differences from the old Three.js pipeline:**
- WebGPU instead of WebGL (requires Chrome 113+, Edge 113+, Opera 99+)
- Declarative component tree instead of imperative 6-pass render loop
- No module-cached `heroGL` singleton — `Shader` manages its own GPU context
- No manual texture loading — `ImageTexture` handles `object-fit: cover`
- No `THREE.js` dependency for the hero (still used by gallery/effects)

### c) Featured gallery ripple

**File:** `src/components/FeaturedGallery.jsx`
One `THREE.WebGLRenderer` per card (six total), created **once** after all
poster images load, module-cached (`galleryGL`) and reused across remounts.
Hover ripple + chromatic distortion via per-frame lerped uniforms (`uHover`,
`uMouse`); the loop stops on unmount (renderers stay cached) and resumes on
remount/visibility. `prefers-reduced-motion` keeps plain images.

### d) Deliberately cheap (2D canvas, no WebGL)

- **Project-row title pixel effect** (see §1): 2D canvas by design — a hover
  must never allocate GL contexts.
- **CursorGlow**: 2D radial gradient.

### e) Archive hover — directional-wind distortion (WebGL) + cursor morph

**Files:** `src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx`,
`src/components/ArchiveHoverCanvas/PendulumCanvas.jsx`,
`src/components/ArchiveCursor.jsx`.

One WebGL canvas created when `!reduceMotion` (a single `THREE.WebGLRenderer`,
FXAA post pass). Wind direction/strength come from cursor velocity via tweened
uniforms — the same `cursorRef` source as every other section.

- **Canvas is ALWAYS rendered when WebGL is available.** `reduceMotion` is the
  only path to the plain `<img>` fallback; an animated GIF never replaces the GL
  canvas with a static overlay.
- **Animated content textures (video-first):** rows can carry `videoPath` (mp4,
  e.g. converted from GIF with ffmpeg). A muted/loop/playsInline `<video>` feeds
  a `THREE.VideoTexture` with per-frame `needsUpdate` — the media clock advances
  independent of paint, so covered videos keep animating where GIF decoders
  freeze. Plain `.gif` (`gifPath`, no video) falls back to the DOM-img +
  `CanvasTexture` drawFrame path; slide transitions are skipped for both.
- **Cursor morph anchor (ArchiveCursor):** grow (16→canvas box, 0.45s
  `power2.out`) and shrink (canvas box→16, 0.35s `power2.inOut`) are pinned
  **center-center**: the RAF keeps the border's center on the canvas center
  (`translate(left + w/2 − offsetWidth/2, top + h/2 − offsetHeight/2)`), never
  the top-left corner. On shrink completion the border becomes the 16px dot at
  the cursor again.
- Canvas content reveal: `clipPath` polygon sweep 0.5s `power3.out` (open) /
  0.25s `power2.in` (close); canvas opacity 0.3s `power2.out` (open) / 0.15s
  `power2.in` (close); desktop dot fades 0.15s.

---

## 3. TEXT ENTRY GLASS — Standalone 3D Object

**Files:** `src/components/TextEntryGlass.jsx` (React wrapper: mount, ResizeObserver, pointer,
hidden copy) + `src/hero-glass/{params,geometry,backdrop,textRows,textLayout,textAtlas,textLayer,engine}.js`
(isolated Three.js engine) + `src/shaders/heroGlassText.js` (GLSL). No GSAP.

**Placement:** normal `100dvh` section immediately after `<SplitScreenHero />` and
before `<FeaturedGallery />` in `App.jsx`. No controls, no sticky positioning, no pin; a single
canvas fills the section, carrying both the object and the text rows.

**Object:** `TorusKnotGeometry(0.65, 0.3, 300, 24, 2, 3)` from CodePen `qERKExz`, at `z = 2.2`,
camera `fov 45` at `z = 5`, scale `min(visibleWidth, visibleHeight) * 0.09`.
Anchored **top-left**; `LAYOUTS` in `params.js` sets `scaleMultiplier`, `padding` and `parallax`
per mobile / tablet / desk, and `halfCut` on mobile leaves only the right half on screen.
A passive scroll listener walks the object down until its top edge reaches the section middle.
`hero.svg` is **not** used by this section any more; it still feeds the hero shader image.

> **2026-09-27 — spec reconciled to the code (decision B).** The values above were
> documented as the verbatim CodePen ones (`1, 0.3, 300, 48` and `metalness 0 / roughness 0 /
> ior 1.45 / dispersion 4`) but the shipped values had been tuned past them. The code wins and
> the doc was wrong: the tuned values are now the spec. Do not "restore" the pen values.

**Material (exact values in `src/hero-glass/params.js`):** `color 0xffffff`, `metalness 0.12`,
`roughness 0.051`, `transmission 1`, `thickness 0.7`, `ior 1.95`, `dispersion 2`,
`envMapIntensity 0.35`, `toneMapped false`. Lighting comes only from `scene.environment`
(PMREM `RoomEnvironment`, sigma `0.04`); `material.envMap` stays null.
`envMapIntensity` is 0.35, not 1: RoomEnvironment is a white studio with light panels, and at
1 on a near-mirror surface it reflects that studio over the whole object, burying the
refracted rows. It scales the specular IBL only — the transmission is untouched.

**Motion binding (in `engine.js`):** `renderer.setAnimationLoop` + `performance.now()` (NOT
`THREE.Clock` — removed); `rotation.x = t * 0.05 + pointerY * 0.15`,
`rotation.y = t * 0.25 + pointerX * 0.12`. No ScrollTrigger, no scrub, no pin. Pointer values
are normalised to `[-1, 1]` by the component.

**Reduced motion:** the same torus, `rotation.set(0.06, 0.04, 0.1)`, one rendered frame, no loop.

### Text rows (2026-09-27)

The rows are **inside the WebGL scene**, not in the DOM. A `<span>` can never be
refracted: three samples the transmission render target, which only holds geometry the
renderer already drew. Moving the text into the scene is what finally made the glass
deform it. Consequence: the copy is no longer selectable, so a visually-hidden
`.text-entry__sr` copy carries the reading order for screen readers and indexing.

**Config (`src/hero-glass/textRows.js`):** `TEXT_ROWS` is an array of
`{ text, behind }`. `normalizeRows` coerces `behind` with `=== true` and drops rows whose
text is empty or not a string. Everything downstream derives from `rows.length` — there is
no per-index special case, so adding a row is the only edit needed to change the count.

`behind` picks the draw pass, which is the whole mechanism:

| | `behind: true` | `behind: false` |
|---|---|---|
| Pass | **opaque** | **transparent** |
| Alpha | `alphaTest` + `discard` | blending |
| Depth | `depthWrite: true`, `depthTest: true` | `depthWrite: false`, `depthTest: false` |
| z | `TEXT_BEHIND_Z` (backdrop + 0.05) | `TEXT_FRONT_Z` (torus + 0.8) |
| Result | **refracted** by the glass | crisp, painted over the glass |

**Never give a `behind` row `transparent: true`.** three runs opaque → transmissive →
transparent, so a blended row would be drawn *after* the torus and sit on top of it — the
exact opposite of the flag. The `discard` in `src/shaders/heroGlassText.js` is what keeps
the row opaque; removing it silently breaks the flag.

**Pipeline:** `textLayout.js` fits each row against its own text (bisection, `measure`
injected, so it unit-tests without DOM or WebGL) → `textAtlas.js` rasterises every row into
**one** 2D canvas and returns the texture plus per-row UV slices (`flipY = false`, so
`v = 0` is the canvas top) → `textLayer.js` builds one plane per slice and bakes the slice
UVs into the geometry. Shaders live in `src/shaders/heroGlassText.js` and are GLSL ES 1.00
per ground rule 8. Font, weight, colour and `--text-entry-lh` are read from CSS at runtime,
never duplicated in JS. `document.fonts.ready` triggers `engine.rebuildText()` because the
atlas is rasterised text — a fit taken on the fallback face would be baked in permanently.

**Backdrop (in `backdrop.js`):** untone-mapped `MeshBasicMaterial` quad at `z = 1`,
`renderOrder -1`, no depth test/write, sized to the frustum on resize. Colour is `--c-field`
(fallback `#F5F1EA`); `setTexture()` accepts a `THREE.Texture` for a future video behind the
section. Required: without it the `transmission` samples nothing and the glass renders dark.
**It is never made transparent** — an earlier attempt set `opacity: 0` and that both hid the
glass and contradicted the rule below.

**Component cleanup (TextEntryGlass.jsx):** media-query listener, ResizeObserver, `pointermove`
listener, engine dispose. No GSAP context.

**Mobile = desktop.** The same `100dvh` section, same canvas. No separate mobile branch.

Preloader is shader-only and no longer owns or starts this object.

---

## Ground rules (learned the hard way)

1. **Never create WebGL contexts per hover, and never per mount.** Chrome
   kills the oldest context past its budget (`Too many active WebGL contexts`
   storm). GL systems are module-cached singletons built once per surface
   (hero, gallery) and reused across StrictMode remounts; text-scale effects
   use one 2D canvas.
2. **One visible title slot at all times.** The wrapper + track are the hard
   clip window; nothing renders outside it (chars, tiles, canvas).
3. **DOM + canvas stay in sync through the same GSAP timeline** (proxy
   objects) — never two independent animations of the same text.
4. **Leaves reverse, they don't swap.** Any exit must animate the previous
   state back (reverse exchange), never fade-out-then-snap-restore.
5. **One motion language:** `power3.inOut` for paired character motion,
   `power2.out/in` for fades, springs for pointer-driven fields, small
   staggers (≤ 0.05s) only on small groups.
6. **Reuse the built DOM across hovers**; guard `handleEnter` against
   duplicate mouseenters.
7. Verify with a throwaway Playwright script per change (spawn Vite, hover,
   sample canvas pixels + char transforms, assert continuity and restore).
8. **GLSL ES 1.00 discipline** (fluid/gallery shaders): no implicit float→vec
   conversion (`vec2 cell = vec2(uCellSize);` — plain `= uCellSize` fails to
   compile), `vec4(...)` constructors must total exactly 4 components, and no
   GLSL3 syntax (`texture()`, `in`/`out`) in non-GLSL3 shaders. Channel layout
   for the fluid sim: velocity = RG, dye = B, A unused.
9. **Never bind a ping-pong TARGET texture as a sampler uniform** while
   rendering into it — framebuffer/texture feedback loop
   (`GL_INVALID_OPERATION: glDrawElements: Feedback loop formed`).
10. **Set `quad.material` in EVERY sim pass.** A pass that forgets it inherits
   whatever material the quad last wore (the display pass) and silently
   composites the screen back into the sim targets — the hero corrupted into
   a blotchy black/blue mosaic exactly this way.
11. **Sim textures that get upscaled must be Linear-filtered** (mag AND min);
   `NearestFilter` on the quarter-res dye mask pixelates the final composite.
   Use `HalfFloatType` (core-linear-filterable in WebGL2) rather than
   `FloatType` (needs `OES_texture_float_linear`).
12. **Keep hash inputs bounded**: `hash(uv * uTime * k)` desyncs float
   precision as `uTime` grows and degenerates into blocky noise patches —
   feed `fract(uTime * k)` instead. Same family as rule 8.
13. **Gate fluid injection on real pointer movement** (`uMove` from per-frame
   pointer delta, skipped entirely when parked/outside) and cap dye
   accumulation — otherwise a resting cursor floods the field and the reveal
   never settles back to idle. Sync `pointerPrev` to the entry point on first
   contact so re-entry doesn't fire a giant splat from a stale position.
