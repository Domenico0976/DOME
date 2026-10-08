# Archives Gallery Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Archives canvas slide between projects as a real gallery, close cleanly when the section leaves the viewport, and animate the desktop rows.

**Architecture:** Three independent units. The slider is a fragment-shader restructure: the transition becomes a UV function so the chromatic aberration is applied to the composited result instead of overwriting it. The viewport lifecycle adds a latch in the shared cursor hook so both the desktop and mobile canvases honour it across the portal boundary. Row choreography is one GSAP timeline per state change driven off the existing hovered index.

**Tech Stack:** React 18, three.js, GSAP 3, Vitest, jsdom.

## Global Constraints

- **NEVER run a git write command.** No `git add`, `git commit`, `git stash`, `git checkout`, `git restore`, no branch or worktree operations. `AGENT/AGENTS.md` states "MAI GIT SENSO CONSENSO ESPLICITO"; the user has said "Non committare, lascia tutto nel working tree." Every task below ends by **leaving changes in the working tree**, not by committing. Read-only git (`git status`, `git diff`, `git log`) is permitted for self-review.
- **Never** use `as any`, `@ts-ignore`, `@ts-expect-error`.
- **Never** delete or weaken a failing test to reach green.
- All 219 existing tests must stay green throughout.
- The canvas box is **fixed at 420x280 (3:2)**. Do not reintroduce viewport-independent width/height derivation or any intrinsic-media sizing.
- Effects on touch devices are bound to the deliberate cursor grab via the existing `useCursorGate` (`gateIsTouch` + `isAwake`). Do not add a second, parallel gating mechanism.
- `isAwake` is a ref. Read it at the point of use, never in a dependency array.
- Test commands: `npm test` (vitest run), `npm run build` (vite build).
- **Media assets do not load in this harness.** Anything visual cannot be verified here. Structural and behavioural tests are the only available evidence, and the plan does not pretend otherwise.

---

## File Structure

| File | Responsibility after this change |
| --- | --- |
| `src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx` | Owns the transition shader. The slide becomes a UV function; aberration reads from it. |
| `src/hooks/useArchiveCursor.js` | Owns the shared canvas-open state **and** the new `latchedClosed` flag, so desktop and mobile share one source of truth across the portal. |
| `src/components/Archives.jsx` | Row hover entry, the only place a fresh interaction is detected. Clears the latch. |
| `src/components/MobileCanvas.jsx` | Reads the latch; runs a smooth close instead of an instant unmount. |
| `src/styles/global.css` | Row base weight 500; GSAP owns the rest. |
| `tests/structure/archivesLatchedClose.structure.test.js` | New — proves the latch exists and is cleared in exactly one place. |
| `tests/structure/transitionShader.structure.test.js` | New — proves the aberration no longer overwrites the composite. |
| `tests/components/ArchiveRows.choreography.test.jsx` | New — proves hovered/non-hovered states including rows *above* the hovered one. |

`src/components/ArchiveCursor.jsx` and the `transformOrigin` mismatch are **out of scope** — see spec section 3.

---

## Task 1: Viewport latch lifecycle

Lands first. The latch changes when the canvas may be visible, so the shader work in Task 2 is easier to judge once this is settled.

**Files:**
- Modify: `src/hooks/useArchiveCursor.js`
- Modify: `src/components/Archives.jsx`
- Modify: `src/components/MobileCanvas.jsx`
- Test: `tests/structure/archivesLatchedClose.structure.test.js`

**Interfaces:**
- Consumes: existing `useCursorGate()` returning `{ isTouch, isAwake }`; existing `useInView` used by `Archives.jsx`.
- Produces: `useArchiveCursor()` additionally returns `{ latchedClosed, setLatchedClosed, clearLatchedClosed }`. `latchedClosed` is a **ref** (`.current`), not state — it must be readable inside rAF and event handlers without forcing a re-render, matching how `isAwake` already works in this codebase.

- [ ] **Step 1: Write the failing structural test**

Create `tests/structure/archivesLatchedClose.structure.test.js`:

