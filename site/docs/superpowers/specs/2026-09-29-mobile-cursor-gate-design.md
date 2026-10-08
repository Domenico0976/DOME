# Mobile cursor gate — design spec

Date: 2026-09-29
Scope: every canvas/WebGL effect on the site obeys one touch rule; three defect fixes in Archives; dynamic viewport height.
Hero is explicitly EXEMPT and must not be modified.

---

## 1. Why this spec exists

`AGENT/EFFECTS.md` already states the rule (see §1, "Hard rule — mobile effect gating"). It has been violated anyway — three times in a single working session, one of them by the author of this spec while adding the gallery dissolve. The rule is not missing knowledge; it is markdown that nobody reads while editing a component file.

**Therefore the rule must become something that fails when broken, not something that describes it.** A structural regression test is the only mechanism that survives an AI-assisted editing history: the wrong code produces a red suite, so the agent cannot report success.

## 2. Verified current state

Established by reading the source, not by trusting prior notes. **Most sites already comply.** The list of non-compliant sites is shorter than it looks.

### Already compliant — do not "fix" these into a different shape

| Site | Location | Gate |
|---|---|---|
| FocusCalloutShader | `FocusCalloutShader.jsx:354` | `isTouch ? isDragging : hovered` (the reference implementation) |
| Archives | `Archives.jsx:107, 125, 130, 156` | `isCursorActiveRef` |
| FeaturedGallery ripple | `FeaturedGallery.jsx:300-316` | `isCursorActiveRef` + in-bounds |
| FeaturedGallery canvas open | `FeaturedGallery.jsx:443` | `isDraggingRef` |
| ProjectRow | `SelectedProjects.jsx:150, 574` | `isCursorActiveRef` |
| ProjectExpanded | `SelectedProjects.jsx:1131-1145` | `isCursorActiveRef` + in-bounds |

### Non-compliant — in scope

| # | Site | Defect | Location |
|---|---|---|---|
| N1 | TextEntryGlass | No touch gate at all. Raw `pointermove`; the value is **not** smoothed (direct assignment at `hero-glass/engine.js:175-178`). Mobile never reaches it correctly. | `TextEntryGlass.jsx:101-108` |
| N2 | FeaturedGallery dissolve | `pointerenter` → `tweenDissolve(item, 1)` is **ungated**. A bare tap fires it. The ripple in the same file is gated; the dissolve is not. | `FeaturedGallery.jsx:247-248` |
| N3 | ProjectRow position | The gate is correct but `mouseRef` — the position feeding the tile spring field — is fed **only** from `clientX/clientY` on desktop events. The mobile cursor is never wired in, so on touch the gate passes and nothing arrives. | `SelectedProjects.jsx:644-648, 801-805` |
| N4 | Device detection | `useIsMobile.js` uses `(max-width: 720px)` and `useIsTouch.js` uses `(any-pointer: coarse)`. `navigator.maxTouchPoints` is used nowhere. The user specifies digitization. | `useIsMobile.js`, `useIsTouch.js` |

**N4 carries a regression risk that must be handled, not just a swap.** `navigator.maxTouchPoints > 0` is true for touchscreen laptops and many Windows machines, so a desktop visitor driving a mouse would be routed down the touch path and the effects would stop responding to their mouse. The condition must express *touch-primary*, not *touch-capable*:

```js
// touch-capable AND not primarily a fine pointer
maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches
```

This keeps a Surface or a touchscreen laptop on the desktop path, which is what a mouse user needs. Verified against real hardware before sign-off, since this is the one change that can break desktop for a subset of users.

### Defects to fix

| # | Defect | Root cause (verified by hand) |
|---|---|---|
| D1 | Archives desktop cursor freezes on fast exit from a row | See §3.1 — a one-way latch, not a race. |
| D2 | Archives image stretched on mobile | Two independent causes. See §3.2. |
| D3 | Archives canvas outlives the section | No viewport lifecycle exists at all. See §3.3. |
| D4 | Viewport height is not dynamic | `visualViewport` used **nowhere** in `src/`. `window.innerHeight` used in 20+ places. `100dvh` appears exactly **once** in `global.css` (line 884). See §4. |

