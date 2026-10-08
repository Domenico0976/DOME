# Archives Gallery Canvas — Design Spec

Date: 2026-09-30
Status: approved by user 2026-09-30; reviewed by Momus (OKAY, no blockers)
Scope: `src/components/Archives.jsx`, `src/components/ArchiveHoverCanvas/*`, `src/components/MobileCanvas.jsx`, `src/styles/global.css`

## Intent

Rework the Archives hover canvas so that:

1. Opening and closing use correct animation maths (no mid-flight box correction, no competing tweens).
2. Images read as a **slider** — the section's projects form one gallery and the canvas slides between them on row change.
3. Every canvas effect is driven **only** by the deliberate mobile cursor grab.
4. The canvas closes cleanly when the archives section leaves the viewport, and never reopens without a fresh interaction.
5. Desktop rows get the new hover choreography.

Existing effects, the pendulum, the custom cursor and the section layout are all retained.

## Decisions taken (user-confirmed)

| Question | Decision |
| --- | --- |
| Slider scope | The whole section is one gallery; all its projects are the slider's entries. No per-project media array, no data-model change. |
| Reopen after scroll-out | Nothing reopens automatically, on any platform. A fresh interaction on a project is required. |
| Slider implementation | Fix the WebGL transition. No DOM strip, no texture array. |
| Canvas box | Fixed 3:2, identical for every project, viewport-clamped width on mobile. |
| Effects on touch | Bound to the deliberate cursor grab only. |

### Why the shader and not a DOM strip

The reference template builds the slider from a `position: fixed` wrapper with `overflow: hidden` and N full-height images offset by `yPercent`. Our canvas is opaque, so only one image is ever visible at a time — a DOM strip and a shader transition would look identical while being far more expensive. A DOM layer would also fight the pendulum, which rotates the canvas element, and would bypass the wind/aberration/tint effects applied to the visible image. The shader path is the only one that keeps those effects.

## Verified facts

Media of the first three projects, measured with `ffprobe`:

| File | Dimensions | Aspect |
| --- | --- | --- |
| `alfly-test.gif` | 1620x1080 | 1.500 |
| `alfly-test.mp4` | 992x662 | 1.499 |
| `Animaz-ubank.gif` | 1080x720 | 1.500 |
| `Animaz-ubank.mp4` | 992x662 | 1.499 |

Every media file the archive shows is 3:2 landscape. This is an invariant of the data, not an assumption.

Row CSS lives in `src/styles/global.css`; `.archives-table` rules appear at lines 704, 718, 729, 744, 749. Line 729 currently forces the whole table to `font-weight: 600` and line 716 sets `font-weight: 500` on a narrower scope. The exact selectors must be read before editing; they are not reproduced here because the current file has not been read in full.

## Already done in this change (B1, B2)

Both defects were diagnosed from source and fixed; they are recorded here because the rest of the spec depends on them.

**B2 — the open-time jerk.** `PendulumCanvas.jsx` derived `MAX_W` and `MAX_H` from the viewport *independently*, producing 340x440 (aspect 0.77, portrait) on desktop while the media is 3:2 landscape. `fitSize()` then computed 340x226.7, so the canvas mounted portrait and GSAP-tweened down on every open. That collapse was the jerk. The box is now a single fixed 3:2 pair (420x280), no longer derived from intrinsic media size, with the sizing effect no longer depending on `image` / `videoPath` / `gifPath`. On mobile the width is clamped to the viewport and the height is derived from the ratio, so the clamp cannot violate it.

**B1 — aberration on a clean tap.** Two independent paths fired without a grab:

- The rAF wind loop. A tap moves the cursor within one frame while `prevCursor` still holds the pre-tap position, so the velocity delta saturates `rawStr` and the shader's `caBase` reaches its 0.09 cap.
- The slide-transition timeline, which animates `uCAOffsetR/G/B` explicitly.

Both are now gated behind the existing `useCursorGate` (`gateIsTouch` + `isAwake`), threaded from `Archives.jsx` into `ArchiveHoverCanvas`. The gate is read **inside** the rAF loop because `isAwake` is a ref that changes without a re-render. While gated, wind is **snapped** to zero rather than decayed — an EMA tail would leave the aberration on screen for frames after the gate closed. The CA timeline phases are wrapped in `if (allowCA)`; the slide tween is deliberately left outside it, because the slide is content rather than an effect and must still run on a tap. Desktop is unaffected: `gateIsTouch` defaults to `false`.

## The actual slider defect

This is the core finding and it is worse than a blend-mask tweak.

In the fragment shader (`ArchiveHoverCanvas.jsx`, `main()`):

- Lines 131-149 compose the transition into `col` by choosing between `prevCol` and `nextCol`.
- Lines 158-160 then **overwrite `col` entirely**:

```glsl
col.r = uHasImage > 0.5 ? texture2D(uImage, baseUv + vec2(caR, 0.0)).r : uTint.r;
col.g = uHasImage > 0.5 ? texture2D(uImage, baseUv + vec2(caG, 0.0)).g : uTint.g;
col.b = uHasImage > 0.5 ? texture2D(uImage, baseUv + vec2(caB, 0.0)).b : uTint.b;
```

Every channel is re-sampled from `uImage` — the incoming image only. `uPrevImage` never reaches the framebuffer. **The outgoing image is never displayed, so no slide is possible regardless of the mask.** The chromatic aberration is the only part of the transition that survives this assignment, which is why it is the only part that has been visible.

The blend mask on lines 144-145 is separately wrong: `1.0 - abs(uv.y - 0.5) * 2.0` is a diamond centred on the horizontal midline, so even if the composite survived it would cross-dissolve at the centre rather than wipe along a moving edge.

## Design

Three work units with materially different risk, to be planned as separate tasks with
their own verification rather than as one change:

| Unit | File | Risk |
| --- | --- | --- |
| 1. Transition restructure | `ArchiveHoverCanvas.jsx` (shader) | High — no visual verification available here |
| 2. Viewport latch lifecycle | `Archives.jsx`, `MobileCanvas.jsx` | Medium — state machine, two platforms |
| 3. Row choreography | `global.css`, `Archives.jsx` | Low — additive CSS plus a class |

A fourth candidate, animation ownership, was investigated and **withdrawn as a code
change**; see section 3.

Unit 2 lands before unit 1, because the latch changes when the canvas may be visible
and unit 1 is easier to judge on a canvas that is not also opening and closing
underneath it. Unit 3 is independent of both.

### 1. Restructure the transition sampling

The slide must become a **function of UV**, so the aberration can be applied to its result rather than replacing it.

Extract the transition into a helper in the fragment shader:

```
vec3 sampleTransition(vec2 uv)
```

which takes a UV, computes `coverUv` for that UV, applies the `uTransition` / `uSlideDir` slide, and returns the composited colour. Then:

- the resting frame is `sampleTransition(baseUv)`
- each aberration channel is `sampleTransition(baseUv + vec2(caX, 0.0))`

This costs three evaluations of the transition per fragment instead of one, which is the real price of having both a slide and a channel split. That cost is accepted deliberately: the alternative is a visible aberration with no visible slide, which is the current state.

The composite itself must select on a **hard edge** travelling along the slide axis, not on a radial distance from the midline. Each texture is sampled with its own offset; out-of-range sampling is clamped to edge, so the smear is confined to the frame where a texture is more than one screen away, which the edge selection immediately covers.

The timeline in JS keeps its three phases — CA split, slide, CA convergence — and `uSlideDir` continues to supply direction. `slideDirRef` in `Archives.jsx` already derives ±1 from whether the hovered index increased or decreased, so direction needs no new logic.

**Not verifiable here.** Media assets do not load in the available browser harness, so the wipe cannot be visually confirmed. The clamp-to-edge smear and the hard-edge position are the two things to check on a real device.

### 2. Viewport lifecycle

Add a `latchedClosed` flag, scoped to "closed because the section left the viewport", distinct from ordinary hover/tap state.

- Section leaves the viewport **while open** → set `latchedClosed`, run the close transition.
- Section re-enters the viewport → **nothing happens**. The flag survives the return. This holds on desktop, tablet and mobile alike.
- A **fresh** interaction clears the flag. Precisely: on desktop, the cursor entering
  a row *different from the one that was open*; on mobile, a new tap on any row. A
  pointer already resting on the same row does not count, and neither does any scroll,
  resize, or re-render. The existing `handleRowEnter` is the single place this is
  decided, so the flag is cleared there and nowhere else.

Clearing the latch only on a fresh interaction is what distinguishes this from simply re-deriving visibility from `sectionInView && hoveredRow`, which would reopen on scroll-back and was explicitly rejected.

**Mobile is the substantive part.** `MobileCanvas` is not viewport-aware today: it opens from `openCanvas()` and stays open until `closeCanvas()`. It needs the same `useInView` observation the section already has, wired to the same latch.

**The exit animation must be smooth.** This is a hard requirement, not a preference, and it constrains how a close interacts with an in-flight swap. Concretely:

- A close never freezes the canvas on a half-swapped frame. If a swap is running when the section leaves the viewport, the canvas resolves to a coherent image first (the swap completes, or it is resolved to the resting image) and *then* runs the close.
- The close is its own eased tween on opacity, not a `display: none` flip. A frame with `opacity: 1` and `display: none` is a visible pop, which is exactly the failure being ruled out.
- Opening and closing must read as the same motion in reverse, so the open and close share easing and duration. A close that is faster or differently curved than the open reads as a glitch rather than a reversal.

The same requirement applies on desktop, where the section leaving the viewport closes the cursor-driven canvas.