```js
// @vitest-environment node
// A canvas closed because the archives section left the viewport must not reopen on
// scroll-back. Re-deriving visibility from `sectionInView && hoveredRow` would reopen
// it, and the user explicitly rejected that: a fresh interaction is required, on every
// platform.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')
const hook = read('src/hooks/useArchiveCursor.js')
const archives = read('src/components/Archives.jsx')
const mobile = read('src/components/MobileCanvas.jsx')

describe('viewport latch', () => {
  it('the latch lives in the shared hook, not in either canvas', () => {
    // Archives and MobileCanvas live on opposite sides of a portal, so a ref held in
    // either component cannot be read by the other. The shared hook is the only seam.
    expect(hook).toMatch(/latchedClosed/)
    expect(hook).toMatch(/clearLatchedClosed/)
  })

  it('the latch is a ref, not state', () => {
    // Reading it inside rAF and gesture handlers must not force a re-render.
    expect(hook).toMatch(/latchedClosed\s*=\s*useRef\(false\)|useRef\(false\)[^\n]*latchedClosed/)
  })

  it('a fresh row interaction clears the latch, in exactly one place', () => {
    const clears = archives.match(/clearLatchedClosed\s*\(/g) || []
    expect(clears.length, 'latch must be cleared from exactly one call site').toBe(1)
    expect(archives).toMatch(/clearLatchedClosed\s*\(\s*\)/)
  })

  it('the clear is gated on a genuinely fresh interaction', () => {
    // The spec requires a row *different* from the one the latch closed on. A blanket
    // clear would wrongly reopen when the user scrolls away and re-enters the same row.
    expect(archives).toMatch(/if\s*\(\s*isFreshInteraction\([^)]*\)\s*\)\s*clearLatchedClosed\s*\(\s*\)/)
    expect(hook).toMatch(/isFreshInteraction/)
    // Desktop compares against the row the latch recorded; mobile accepts any tap.
    expect(hook).toMatch(/rowIndex\s*!==\s*latchedRowRef\.current/)
  })

  it('latch participates in the desktop visibility derivation', () => {
    expect(archives).toMatch(/!latchedClosed\.current/)
  })

  it('the mobile canvas honours the latch', () => {
    expect(mobile).toMatch(/latchedClosed/)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/structure/archivesLatchedClose.structure.test.js`
Expected: FAIL — `latchedClosed` not found.

- [ ] **Step 3: Add the latch to the shared hook**

In `src/hooks/useArchiveCursor.js`, alongside the existing canvas-open state, add:

```js
  // True only when the canvas was closed because the archives section left the
  // viewport. Distinct from ordinary hover/tap state and deliberately sticky: it
  // survives the section scrolling back into view, so the only way out is a fresh
  // interaction on a project.
  const latchedClosed = useRef(false)
  // Which row was open when the latch was set. The spec requires a fresh interaction
  // to mean a *different* row, so re-entering the same row after scrolling away and
  // back must NOT clear the latch.
  const latchedRowRef = useRef(null)

  const setLatchedClosed = useCallback((rowIndex) => {
    latchedClosed.current = true
    latchedRowRef.current = rowIndex ?? null
  }, [])
  const clearLatchedClosed = useCallback(() => {
    latchedClosed.current = false
    latchedRowRef.current = null
  }, [])
  // True when entering `rowIndex` counts as a fresh interaction: any tap on mobile,
  // and on desktop only a row other than the one the latch closed on.
  const isFreshInteraction = useCallback((rowIndex) => {
    if (!latchedClosed.current) return true
    if (!isMobile) return rowIndex !== latchedRowRef.current
    return true
  }, [isMobile])
```

Return them from the hook alongside the existing values:

```js
  return {
    // ...existing returns unchanged
    latchedClosed,
    latchedRowRef,
    setLatchedClosed,
    clearLatchedClosed,
    isFreshInteraction,
  }
```

- [ ] **Step 4: Run it and confirm the hook assertions pass**

Run: `npx vitest run tests/structure/archivesLatchedClose.structure.test.js`
Expected: still FAIL, but now only on the `Archives.jsx` and `MobileCanvas.jsx` assertions. That is the correct partial state.

- [ ] **Step 5: Set the latch when the section leaves the viewport, and clear it on fresh interaction**

In `src/components/Archives.jsx`, destructure the new values from the existing `useArchiveCursor()` call (line ~106):

```js
  const {
    isMobile, openCanvas, cursorRef, setCursor,
    latchedClosed, setLatchedClosed, clearLatchedClosed, isFreshInteraction,
  } = useArchiveCursor()
```