## 3. Defect diagnoses

### 3.1 D1 — the frozen cursor is a one-way latch (root cause confirmed)

`ArchiveCursor.jsx`. `rafEnabledRef` is written in exactly two places, **both inside the morph branch**:

- `rafEnabledRef.current = false` — line 230, morph branch entry
- `rafEnabledRef.current = true` — line 268, morph `onComplete`

**The shrink branch (lines 164-227) never touches it.** The position RAF is:

```js
if (rafEnabledRef.current) { /* follow the mouse */ }
else if (morphingRef.current || shrinkingRef.current) { /* centre on the canvas */ }
// no else — nothing is written
```

Sequence: hover row N → morph starts (`rafEnabledRef = false`) → move out fast → `inRow = false` → shrink branch kills the morph timeline → **the morph's `onComplete` never runs, so `rafEnabledRef` stays `false` permanently** → shrink completes, `shrinkingRef = false` → the RAF now matches neither branch and writes no transform. The cursor stops tracking the mouse. Re-hovering starts a fresh morph whose `onComplete` restores it; every fast in-out cycle can re-strand it, which is why it takes several attempts.

**Note:** an automated analysis blamed `morphingRef`/`shrinkingRef` not being reset. That is **wrong** — line 181 and line 232 do reset them. Do not "fix" the flags.

**Fix:** the shrink branch restores `rafEnabledRef.current = true`, at branch entry and defensively in `onComplete`. Minimum viable change; no state machine redesign.

### 3.2 D2 — stretch has two independent causes

`PendulumCanvas.jsx:86-87` already sizes the box from the image's real aspect:

```js
if (aspect >= 1) { w = MAX_W; h = Math.min(MAX_H, MAX_W / aspect) }
else { h = MAX_H; w = Math.min(MAX_W, MAX_H * aspect) }
```

So the intended behaviour is already the structure. What is wrong:

1. `ArchiveHoverCanvas.jsx:277` — `uPlaneAspect: { value: WIDTH / HEIGHT }` initialises to the constant `340/440` (0.773) instead of the live box. `coverUv` computes against a wrong plane aspect until the ResizeObserver fires. The live correction is at lines 341-354.
2. `PendulumCanvas.jsx:7-8` — `MAX_W = 340` is a desktop-sized constant. On a 390-430px viewport the canvas never uses the available width, which is the user's actual complaint. There is no viewport branch in this file, unlike the glass section which does have per-breakpoint layouts.

**Fix:** (1) initialise `uPlaneAspect` from the measured box, and re-assert it whenever the box changes; (2) derive `MAX_W`/`MAX_H` from the viewport width with the existing 340/440 as the desktop ceiling.

### 3.3 D3 — no viewport lifecycle exists

`Archives.jsx:310-329` renders the canvas whenever `hoveredRow` is truthy. There is no IntersectionObserver, no `useInView`, no ScrollTrigger on it. When the section scrolls away the canvas stays.

**Fix:** an IntersectionObserver on the archives section. On exit, if the canvas is open, close it with the existing reverse animation (clipPath collapse 0.25s `power2.in`, opacity 0.15s `power2.in` per `ArchiveCursor.jsx:203-216`) rather than an abrupt unmount. Per-device: on touch the close is driven by the same observer; on desktop it composes with the existing leave handling.

### 3.4 D4 — viewport height (see §4)

## 4. Dynamic viewport height (D4)

**Verified:** `visualViewport` appears nowhere in `src/`. `window.innerHeight` is the *layout* viewport — it stays at the large value when browser UI collapses. Consequences match the report exactly: the cursor is normalised against `innerHeight` so it drifts off the touch point, and canvas sizing against it leaves dead space at the bottom (the classic `100vh` bug). `100dvh` appears once, at `global.css:884`.

