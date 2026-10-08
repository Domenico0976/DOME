# Archives Video Transition — Correction Plan

Date: 2026-09-30
For: a fresh session with no memory of the previous one
Status: IMPLEMENTED AND VERIFIED. See "Outcome" at the end — the diagnosis in this document
was incomplete, and one section below is actively misleading. Read Outcome first.

## Why this document exists

A slide transition was built, reviewed by two critics, and reported working by every
test. It never ran. Visual verification was declared impossible and skipped for an
entire session. That turned out to be wrong: the blocker was a dev server that was
not running, not the assets and not the harness. This document hands over the working
verification setup so that never happens again, and records the one confirmed defect
that remains.

## How to run visual verification

> **The scripts referenced below were deleted on 2026-09-30 and are NOT recoverable** —
> `tests/perf/` was never committed. `verify-archives-visual.mjs` and `probe-canvas-frame.mjs`
> must be rewritten from the recipe here before this procedure can be run again.

```bash
# 1. dev server (must be running — its absence is what broke the last session)
npm run dev -- --port 5199 --strictPort

# 2. visual check
node tests/perf/verify-archives-visual.mjs
```

`playwright-core` is installed as a devDependency and drives the locally installed
Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`). No browser download
is required. The script prints section state, media readiness, canvas box, and
request/console failures, and writes `hover-row0.png`, `slide-mid.png`, `slide-end.png`
to `%TEMP%/opencode`.

If the preloader never clears, raise the `waitForFunction` timeout in the script
before concluding anything is broken. With a 60s budget the page boots fine.

## Hard constraints (carry these into any change)

- **NEVER run a git write command.** `AGENT/AGENTS.md`: "MAI GIT SENSO CONSENSO
  ESPLICITO". The user said "Non committare, lascia tutto nel working tree."
  Read-only git is fine. Everything stays uncommitted.
- Never `as any`, `@ts-ignore`, `@ts-expect-error`.
- Never delete or weaken a failing test to reach green.
- **Baseline: 236 tests / 26 files passing, `npm run build` clean.** Keep it there.
- The canvas box is fixed at 420x280 (3:2). Do not reintroduce viewport-derived or
  intrinsic-media sizing.
- Touch effects stay bound to the deliberate cursor grab via `useCursorGate`
  (`gateIsTouch` + `isAwake`). `isAwake` is a ref: read at point of use, never in a
  dependency array. The slide is content, not an effect, and stays ungated.

## Verified working (do not regress)

| Item | Evidence |
|---|---|
| B2 fixed 3:2 box | Browser measured `.pendulum-canvas` at exactly 420x280 |
| B1 effect gate | Wind snapped to zero while gated; CA phases behind `allowCA`; slide left ungated |
| Row choreography | Screenshot: hovered row 02 bold and shifted left, all others static |
| Video loads and plays | `alfly-test.mp4` readyState 4, 992x662, `paused: false`, t=1.38s |
| Media served | 200 for both mp4 and gif with correct content-type |
| No runtime errors | 0 request failures, 0 console errors on the archives route |

## Confirmed defect: the slide never executes

`src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx:711`

```js
if (!prevImage || isAnimatedImage(prevImage) || isAnimatedImage(gifPath || image)
    || videoPath || slideDir === 0 || !image || image === lastImageRef.current) {
  st.uniforms.uHasPrev.value = 0
  // ...
  return
}
```

`|| videoPath` forces an early return. Projects 01-03 all define `videoPath`
(`alfly-test.mp4`, `animaz-ubank.mp4`), and their `image` fields are `.gif`, which
also trips `isAnimatedImage`. So `uHasPrev` stays `0`, `sampleTransition` never has an
outgoing texture, and the transition is skipped for exactly the rows a visitor hovers
first.

Confirmed visually: 180ms after hovering a second row, the canvas shows one static
frame — no wipe, no split.

The clause is not arbitrary. `TextureLoader.load()` cannot load an MP4 and an animated
GIF is not a still frame, so skipping was a reasonable default when no alternative
existed. The alternative now exists.

### Removing the guard is necessary but NOT sufficient

The real obstacle is ordering, and it outranks the guard.

Two **separate effects** both run on a project change:

- the media effect (`:544` creates the `<video>`, **`:569` calls
  `uImage.value.dispose()`**), declared first
- the transition effect (`:700`, which is what would hand a texture to `uPrevImage`),
  declared second

React runs effects in declaration order, so by the time the transition effect could
hand the outgoing texture over, it was already disposed one effect earlier. The
`dispose()` at `:569` is the actual blocker.

Consequence for the plan: step 2 must **capture the outgoing texture reference before
the media effect disposes it** — for example keep a dedicated `outgoingTexRef` that the
media effect populates instead of destroying, and have the transition effect read from
that. Simply deleting `|| videoPath` and letting the existing `TextureLoader` path run
would load the outgoing `.gif` from `archives[prevIdx].image` as a fresh first frame,
which is a different thing from "the video frame that was on screen a moment ago" and
would reintroduce the very popping the design was chosen to avoid.

## Agreed design (user's decision, do not re-litigate)

- The **outgoing** video keeps playing through the transition, then resets.
- The **incoming** media always enters, and its video starts only once positioned.

This deliberately avoids a per-frame canvas snapshot of the outgoing frame.

## Implementation steps

Order matters here, and it is the reverse of how it looks. The ordering bug is step 1
because every other step is blocked behind it: while `:569` disposes the outgoing
texture one effect before the transition effect runs, no amount of guard-fiddling can
keep the outgoing frame alive.

The current media layer creates **one** video element per load
(`ArchiveHoverCanvas.jsx:544`) and disposes the previous texture on every change
(`:569` disposes `uImage.value`; `:575` calls `video.play()` immediately; `:726`
populates `uPrevImage` via `TextureLoader`).

1. **Stop destroying the outgoing texture — do this first.** The media effect runs
   before the transition effect, so it must hand the outgoing texture over instead of
   disposing it. Introduce a dedicated `outgoingTexRef` (plus a ref to the outgoing
   `<video>` element) that the media effect populates when it would otherwise call
   `uImage.value.dispose()`. Until this lands, steps 3 and 4 are unreachable and the
   transition will still show only the incoming frame.
2. **Incoming defers playback.** Create the element, wait for `loadeddata` so a real
   first frame exists, assign its texture to `uImage`, but do not `play()` until the
   transition's `onComplete`. Keep `muted` and `playsInline` set, or autoplay is
   blocked and `uHasImage` never rises.
3. **Outgoing plays through.** The transition effect reads `outgoingTexRef` into
   `uPrevImage` and leaves that `<video>` running, so the outgoing image animates
   during the slide. `uPrevImage` must accept a `VideoTexture`, not only a
   `TextureLoader` result — which means the `loader.load(...)` branch at `:722` has to
   become a branch, not the only path.
4. **Reset on completion.** In the timeline `onComplete`, dispose the outgoing element
   and its texture and clear `outgoingTexRef`; set `currentTime = 0` if the element is
   pooled. This is the user's "si resettano quando viene completata".
5. **Open the guard at line 711.** Only now remove `|| videoPath` and the two
   `isAnimatedImage(...)` clauses. Keep `slideDir === 0`, `!image` and the
   `lastImageRef` guard. Earlier than this and the transition runs with no outgoing
   texture, i.e. a brief flash of nothing.
6. **GIFs follow the same rule** via the existing `<img>` path: do not reset `src`
   mid-transition, release afterwards.

Suggested checkpoints: after steps 1-3, hover two video-backed rows and confirm with
`verify-archives-visual.mjs` that `slide-mid.png` shows **two different images** with a
moving boundary. If it shows one, step 1 did not take. Only after that should the guard
in step 5 be touched.

## Two risks to check, not to assume

- **Two simultaneous video decoders.** During each slide both videos decode. This is a
  real cost on low-end mobile, not a theoretical one. If it shows up, a frozen
  outgoing frame is the fallback — but that is the snapshot work this design was
  chosen to avoid, so say so rather than reverting silently.
- **Rapid hover leaks.** Moving across rows 0 -> 1 -> 2 quickly orphans outgoing
  videos. The existing `tr.tween.kill()` discards the timeline but does **not** free
  the video that timeline owned. Free it there or memory climbs.

## RESOLVED: the green frame is real video content

The canvas renders a flat dark green rectangle. This is **genuine rendered video**,
not the `uTint` fallback, so the shader is already sampling correctly and no second bug
hides behind it.

Evidence, from `tests/perf/probe-canvas-frame.mjs`: the composited canvas region is
screenshot-cropped at two instants while the video advances. Pixels differ —
61013 vs 73731 bytes, at video time 1.58s vs 4.65s. Identical bytes across that gap
would have meant a static tint.

**Method warning, because the first attempt got this wrong.** Reading the canvas with
`drawImage` + `getImageData` returns transparent black, because a WebGL context created
without `preserveDrawingBuffer` is cleared once the frame is composited. The first
version of the probe printed a confident `VERDICT: it is the uTint fallback` based on
`[0,0,0,0]` samples. That verdict was pure artefact. Compare composited screenshots,
never read the drawing buffer back.

`uTint` is a saturated cyan per the source, so a `[0,0,0,0]` reading was already
contradictory — that should have been the tell.

## Also unverified

- Wipe edge position and clamp-to-edge smear (need `slide-mid.png` to show an actual
  transition first).
- Whether the shader's double-`coverUv` fix holds visually. It is in place: the cover
  fit now happens exactly once in `main()` and `sampleTransition` receives an
  already-fitted UV. Do not let anyone "tidy" that function into calling `coverUv`
  itself.
- Font-weight interpolation cost. It is tweened over 0.25s, shorter than the 0.6s
  transform, precisely because it re-runs layout on every step.

---

# Outcome (added after implementation)

All six implementation steps landed, plus a seventh that this document missed.

## The diagnosis here was incomplete

The confirmed defect in this document - `|| videoPath` and the two `isAnimatedImage`
clauses at line 711 - was real, and removing it was necessary. It was **not** the reason the
slide never ran. There was a second, independent blocker upstream of it:

`Archives.jsx` fills `rowVisibleRef` from a ScrollTrigger configured as
`{ start: 'top 90%', once: true, onComplete: () => rowVisibleRef.current.add(i) }`.

`once: true` makes ScrollTrigger kill itself as soon as the first `onEnter` fires, so the
trigger's own `onComplete` never ran. `rowVisibleRef` stayed **permanently empty** - confirmed
by logging it: `visibleSet: []` with the table fully scrolled into view.

`handleRowEnter` gates `prevImage`/`slideDir` on `rowVisibleRef.current.has(index)`, so it
always took the else branch: `prevImage = null`, `slideDir = 0`. The transition effect
early-returns on `slideDir === 0`. **The slide could not run for anyone, ever, no matter what
line 711 allowed.** Fixed by using `onEnter` instead of `onComplete`.

Fixing only line 711 would have left the feature dead and the tests green.

## What the plan's step 1 wording missed

"Introduce an `outgoingTexRef` that the media effect populates instead of destroying" is not
sufficient on its own. The outgoing `<video>` had to be handed over whole, not just its
texture:

- The cleanup also ran `pause()`, `removeAttribute('src')` and `remove()`. A `VideoTexture`
  whose element has been emptied renders black, so handing over `tex` alone was pointless.
- The element's rAF pump set `needsUpdate` behind a `cancelled` flag and a **shared**
  `animatedRafRef`. The cleanup killed it, so a surviving element would have frozen on its
  last frame - defeating "outgoing keeps playing". A shared slot also meant the incoming
  video's cleanup cancelled the outgoing pump. Each entry now owns its raf handle.
- Three separate dispose sites (`video canplay`, `img.onload`, `loader.load` callback) all ran
  `if (uImage.value) uImage.value.dispose()`. Once the outgoing texture *is* the texture in
  `uImage` - which it stays until the incoming swaps it - the incoming's callback disposed the
  frame the slide was animating. All three now check ownership first.
- Nulling `uImage`/`uHasImage` at handoff, the obvious way to dodge that, makes the shader's
  alpha (`gl_FragColor.a == uHasImage`) go 0 and blanks the canvas for the whole incoming load.
  `uImage` is deliberately left pointing at the outgoing texture instead.

Also added, because the plan flagged them as risks: `abortSlide()` for an incoming that fails
to load, and release on `tween.kill()` so a rapid hover cannot orphan a video.

## Verification

The visual verification section above is correct but incomplete. Two things it does not tell
you, both of which produce convincing false negatives:

1. **Scroll with real wheel events, not `window.scrollTo`.** The page runs a Lenis smooth
   scroller; a programmatic jump never trips the ScrollTriggers, so `rowVisibleRef` stays
   empty and every probe measures a transition effect that early-returned.
2. **Move the mouse in one jump per row.** `locator.hover()` re-scrolls between calls, so the
   cursor sweeps across intermediate rows and fires a row change for each. Every intermediate
   transition claims the handoff, so the change actually under test arrives with nothing left
   to claim.
3. `locator.hover()` on the *second* row also re-scrolls, which moves the canvas. The canvas
   rect must be re-measured per capture; a stale rect lands on the page background and every
   frame reads as "no transition".

Probe statuses, as of 2026-09-30: `probe-static-wipe.mjs` (whole-frame diff - reliable only
when the incoming is static; both sides playing makes every frame differ), `probe-slide-eyeball.mjs`
(saves frames to look at; the split score alone is not proof, since one image can have its own
vertical gradient) and `probe-hover-leak.mjs` (leak check) all existed and passed, then were
deleted with the rest of `tests/perf/`. They were never committed, so they are gone: rewrite them
from the descriptions above before re-verifying.

Deliberately not to be rewritten: any coverage/centroid classifier over these two images. Both
are dark and their means sit ~37 apart, so band-level misclassification swamps every average.
One version of that reported a confident `TRANSITION RUNS` that was pure artefact.

## Results

- `npm test` - 26 files / 236 tests passing (baseline held).
- `npm run build` - clean.
- `verify-archives-visual.mjs` - video `readyState 4`, `paused: false`, `t=1.38`, canvas
  420x280, 0 request failures, 0 console errors.
- Static -> static (row 03 -> 04): 8 intermediate frames spanning 12-479ms.
- Video -> static (row 01 -> 04): confirmed by eye. At 108ms the CA fringing shows the timeline
  running; at 170ms the incoming photo enters from below with the outgoing video displaced
  above it; by 285ms the boundary has swept to the top. Direction matches the shader:
  `uSlideDir=+1` gives `takeIncoming = suv.y < ease`, and UV y=0 is the bottom.
- Rapid hover: video count peaks at 2 (one incoming, one outgoing) mid-sweep and returns to 0.
  The plan's leak risk does not materialise.

## Still unverified

- Wipe edge quality and clamp-to-edge smear - visible in the saved frames but not asserted.
- Two simultaneous video decoders during a slide (the plan's other risk). Rows 01-03 all point
  at the same two files, so a visitor moving between them decodes the same source twice.