Add an effect next to the existing `sectionInViewRef` sync (line ~114). `hoveredRow` alone is the open signal, so no mirrored ref is needed:

```js
  // Latch the close when the section leaves the viewport while open, remembering which
  // row was showing. The latch is NOT cleared here: `sectionInView` flipping back to
  // true must not reopen the canvas.
  useEffect(() => {
    if (!sectionInView && hoveredRow) setLatchedClosed(indexOfRow(hoveredRow))
  }, [sectionInView, hoveredRow, setLatchedClosed])
```

where the row index is derived from the hovered row itself:

```js
  const indexOfRow = (row) => archives.findIndex((a) => a.num === row?.num)
```

Clear the latch in `handleRowEnter`, gated on a genuinely fresh interaction, **before** the existing touch gate — a deliberate grab on a touch device is a fresh interaction and must reopen:

```js
  const handleRowEnter = (e, row, index) => {
    if (isFreshInteraction(index)) clearLatchedClosed()
    if (gateIsTouch && !isAwake.current) return
    // ...existing body unchanged
```

This is what distinguishes the spec's "entering a row *different* from the one that was open" from a blanket clear: scrolling away with row 3 open and then re-entering row 3 leaves the latch set.

Include the latch in the desktop visibility derivation at line ~322 and ~339:

```jsx
  visible={!!hoveredRow && sectionInView && !latchedClosed.current}
```

Apply the same expression to both the `PendulumCanvas` and the `ArchiveHoverCanvas` `visible` props.

- [ ] **Step 6: Run it and confirm the Archives assertions pass**

Run: `npx vitest run tests/structure/archivesLatchedClose.structure.test.js`
Expected: only the `MobileCanvas` assertion still FAILs.

- [ ] **Step 7: Make the mobile canvas honour the latch with a smooth close**

In `src/components/MobileCanvas.jsx`, read the latch from `useArchiveCursor()` and gate the rendered canvas. The mobile canvas must not unmount instantly: resolve any in-flight swap to a coherent image first, then fade.

```js
  const { latchedClosed, setLatchedClosed } = useArchiveCursor()
  const closingRef = useRef(false)
  const [resolvedOpen, setResolvedOpen] = useState(canvasOpen)

  // Smooth close: never drop to a hidden node on the same frame the section leaves
  // the viewport. Wait for any in-flight swap to land on a coherent image, then fade.
  useEffect(() => {
    if (!latchedClosed.current || !canvasOpen || closingRef.current) return
    closingRef.current = true
    const settle = () => {
      setResolvedOpen(false)
      // Match the open tween's duration and easing so the close reads as the open
      // reversed, rather than as a pop.
      gsap.to(opacityRef.current, {
        value: 0,
        duration: OPEN_DURATION,
        ease: OPEN_EASE,
        onComplete: () => setCanvasOpenRef(false),
      })
    }
    // If a swap is running, let it finish rather than freezing a half-swapped frame.
    if (swapRunningRef.current) { onSwapSettled(settle) } else { settle() }
  }, [latchedClosed, canvasOpen, ...])
```

Where `OPEN_DURATION` and `OPEN_EASE` are the **same** constants the open path already uses — extract them to module scope in `MobileCanvas.jsx` if they are currently inline literals, so open and close cannot drift apart:

```js
// Shared by open and close so the two always read as the same motion in reverse.
const OPEN_DURATION = 0.35
const OPEN_EASE = 'power2.out'
```

Render from `resolvedOpen`, not the raw open state.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: 219 existing + 6 new = 225 passed, 24 files.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 10: Leave in the working tree**

Run: `git status --short` and `git diff --stat` — read-only, to self-review. Report the changed files. **Do not commit.**

---

## Task 2: Transition shader restructure

The highest-risk unit. No visual verification is possible in this harness; the tests below are structural and behavioural only, and the plan states that limit rather than papering over it.

**Files:**
- Modify: `src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx` (fragment shader `main()`, lines ~128-161)
- Test: `tests/structure/transitionShader.structure.test.js`

**Interfaces:**
- Consumes: nothing from Task 1. Independent.
- Produces: a GLSL function `vec3 sampleTransition(vec2 uv)` declared before `main()` in the fragment shader. Referenced only inside `main()`.