**This is foundational, not cosmetic.** The cursor position is the input to every effect. If it is misaligned, every effect is misaligned even when its gate is correct. It is therefore sequenced first.

**Fix:**
- A single `useVisualViewport()` hook exposing `{ width, height, offsetTop, scale }`, driven by `visualViewport` `resize`/`scroll` listeners with a `window.innerHeight` fallback where the API is absent.
- The mobile cursor normalises against it; the archives canvas sizes against it; every `100vh` becomes `100dvh` where dynamic behaviour is wanted.
- Do **not** blanket-replace every `innerHeight` in one sweep — several call sites (`PendulumCanvas` math, `MobileCanvas` placement, glass parallax) are correct as-is and are verified individually during implementation.

## 5. The cursor model

Answers to the two gating questions, combined:

- **Activation requires a deliberate grab-and-drag.** `isCursorActiveRef` already encodes exactly this: it is set only by `activateCursor()`, which `ArchiveCursor.jsx:53` fires when the touch moved ≥4px **while starting on the cursor ball**. A passive scroll cannot set it, because a scroll does not begin on the ball. This is the existing mechanism and it is correct.
- **Position persists.** Once awake, the cursor's position keeps driving the effect even while it is stationary, including as the page scrolls beneath it.
- **It sleeps** on the next touch that is not a grab of the cursor ball, and on a safety timeout of **4s** after the last cursor interaction. The 4s is the one tunable in this design: the constraint it satisfies is that no effect may stay awake indefinitely while the visitor scrolls on, and it must be long enough that a deliberate placement is not cut off mid-read. The user tunes it after seeing it run.

Separating *activation* from *influence* is what resolves the apparent contradiction in the original request. It also avoids the failure mode of "activate on rest": there would be no way to switch it off again, and with six sections several effects would be live at once.

### 5.1 New state in `useArchiveCursor`

| Field | Type | Set | Cleared |
|---|---|---|---|
| `isCursorAwakeRef` | ref | `activateCursor()` (real cursor drag) | next non-grab `pointerdown`; safety timeout |
| `cursorParkedRef` | ref `{x, y}` | on every cursor-drag move | with `isCursorAwakeRef` |

### 5.2 The gate

```js
const { isAwake, parked, isOver } = useCursorGate()
// isTouch ? (isAwake.current && isOver(rect)) : hovered
```

`isOver(rect)` is a hit test of the parked position against a **live** rect the caller already computes each frame. Keeping the rect with the caller is deliberate: the compliant sites already do this every frame (`FeaturedGallery.jsx:302-315`), so the hook supplies the cursor side and never has to measure anything itself.

**Exemption:** TextEntryGlass is "always" oriented per the user — it reads `parked` directly and is not gated on awake. This is a declared exemption, not an oversight.

## 6. The architectural core

**`useCursorGate`** (`src/hooks/useCursorGate.js`) — one hook every effect consults. **Single API, no convenience form:**

```js
const { isAwake, parked, isOver } = useCursorGate()
```

All three are **refs, not React state**. Every consumer is a rAF loop or an event handler, and state would re-render the tree on every touch move.

- `isAwake` — `ref<boolean>`, the gate
- `parked` — `ref<{x, y}>`, the persistent position
- `isOver(rect)` — hit test, caller supplies the live rect

The three already-compliant DOM-event sites (gallery dissolve, `ProjectRow` enter, archives row enter) get the gate as a one-line early return rather than a second hook form:

```js
if (isTouch && !isAwake.current) return
```

One way to do it keeps the structural test in §6 able to recognise a compliant file by a single, greppable call.

It also removes a real inconsistency: today `isDragging`, `isDraggingRef` and `isCursorActiveRef` are used interchangeably across sites and mean three different things (100ms-hold, same as ref, 4px-grab respectively).

**Enforcement — a structural regression test**, not a lint rule and not more prose:

- Scan `src/components/**` (and `src/hero-glass/**`) for files that construct a `WebGLRenderer`, create a `<canvas>`, or use the `shaders/react` `<Shader>`.
- For each such file, assert that cursor input arrives through `useCursorGate`, or that the file is on an explicit exemption list.
- The exemption list contains the hero and the genuinely cursor-independent surfaces. Adding an entry is a deliberate act.
- A newly added canvas that is neither gated nor listed **fails the suite**.

The list is the mechanism that makes the exemption visible. A new effect cannot be forgotten, because the test finds a canvas nobody classified.

`AGENT/EFFECTS.md` is updated too — but as documentation of what the test now enforces, not as the enforcement itself.

## 7. Per-site changes

| Site | Change |
|---|---|
| `useIsMobile` / `useIsTouch` | Use `navigator.maxTouchPoints` (digitization) per the user. Keep the width breakpoint for **layout** decisions (the callout swaps copy at 720px) — detection and layout are different concerns and must not be collapsed. |
| `useVisualViewport` (new) | §4. |
| `useCursorGate` (new) | §6. Parked/awake state. |
| TextEntryGlass | Replace the raw `pointermove` with the parked/live cursor; **add smoothing** (today the value is assigned raw); exempt from the awake gate. |
| FeaturedGallery | Gate the dissolve `pointerenter`/`pointerleave` pair (N2). Ripple is already correct — align it to the hook without changing behaviour. |
| ProjectRow | Feed `mouseRef` from the parked cursor on touch (N3). Desktop path unchanged. |
| ProjectExpanded | Remove the touch-only `onClick` that calls `openCanvas(..., 'tile-reveal')`. **Verified already `isTouch ? ... : undefined`**, so desktop is untouched by construction. |
| FocusCallout | `ChromaFlow radius` 2.5 → 3.25 on touch only. Font enlarged to fit — see §8. |
| Archives canvas | D2 + D3. |
| ArchiveCursor | D1. |

## 8. FocusCallout font — MEASURED, and the request is not satisfiable as asked

`global.css:474` is `clamp(64px, 12vw, 200px)` — **width**-based, so on every phone tested `12vw` is below the 64px floor and the rendered size is **exactly 64px** everywhere.

Measured on the real page (`tests/perf/measure-callout.mjs`, Bricolage Grotesque 800 italic, `letter-spacing: -0.02em`):

| Viewport | Container | Current | "Generative" | Max size that fits | Gain |
|---|---|---|---|---|---|
| iPhone SE 375 | 335px | 64px | 312.1px | **67px** | **1.05×** |
| iPhone 14 390 | 350px | 64px | 312.1px | **70px** | **1.10×** |
| Pixel 7 412 | 372px | 64px | 312.1px | **74px** | **1.17×** |
| 14 Pro Max 430 | 390px | 64px | 312.1px | **78px** | **1.22×** |

"Generative" is **4.877em** wide. Nothing overflows today; the text already sits at 89-93% of the available width.

**Consequence: "enlarge it" yields 1.05×–1.22×, and on an iPhone SE it is 1.05× — invisible.** The earlier assumption in this spec that there was "empty space" to fill was wrong, and the measurement is what disproved it. There is no headroom to recover: the mobile copy is a single 10-character word that already spans the container.

### 8.1 Decision: option A — take the maximum that fits

The user chose A. The 2× is unreachable and no amount of tuning produces it; the achievable range is accepted as-is. The requirement is "bigger", and larger is now defined as *the largest size the longest word permits at each viewport*, rather than a fixed multiplier.

**Implementation — a mobile-scoped override, not a change to the shared value.** `font-size: clamp(64px, 12vw, 200px)` is a single declaration used at every breakpoint, so raising `12vw` globally would also move desktop (1600px → 288vw-equivalent, hitting the 200px cap and shifting a desktop layout that is currently correct and out of scope). Therefore:

```css
.focus-callout { font-size: clamp(64px, 12vw, 200px); }        /* unchanged */
@media (max-width: 720px) {
  .focus-callout { font-size: clamp(64px, 18vw, 200px); }      /* the only change */
}
```