**Desktop** already derives `visible` from `!!hoveredRow && sectionInView` (see the `PendulumCanvas` and `ArchiveHoverCanvas` props in `Archives.jsx`). It needs the latch added so that `sectionInView` returning to `true` does not by itself reopen.

### 3. Open/close animation ownership

Metis originally suspected a second, independent contributor to the jerk: a double
writer on the canvas opacity. **This was checked and does not exist.** `ArchiveCursor`
writes `canvasOpacityRef.current.value` (its timeline, lines 223-227 and 327-331);
`PendulumCanvas`'s rAF tick *reads* that ref and writes `el.style.opacity`. Those are
two different targets in sequence, not two writers on one property.

This entire unit is **withdrawn**, including its `transformOrigin` follow-up. `place()` sets `transformOrigin: 'top center'` on the outer canvas while the inner wrapper uses
`center center`. That mismatch is real and would jump on a morph, but it was retained
"in scope only if the double writer is confirmed" — and the double writer is now
*disproved*, so the precondition can never be met and the item does not survive on
its own. It stays out of this change, recorded here only so the mismatch is not lost:
it is a plausible contributor to a future open-time jump report, and belongs with
whoever investigates that.

### 3. Desktop row choreography (Unit 3)

Per the confirmed design:

- all rows `font-weight: 500`
- hovered row's title `font-weight: 600`
- hovered row's content `translateX(-12px)`
- all non-hovered rows `translateX(12px)` and `opacity: 0.8`
- one shared easing for movement, opacity and weight

Note this **inverts** the reference template, which dims the *hovered* row to `opacity: 0.5` and moves the title left / paragraph right. Ours moves the whole hovered row left and dims everything else.

Implementation constraint: "all non-hovered rows shift right" cannot be expressed in CSS alone. `tr:hover ~ tr` only matches following siblings, so rows *above* the hovered one would be missed. The hovered index is already React state in `Archives.jsx`, so a class driven off that state is the mechanism; sibling selectors alone are not sufficient.

The whole row choreography is driven by a **GSAP timeline**, not CSS transitions. The hovered row tweens to `font-weight: 600`; the non-hovered rows tween to `translateX(12px)` + `opacity: 0.8`; the hovered row's content tweens to `translateX(-12px)`. One timeline per state change, so transform, opacity and weight all advance on a single clock — that is what "homogeneous easing" actually requires, and it is more robust than three independent CSS transitions landing on slightly different frames.

On the layout cost: GSAP does not make `font-weight` compositor-friendly. It tweens the numeric value the same way CSS would, and each step still re-runs layout. Using GSAP solves the *synchronisation* problem, not the reflow cost. The reflow is bounded and short, and 500→600 on a handful of table cells is small — but if it measures badly on a real low-end device, the honest fallback is to keep weight on the same timeline but let it step, and say so rather than silently dropping the interpolation.

## Testing

| Requirement | Test |
| --- | --- |
| Slide is not overwritten by the aberration block | The shader's composite must feed the channel split; assert no channel is assigned from bare `uImage` inside the transition branch. |
| Hard edge, not a radial mask | Assert no `abs(uv.y - 0.5) * 2.0` selection remains. |
| Direction | `uSlideDir` of `+1` and `-1` produce opposite slide directions. |
| Latch closes on scroll-out | Section leaves viewport while open → closed. |
| Latch survives scroll-back | Section re-enters → still closed. |
| Reopen needs fresh interaction | Row enter / tap after a latch-close reopens. |
| No truncation mid-swap | Close during an in-flight swap leaves no half-swapped frame. |
| Row choreography | Hovered and non-hovered rows carry the expected weight, transform and opacity; rows *above* the hovered one are included. |
| B1 gate | Wind is zero and no CA phase runs while gated; desktop unaffected. |
| B2 box | Box identical across media, unchanged on project change, mobile clamp preserves 3:2. |

All 219 existing tests must stay green. B1 and B2 already carry structural tests.

## Out of scope

- Any change to the pendulum physics, the wind model, the tint, or the custom cursor's visual design.
- The hero.
- The B4 gif/video stretch hypothesis. The box is now fixed at 3:2 and the shader cover-fits, so the sizing half of that concern is addressed; whether a remaining stretch exists cannot be determined without assets that load.
- Any data-model change. The section gallery reuses the existing project list.

## Open questions for the user

None. Both trade-offs have been answered and folded into the design above:

1. **Font-weight** is animated with GSAP on hover, alongside the transform and opacity
   tweens, on one timeline — not as a CSS transition.
2. **The exit animation is smooth**, which resolves close-during-swap: the canvas
   resolves to a coherent image before closing, and open and close share easing and
   duration so the close reads as the open in reverse.

The row easing is no longer tied to the `--t-micro` / `--ease-out` CSS tokens. Those
remain in use for the existing row background, but the new choreography is a GSAP
timeline and owns its own duration and curve.