- [ ] **Step 1: Write the failing structural test**

Create `tests/structure/transitionShader.structure.test.js`:

```js
// @vitest-environment node
// The slide transition was dead code. main() composed prev/next into `col`, then
// immediately reassigned col.r/g/b by sampling `uImage` alone — so the outgoing image
// never reached the framebuffer and no mask could make a slide appear. The aberration
// was the only part of the transition that survived that assignment, which is why it
// was the only part ever visible.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx'), 'utf8')

describe('transition shader', () => {
  it('the slide is a UV function', () => {
    expect(src).toMatch(/vec3\s+sampleTransition\s*\(\s*vec2\s+\w+\s*\)/)
  })

  it('aberration reads from the composite, never from a bare image', () => {
    // The exact defect: channel assignment sampling uImage outside sampleTransition.
    const main = /void\s+main\s*\(\s*\)\s*\{[\s\S]*\n\}/.exec(src)
    expect(main, 'main() not found').not.toBeNull()
    const body = main[0]
    const reassign = body.match(/\bcol\.[rgb]\s*=\s*[^;]*texture2D\(\s*uImage\s*,/g) || []
    expect(reassign.length,
      'a channel is still sampled straight from uImage, discarding the composite').toBe(0)
  })

  it('the radial diamond mask is gone', () => {
    // 1.0 - abs(uv.y - 0.5) * 2.0 cross-dissolves at the horizontal midline; it can
    // never produce an edge travelling along the slide axis.
    expect(src).not.toMatch(/abs\(\s*\w+\.y\s*-\s*0\.5\s*\)\s*\*\s*2\.0/)
  })

  it('selection is a hard edge driven by uSlideDir', () => {
    expect(src).toMatch(/uSlideDir\s*>\s*0\.0/)
    expect(src).toMatch(/1\.0\s*-\s*ease/)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/structure/transitionShader.structure.test.js`
Expected: FAIL on all four assertions.

- [ ] **Step 3: Add `sampleTransition` above `main()`**

In the fragment shader source, immediately before `void main()`:

```glsl
// The transition as a function of UV, so the chromatic aberration can be applied to
// its result rather than replacing it. Cost: three evaluations per fragment (one per
// channel) instead of one. That is the price of having both a slide and a split.
vec3 sampleTransition(vec2 uv) {
  vec2 suv = coverUv(uv, uImgAspect, uPlaneAspect);

  // No outgoing image, or the transition has finished: a single resting sample.
  if (uHasPrev < 0.5 || uTransition >= 0.999 || uTransition < 0.001) {
    return uHasImage > 0.5 ? texture2D(uImage, suv).rgb : uTint.rgb;
  }

  float t = uTransition;
  float ease = t * t * (3.0 - 2.0 * t);

  vec2 prevUv = clamp(suv + vec2(0.0, ease * uSlideDir), 0.0, 1.0);
  vec2 nextUv = clamp(suv + vec2(0.0, (ease - 1.0) * uSlideDir), 0.0, 1.0);

  vec3 prevCol = texture2D(uPrevImage, prevUv).rgb;
  vec3 nextCol = uHasImage > 0.5 ? texture2D(uImage, nextUv).rgb : uTint.rgb;

  // Hard edge travelling along the slide axis. uSlideDir +1: the incoming image enters
  // from below, so the boundary sweeps top -> bottom and the incoming image owns
  // y < ease. uSlideDir -1 is the exact mirror. At ease 0 the outgoing image fills the
  // frame; at ease 1 the incoming image does.
  bool incomingFromBelow = uSlideDir > 0.0;
  float p = incomingFromBelow ? ease : 1.0 - ease;
  bool takeIncoming = incomingFromBelow ? (suv.y < p) : (suv.y > p);
  return takeIncoming ? nextCol : prevCol;
}
```

The `clamp(..., 0.0, 1.0)` keeps sampling inside the texture, so a displaced image smears at its edge for the frame it is more than one screen away — and the hard-edge selection covers that region in the same frame.

- [ ] **Step 4: Rewrite `main()` to read from it**

Replace the compose block (lines ~131-149) and the aberration block (lines ~151-160) with:

```glsl
  void main() {
    vec2 baseUv = coverUv(vDispPos, uImgAspect, uPlaneAspect);

    // True channel split: R leads and B trails proportionally to the deform, G stays
    // anchored (plus the transition offsets). Equal offsets = clean image.
    float caBase = min(vDeformation * 0.45, 0.09);
    float caR = caBase + uCAOffsetR;
    float caG = uCAOffsetG;
    float caB = uCAOffsetB - caBase;

    // Each channel is the slide, sampled at its own horizontal offset. The outgoing
    // image survives into the frame because the composite lives inside the function.
    vec3 col = sampleTransition(baseUv + vec2(caR, 0.0));
    col.g = sampleTransition(baseUv + vec2(caG, 0.0)).g;
    col.b = sampleTransition(baseUv + vec2(caB, 0.0)).b;
```

Keep the existing alpha line below it (`gl_FragColor = vec4(col, uHasImage);`) unchanged — that was defect B3 and must not regress.

- [ ] **Step 5: Run the structural test**

Run: `npx vitest run tests/structure/transitionShader.structure.test.js`
Expected: 4 passed.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 225 + 4 = 229 passed, 25 files.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exit 0. A GLSL compile error surfaces here even though it cannot be seen in the harness — treat a clean build as the only shader check available.

- [ ] **Step 8: Record what could not be verified**

State plainly in the hand-off that the wipe, the hard-edge position and the clamp-to-edge smear were **not visually confirmed**, because media assets do not load in this harness. Name them as the three things to check on a real device. Do not describe the shader as verified.

- [ ] **Step 9: Leave in the working tree**

`git status --short`, `git diff --stat`. **Do not commit.**

---

## Task 3: Desktop row choreography

Independent of Tasks 1 and 2.

**Files:**
- Modify: `src/components/Archives.jsx` (row markup and a GSAP effect)
- Modify: `src/styles/global.css` (remove the blanket `font-weight: 600`, set base 500)
- Test: `tests/components/ArchiveRows.choreography.test.jsx`

**Interfaces:**
- Consumes: the existing `hoveredRow` state in `Archives.jsx` (already set by `handleRowEnter` / cleared on leave).
- Produces: a `data-hovered="true"` attribute on the hovered `<tr>` and `data-hovered="false"` on the rest, plus a GSAP timeline in a `useLayoutEffect` keyed on `hoveredRow`. No new props, no new files.

- [ ] **Step 1: Write the failing test**

Create `tests/components/ArchiveRows.choreography.test.jsx`. Follow the mounting and mocking style of the existing `tests/components/FeaturedGallery.dissolve.test.jsx`.

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Archives from '../../src/components/Archives.jsx'

// Rows are driven off the hovered index in React state, not off CSS sibling selectors:
// `tr:hover ~ tr` matches only following siblings, so rows ABOVE the hovered one would
// never shift right. This test asserts on the markup attribute, which is what makes
// the above-the-hovered rows reachable at all.
describe('archives row choreography', () => {
  it('marks exactly the hovered row and leaves the others unmarked', () => {
    render(<Archives />)
    const rows = screen.getAllByRole('row')
    const body = rows.filter((r) => r.tagName === 'TR')
    // No row starts hovered; the attribute must be present and false everywhere.
    for (const r of body) {
      expect(r.getAttribute('data-hovered')).not.toBeNull()
    }
  })
})
```

If a full `Archives` mount proves too heavy to set up (it portals, observes the viewport and constructs WebGL), fall back to a structural test over the source asserting the same three things: `data-hovered` is bound, the effect is keyed on the hovered index, and no `tr:hover ~ tr` selector is relied upon. Do not weaken the assertion to make a test pass.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/ArchiveRows.choreography.test.jsx`
Expected: FAIL — no `data-hovered` attribute.

- [ ] **Step 3: Fix the CSS base weight**

In `src/styles/global.css`, line 729 currently reads `.archives-table{font-weight: 600}`. That blanket rule is what the brief calls out as too heavy. Replace it with a 500 base scoped to the row cells, and read lines 704-760 before editing so the change lands on the right selector:

```css
/* Base weight for archive rows. The hovered title steps to 600 via the GSAP timeline
   in Archives.jsx, not via a CSS transition, so weight and movement share one clock. */
.archives-table tbody tr td,
.archives-table tbody tr td .archives-row__title {
  font-weight: 500;
}
```

- [ ] **Step 4: Bind the hovered attribute and the GSAP timeline**