`18vw` is derived from the measurements above: it lands at 67.5 / 70.4 / 74.2 / 77.4px across the four test viewports, i.e. at the fitted maximum (which already carries a 2% margin) rather than below it. Above 64px on every device tested, so the clamp's floor stops binding and the old 64px ceiling behaviour disappears.

**Must be re-verified by `tests/perf/measure-callout.mjs` after the change**, with the pass condition being `currentOverflows === false` on all four viewports. That script is kept in the repo for this purpose: it is the only thing standing between this change and a silent horizontal overflow on an unlisted device.

**Honest note for the record:** on a 375px iPhone SE this is a 5% increase and will not read as "bigger" to a visitor. A or B or C was a genuine fork, and A is the option that changes no content and no typography — which is why it is the safe one, not the satisfying one. If the callout still feels small on a real device, the answer is B (shorter mobile copy), not a larger `vw`.

## 9. Sequencing

Ordered so that each step is independently verifiable and a partial delivery is coherent.

1. **Viewport (§4)** — foundational. Everything else consumes cursor position.
2. **`useCursorGate` + structural test (§6)** — the mechanism. Its test proves itself against the already-compliant sites before they are converted.
3. **FocusCallout** — cheapest consumer, validates the hook on a site that already has a working gate. Also lands the radius and the font.
4. **TextEntryGlass** — isolated component, no existing gate, adds smoothing.
5. **FeaturedGallery** — gates N2, the regression introduced with the dissolve.
6. **ProjectRow** — N3, the position wiring.
7. **ProjectExpanded** — removal only.
8. **Archives** — D1, D2, D3.

## 10. Verification

Per `AGENT/EFFECTS.md` ground rule 7, each step is verified with a throwaway Playwright script, not by reading the diff.

Non-negotiable, because each was violated in this session and the tests did not catch it:

- **A screenshot diff is not evidence an effect works.** A CSS hover transform changes pixels with the effect dead. Assert on rendered *content*.
- **A structural/uniform assertion is not evidence the effect fires.** A dead dissolve still has correct uniforms. Drive the real gesture and observe the change.
- Shader compilation must be asserted: a GLSL reserved word (`active`) failed compilation silently and every other check passed while the layer drew nothing. The suite now scans for reserved words, and browser checks read actual pixel content rather than comparing frames.
- Touch behaviour is verified with a touch-emulating context, at a viewport with a collapsing browser UI, since D4 only manifests there.

### 10.1 Per-step QA

Every touch step carries the same **negative** assertion, and it is the one that matters: **a passive scroll flick must not wake the cursor.** If that fails, the effect fires on ordinary scrolling, which is the exact failure `isCursorActiveRef` exists to prevent. A step is not done on its positive assertion alone.

Browser checks follow the established pattern in `tests/perf/`: serve `dist/` in-process and drive `patchright`, reading real pixel content via `drawImage(webglCanvas) → getImageData` rather than comparing frames.