In `src/components/Archives.jsx`, on each row element, bind the attribute from the existing state:

```jsx
        <tr
          key={row.num}
          data-hovered={hoveredRow?.num === row.num ? 'true' : 'false'}
          onMouseEnter={(e) => handleRowEnter(e, row, index)}
          ...
        >
```

Add a title class to the hovered-weight target, if not already present, so the timeline has a selector:

```jsx
          <span className="archives-row__title">{row.name}</span>
```

Then the timeline, next to the other effects in `Archives.jsx`:

```js
  // One timeline per state change so weight, transform and opacity advance on a single
  // clock. Three independent CSS transitions would land on slightly different frames,
  // which is what "homogeneous easing" rules out. GSAP does not make font-weight
  // compositor-friendly — each step still re-runs layout — but the reflow is bounded
  // and short for a handful of table cells.
  const rowTlRef = useRef(null)
  useLayoutEffect(() => {
    if (reduceMotion) return
    const rows = sectionRef.current?.querySelectorAll('tbody tr')
    if (!rows?.length) return
    const tl = gsap.timeline()
    rowTlRef.current?.kill()
    rows.forEach((row) => {
      const isHovered = row.getAttribute('data-hovered') === 'true'
      const title = row.querySelector('.archives-row__title')
      tl.to(row, {
        x: isHovered ? -12 : 12,
        opacity: isHovered ? 1 : 0.8,
        duration: 0.35,
        ease: 'power2.out',
      }, 0)
      if (title) {
        tl.to(title, {
          fontWeight: isHovered ? 600 : 500,
          duration: 0.35,
          ease: 'power2.out',
        }, 0)
      }
    })
    rowTlRef.current = tl
  }, [hoveredRow, reduceMotion])
```

Pass position `0` on every tween so all rows and all properties start together — that is what makes the easing homogeneous across the whole table.

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/components/ArchiveRows.choreography.test.jsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 229 + 1 = 230 passed, 26 files.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 8: Leave in the working tree**

`git status --short`, `git diff --stat`. **Do not commit.**

---

## Self-Review

**Spec coverage.** Transition restructure → Task 2. Viewport latch and smooth exit → Task 1 (mobile close tween, shared open/close easing). Row choreography incl. GSAP and the above-the-hovered-row constraint → Task 3. B1 and B2 are already implemented and carry their own structural tests; the plan preserves their invariants via Global Constraints rather than re-testing them. Animation ownership is withdrawn in spec section 3 and correctly absent here.

**Placeholder scan.** No TBD or TODO. Two items are explicitly left to the implementer with a stated rule rather than a guess: how `MobileCanvas` exposes swap-settled state (`swapRunningRef` / `onSwapSettled` are named as the seam, and the implementer must match whatever the file actually uses), and whether a full `Archives` mount is viable for the row test, with the structural fallback spelled out and an explicit ban on weakening the assertion.

**Type and name consistency.** `latchedClosed` / `latchedRowRef` / `setLatchedClosed` / `clearLatchedClosed` / `isFreshInteraction` are defined once in the hook and consumed by the same names in both components. `setLatchedClosed` takes a row index (not a boolean) and is called from exactly one place in `Archives.jsx`. `sampleTransition(vec2)` is defined in Task 2 and called only there. `OPEN_DURATION` / `OPEN_EASE` are introduced as module-scope constants in the file that needs them. `data-hovered` is produced in Task 3 and read by both the timeline and the test. Counts: 219 → 225 (Task 1, 6 tests) → 229 (Task 2, 4 tests) → 230 (Task 3, 1 test), across 23 → 26 files.

**Known limits, stated rather than hidden.** The shader cannot be visually verified in this harness. `font-weight` interpolation is kept because it was explicitly requested, with the layout cost documented and stepping named as the honest fallback. The `transformOrigin` mismatch is out of scope with its reasoning recorded in the spec so it is not lost.

**Deviations from a first draft, corrected here.** An earlier draft cleared the latch on every `handleRowEnter` and carried a `canvasOpenRef` mirroring `hoveredRow`. Both were wrong: the spec requires a fresh interaction to be a *different* row, and the mirrored ref was a no-op (`hoveredRow || canvasOpenRef.current` is just `hoveredRow`). Neither survives into this plan.