| Step | Assertion | Method |
|---|---|---|
| 1 Viewport | Cursor centre equals the real touch point at two different visual-viewport heights | Dispatch a touch at a known point, read the cursor's centre from its rect, `expect` distance ≈ 0. Repeat with the visual viewport resized mid-session |
| 1 Viewport | No dead space under the archives canvas | `canvas.getBoundingClientRect().bottom` vs `visualViewport.height`, tolerance 2px |
| 1 Viewport | No desktop regression | Suite green at 1600×1000 with a mouse; `dvh` reflow does not shift desktop layout |
| 2 Gate | The structural test actually bites | Temporarily un-gate a known-compliant site, assert the suite **fails**, restore. A test that cannot fail is worse than none |
| 2 Gate | Awake/sleep transitions | Grab-drag → awake; a subsequent non-grab `pointerdown` → asleep; 4s idle → asleep; on each, the callout's `is-awake` class flips |
| 2 Gate | Passive scroll does not wake | Wheel across the section with no touch down → `is-awake` stays false |
| 3 Callout | No horizontal overflow | `node tests/perf/measure-callout.mjs` → `currentOverflows === false` on all four viewports |
| 3 Callout | Font is mobile-scoped | At 1600px the computed `font-size` must be unchanged from before; at 390px it must be ≈70px |
| 3 Callout | Radius is touch-only | `ChromaFlow` `radius` 2.5 on mouse, 3.25 on touch |
| 4 Glass | Follows the cursor, smoothed | Grab-drag → orientation changes and is continuous; assert two consecutive frames differ by less than the raw-jump the old unsmoothed path produced |
| 4 Glass | Always-oriented exemption holds | Orientation still tracks the parked position with no drag held |
| 5 Gallery | Dissolve is gated | Bare tap (no drag) → `uDissolve` stays 0; cursor drag → rises to 1 |
| 5 Gallery | Ripple unregressed | The existing in-bounds + `isCursorActiveRef` behaviour is unchanged on desktop and touch |
| 6 ProjectRow | Cursor feeds `mouseRef` | On touch the tile field deflects around the parked cursor; with no cursor active it does not |
| 7 ProjectExpanded | Tap opens nothing | Tap the expanded image on touch → no canvas appears, `canvasState.open === false` |
| 7 ProjectExpanded | Desktop click intact | Desktop click still routes exactly as before the change |
| 8 Archives | Latch recovers (D1) | Fast in→out→out over a row, then park: the cursor's transform must change on subsequent mouse moves, and `el.style.opacity` must not be left at `0` |
| 8 Archives | Aspect preserved (D2) | For a 4:3 and a 3:4 source, `uImgAspect / uPlaneAspect` and the first painted frame show no squash; `uPlaneAspect` never reports 340/440 |
| 8 Archives | Canvas uses available width (D2) | At 430px the canvas width exceeds 340 and is capped at the container |
| 8 Archives | Lifecycle (D3) | Hover a row, scroll the section out of view → canvas closes via the reverse `clipPath`, not an abrupt unmount; scrolling back in and hovering re-opens it |
| all | No context-budget regression | Count `document.querySelectorAll('canvas').length` in `#featured` and the archives surfaces before and after; unchanged |
| all | Suite green | `npx vitest run` — existing 167 must still pass, not just the new tests |

## 11. Assumptions made without confirmation

Recorded so they are visible and overridable rather than buried in the conversation.

1. **The hook and the structural test ship as one step (§9.2), not two.** The question of splitting them was put to the user and not answered before this spec was written. They are one step because the test is what proves the hook is used, and a hook without its test is the convention-only approach this spec exists to avoid. Splitting is a trivial plan-level change if the user prefers it.
2. **The 4s sleep timeout is a default, not a measured value** (§5). Tunable after it runs.
3. **The callout font is decided (§8.1): option A, a mobile-scoped `18vw`.** Resolved after measurement — the 2× proved unreachable. The `18vw` value is derived from four measured viewports and must be re-verified with `tests/perf/measure-callout.mjs` rather than trusted.
4. **The exemption list for the structural test is expected to be short** — the hero, plus any surface that genuinely has no cursor input. It is not enumerated here because the test discovers the actual set; an unexpectedly long list is itself a signal that the rule is being over-applied.

## 12. Out of scope

- **Hero** — exempt by the user's instruction. Not touched.
- Real second images for the gallery (still picsum placeholders).
- Redesigning the Archives `clipPath` sweep timings.
- The known pre-existing callout mask defects listed in `AGENT/EFFECTS.md` ("Known defects, deliberately NOT fixed").
- The gallery dissolve tuning (duration/easing) settled earlier.

## 13. Scope observation

This is eight steps across six effect sites and three Archives defects. The pieces are independent and the ordering in §9 makes any prefix of it a coherent state — but it is more than one sitting's work. The plan should be executed in at least two batches, with the suite green and a real browser check between them, rather than landed as one change.

The natural batch boundary is after §9.4: at that point the cursor model, its enforcement, and three consumers are done, and the remaining steps are site-by-site adoption of a mechanism that is already proven.
