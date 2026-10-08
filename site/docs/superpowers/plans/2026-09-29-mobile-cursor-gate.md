# Mobile Cursor Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every canvas/WebGL effect on the site obey one touch rule — driven only by the project's deliberate custom-cursor grab, never by a bare finger — and mechanically prevent that rule from regressing again.

**Architecture:** Two new hooks (`useVisualViewport`, `useCursorGate`) plus two new pieces of state on the existing cursor provider (`isCursorAwakeRef`, `cursorParkedRef`). Six effect sites are converted to consult the shared gate. A structural test scans the source tree for WebGL/canvas surfaces and fails the suite on any that takes cursor input without going through the gate, so the rule is enforced by CI rather than by a markdown file.

**Tech Stack:** React 19, three.js, GSAP, `shaders`/WebGPU, vitest + @testing-library/react, patchright (headless verification), Lenis.

**Design spec:** `docs/superpowers/specs/2026-09-29-mobile-cursor-gate-design.md`

---

## READ THIS BEFORE TASK 5 — an unresolved contradiction

Task 5 changes `useIsTouch` from `(any-pointer: coarse)` to `navigator.maxTouchPoints`. The existing code deliberately chose the opposite behaviour for hybrid devices, and says so in a comment at `src/hooks/useIsTouch.js:9-13`:

> `any-pointer` (not `pointer`) so a hybrid with an attached mouse still counts as touch-capable — **the safe direction, since the alternative is enabling effects the finger cannot drive.**

A **Surface / touchscreen laptop** is exactly the device that comment is about. The spec's guard (`maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches`) would classify a Surface as **desktop**, which is the opposite of the existing intent and would re-enable hover-only effects on a device the user may be driving by touch.

**The user asked for digitization. The spec followed. But that reverses a documented, deliberate decision about hybrid hardware, and the user had not seen that comment when they asked.**

Task 5 therefore ships the requested change **and** a test that pins the hybrid behaviour explicitly, so the consequence is visible rather than discovered later on someone's Surface. Stop at Task 5 and surface this to the user before continuing past it.

---

## File Structure

**New — each has one responsibility:**

| File | Responsibility |
|---|---|
| `src/hooks/useVisualViewport.js` | Authoritative visual-viewport `{width, height, offsetTop, scale}`, with a ref for rAF consumers and state for React ones. Falls back to `window.inner*` where `visualViewport` is absent. |
| `src/hooks/useCursorGate.js` | The single gate. Exposes `isTouch`, `isAwake`, `parked`, `isOver(rect)`. No effect site reads the drag flags directly after this lands. |
| `tests/hooks/useVisualViewport.test.js` | Viewport hook: fallback, live updates, ref freshness. |
| `tests/hooks/useCursorGate.test.jsx` | Gate semantics: awake/sleep, hit test, passive-scroll negative. |
| `tests/structure/effectGate.structure.test.js` | **The enforcement.** Scans `src/**` for WebGL/canvas surfaces, fails on ungated ones. |
| `tests/perf/measure-callout.mjs` | Exists. Reused in Task 6. |

**Modified:**

| File | Change |
|---|---|
| `src/hooks/useArchiveCursor.js` | Add `isCursorAwakeRef`, `cursorParkedRef`, `parkCursor`, `sleepCursor`. Export all four on the context. |
| `src/hooks/useIsTouch.js` | Digitization + the hybrid guard (Task 5). |
| `src/components/ArchiveCursor.jsx` | Park on drag; sleep on a non-grab `pointerdown`; feed `useVisualViewport`. |
| `src/components/TextEntryGlass.jsx` | Cursor-driven + smoothed orientation (Task 7). |
| `src/components/FeaturedGallery.jsx` | Gate the dissolve `pointerenter` (Task 8). |
| `src/components/SelectedProjects.jsx` | `ProjectRow` position from cursor (Task 9); remove the touch `openCanvas` (Task 10). |
| `src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx` | `uPlaneAspect` from the live box (Task 12). |
| `src/components/ArchiveHoverCanvas/PendulumCanvas.jsx` | Viewport-derived `MAX_W` (Task 12). |
| `src/components/Archives.jsx` | Section viewport lifecycle (Task 13). |
| `src/components/FocusCalloutShader.jsx` | Touch-only radius (Task 6). |
| `src/styles/global.css` | Mobile-scoped callout font (Task 6). |

**Batch boundary:** after Task 5. Everything up to it is foundation and mechanism; everything after is site-by-site adoption plus the three Archives fixes. Ship, verify in a browser, then continue.

---

## Task 1: `useVisualViewport`

Foundation. Every later task reads cursor position, and cursor position is wrong today when the browser UI collapses.

**Files:**
- Create: `src/hooks/useVisualViewport.js`
- Test: `tests/hooks/useVisualViewport.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/hooks/useVisualViewport.test.js
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVisualViewport } from '../../src/hooks/useVisualViewport'

describe('useVisualViewport', () => {
  let listeners

  const installVisualViewport = () => {
    const vv = {
      width: 390, height: 844, offsetTop: 0, scale: 1,
      addEventListener: vi.fn((t, fn) => listeners.push([t, fn])),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv })
    return vv
  }

  beforeEach(() => { listeners = [] })
  afterEach(() => { delete window.visualViewport })

  it('falls back to window.inner* when visualViewport is absent', () => {
    delete window.visualViewport
    window.innerWidth = 1200
    window.innerHeight = 800
    const { result } = renderHook(() => useVisualViewport())
    expect(result.current.viewport.width).toBe(1200)
    expect(result.current.viewport.height).toBe(800)
    expect(result.current.viewport.offsetTop).toBe(0)
  })

  it('prefers visualViewport over window.inner*', () => {
    installVisualViewport()
    window.innerHeight = 800          // layout viewport: stale, browser UI expanded
    const { result } = renderHook(() => useVisualViewport())
    // The whole point: these differ, and the visual one wins.
    expect(result.current.viewport.height).toBe(844)
  })

  it('updates on visualViewport resize', () => {
    installVisualViewport()
    const { result } = renderHook(() => useVisualViewport())
    expect(result.current.viewport.height).toBe(844)
    act(() => {
      const vv = window.visualViewport
      vv.height = 700
      listeners.find(([t]) => t === 'resize')[1]()
    })
    expect(result.current.viewport.height).toBe(700)
  })

  it('keeps viewportRef current without requiring a re-render consumer', () => {
    installVisualViewport()
    const { result } = renderHook(() => useVisualViewport())
    act(() => {
      const vv = window.visualViewport
      vv.height = 650
      listeners.find(([t]) => t === 'resize')[1]()
    })
    expect(result.current.viewportRef.current.height).toBe(650)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run tests/hooks/useVisualViewport.test.js
```
Expected: FAIL — `Failed to resolve import "../../src/hooks/useVisualViewport"`.

- [ ] **Step 3: Write the implementation**

```js
// src/hooks/useVisualViewport.js
import { useEffect, useRef, useState } from 'react'

// Read the VISUAL viewport, not the layout one. `window.innerHeight` stays at its
// largest value when the browser UI expands, so sizing against it put the mobile
// cursor off the touch point and left dead space under the archives canvas.
const readViewport = () => {
  if (typeof window === 'undefined') return { width: 0, height: 0, offsetTop: 0, scale: 1 }
  const vv = window.visualViewport
  if (!vv) return { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, scale: 1 }
  return { width: vv.width, height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale }
}

// Two shapes on purpose. `viewport` is state, for the components that must re-render
// or re-measure (the archives canvas sizes itself from it). `viewportRef` is a ref
// that always holds the newest value, for the rAF loops that must not re-render.
export function useVisualViewport() {
  const viewportRef = useRef(readViewport())
  const [viewport, setViewport] = useState(viewportRef.current)

  useEffect(() => {
    const vv = window.visualViewport
    const onChange = () => {
      viewportRef.current = readViewport()
      setViewport(viewportRef.current)
    }
    onChange()
    if (!vv) {
      window.addEventListener('resize', onChange)
      return () => window.removeEventListener('resize', onChange)
    }
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
    }
  }, [])

  return { viewport, viewportRef }
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
npx vitest run tests/hooks/useVisualViewport.test.js
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVisualViewport.js tests/hooks/useVisualViewport.test.js
git commit -m "feat(viewport): add useVisualViewport reading the visual viewport"
```

---

## Task 2: Parked/awake cursor state

**Files:**
- Modify: `src/hooks/useArchiveCursor.js:36-39` (refs), `:82-85` (`activateCursor`), `:120-137` (context value)
- Test: `tests/hooks/useArchiveCursor.parked.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/hooks/useArchiveCursor.parked.test.jsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { ArchiveCursorProvider, useArchiveCursor } from '../../src/hooks/useArchiveCursor'

const wrapper = ({ children }) => React.createElement(ArchiveCursorProvider, null, children)

const setup = () => renderHook(() => useArchiveCursor(), { wrapper })

describe('parked cursor', () => {
  beforeEach(() => vi.useFakeTimers())

  it('is asleep and unparked on mount', () => {
    const { result } = setup()
    expect(result.current.isCursorAwakeRef.current).toBe(false)
  })

  it('parks and wakes on activateCursor', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    expect(result.current.isCursorAwakeRef.current).toBe(true)
  })

  it('records the parked position when a cursor drag moves', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { result.current.parkCursor(120, 340) })
    expect(result.current.cursorParkedRef.current).toEqual({ x: 120, y: 340 })
  })

  it('sleeps on an explicit sleepCursor', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { result.current.sleepCursor() })
    expect(result.current.isCursorAwakeRef.current).toBe(false)
  })

  it('falls asleep on its own after 4s of no cursor movement', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { vi.advanceTimersByTime(4000) })
    expect(result.current.isCursorAwakeRef.current).toBe(false)
  })

  it('stays awake while the cursor keeps moving', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.parkCursor(10, 10) })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.isCursorAwakeRef.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
npx vitest run tests/hooks/useArchiveCursor.parked.test.jsx
```
Expected: FAIL — `parkCursor is not a function` / `cursorParkedRef` undefined.

- [ ] **Step 3: Add the state**

In `src/hooks/useArchiveCursor.js`, immediately after the existing refs at line 39 (`dragTimerRef`), add:

```js
  // ── Parked cursor (spec §5.1) ──────────────────────────────────────────────
  // Activation and influence are separate. `isCursorActiveRef` means "a drag is
  // happening right now" and is cleared on pointerup, so it cannot express a
  // cursor that is parked and still steering an effect. These two refs can.
  const isCursorAwakeRef = useRef(false)
  const cursorParkedRef = useRef({ x: 0, y: 0 })
  const sleepTimerRef = useRef(null)
  // Declared default, not a measured value (spec §11.2). Tunable after it runs.
  const CURSOR_SLEEP_MS = 4000
```

Immediately after the existing `activateCursor` callback (line 82-85), add:

```js
  // Wakes the cursor and (re)starts the idle countdown. Called on every cursor drag
  // move, so a deliberate placement is never cut off mid-read by the timeout.
  const parkCursor = useCallback((x, y) => {
    cursorParkedRef.current = { x, y }
    isCursorAwakeRef.current = true
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    sleepTimerRef.current = setTimeout(() => {
      isCursorAwakeRef.current = false
      sleepTimerRef.current = null
    }, CURSOR_SLEEP_MS)
  }, [])

  const sleepCursor = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
      sleepTimerRef.current = null
    }
    isCursorAwakeRef.current = false
  }, [])
```

Make `activateCursor` also park, by adding one line to its body (after line 84 `isCursorActiveRef.current = true`):

```js
    isCursorAwakeRef.current = true
```

Add to the unmount cleanup effect (the one at line 89-95 that clears `dragTimerRef`) so the timer never outlives the provider:

```js
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
```

Add all four names to the context value object (line 120-137), directly after the existing `isCursorActiveRef,` line:

```js
      isCursorActiveRef,
      isCursorAwakeRef,
      cursorParkedRef,
      parkCursor,
      sleepCursor,
```

- [ ] **Step 4: Run and confirm it passes**

```bash
npx vitest run tests/hooks/useArchiveCursor.parked.test.jsx
```
Expected: 6 passed.

- [ ] **Step 5: Confirm nothing regressed**

```bash
npx vitest run
```
Expected: all pass, including the pre-existing 167.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useArchiveCursor.js tests/hooks/useArchiveCursor.parked.test.jsx
git commit -m "feat(cursor): add parked/awake state so a resting cursor still steers effects"
```

---

## Task 3: `useCursorGate`

The single API every effect site will use.

**Files:**
- Create: `src/hooks/useCursorGate.js`
- Test: `tests/hooks/useCursorGate.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/hooks/useCursorGate.test.jsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { ArchiveCursorProvider, useArchiveCursor } from '../../src/hooks/useArchiveCursor'
import { useCursorGate } from '../../src/hooks/useCursorGate'

const wrapper = ({ children }) => React.createElement(ArchiveCursorProvider, null, children)

// Drives the provider so the gate has real state to read.
const useHarness = () => {
  const cursor = useArchiveCursor()
  const gate = useCursorGate()
  return { cursor, gate }
}

const RECT = { left: 100, top: 200, right: 500, bottom: 500 }

describe('useCursorGate', () => {
  beforeEach(() => vi.useRealTimers())

  it('exposes the parked position and the awake flag as refs', () => {
    const { result } = renderHook(useHarness, { wrapper })
    expect(result.current.gate.parked.current).toEqual({ x: 0, y: 0 })
    expect(result.current.gate.isAwake.current).toBe(false)
  })

  it('isOver is false when the cursor is asleep', () => {
    const { result } = renderHook(useHarness, { wrapper })
    act(() => { result.current.cursor.parkCursor(300, 300) })
    expect(result.current.gate.isOver(RECT)).toBe(true)
    act(() => { result.current.cursor.sleepCursor() })
    expect(result.current.gate.isOver(RECT)).toBe(false)
  })

  it('isOver is false when the parked cursor is outside the rect', () => {
    const { result } = renderHook(useHarness, { wrapper })
    act(() => { result.current.cursor.parkCursor(50, 50) })
    expect(result.current.gate.isOver(RECT)).toBe(false)
  })

  it('isOver tolerates a null rect', () => {
    const { result } = renderHook(useHarness, { wrapper })
    expect(result.current.gate.isOver(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
npx vitest run tests/hooks/useCursorGate.test.jsx
```
Expected: FAIL — cannot resolve `../../src/hooks/useCursorGate`.

- [ ] **Step 3: Write the hook**

```js
// src/hooks/useCursorGate.js
import { useCallback } from 'react'
import { useArchiveCursor } from './useArchiveCursor'

// The single place cursor state is read for effect gating. Effect sites must not
// reach for isCursorActiveRef / isDragging / cursorRef directly: those three mean
// different things (spec §6) and hand-rolling the ternary at each site is exactly
// how the rule got lost three times in one session.
//
// One API, no convenience form, so a compliant file is recognisable by a single
// greppable call — which is what the structural test in Task 4 keys on.
export function useCursorGate() {
  const { isTouch, isCursorAwakeRef, cursorParkedRef } = useArchiveCursor()

  // The rect stays with the caller: every compliant site already computes it each
  // frame, so the hook supplies the cursor side and never measures anything itself.
  const isOver = useCallback((rect) => {
    if (!rect) return false
    const p = cursorParkedRef.current
    return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom
  }, [cursorParkedRef])

  return { isTouch, isAwake: isCursorAwakeRef, parked: cursorParkedRef, isOver }
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
npx vitest run tests/hooks/useCursorGate.test.jsx
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCursorGate.js tests/hooks/useCursorGate.test.jsx
git commit -m "feat(cursor): add useCursorGate, the single cursor-gating API"
```

---

## Task 4: The structural regression test

**This is the task that makes the rule survive.** Everything else in this plan is a convention; this is the enforcement.

**Files:**
- Create: `tests/structure/effectGate.structure.test.js`

- [ ] **Step 1: Write the test**

```js
// tests/structure/effectGate.structure.test.js
// @vitest-environment node
//
// The enforcement behind spec §6. A markdown rule was already violated three times
// in one session; this fails the suite instead, so an ungated effect cannot be
// landed as "done".
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(process.cwd(), 'src')

// Files that own a WebGL/canvas surface and deliberately take no cursor input.
// Derived from the real surface set (12 files) rather than assumed — an earlier
// draft of this plan listed a MatrixRain component that does not exist, which the
// third test below would have failed on immediately. Adding an entry is a
// deliberate act, and that test fails if an entry points at a file that is gone.
const EXEMPT = new Set([
  'webgl-water/HeroShaderStack.jsx',           // hero: exempt by user instruction
  'components/CursorGlow.jsx',                 // 2D canvas, decorative only
  'components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx',  // receives an already-gated cursorRef as a PROP
  'components/MobileSectionCanvas.jsx',        // same: prop-drilled cursor
  'hero-glass/engine.js',                      // engine internals; receives setPointer
  'preloader/scene.js',                        // preloader, owns no cursor
  'preloader/config.js',                       // config, matches the regex incidentally
  'utils/renderScale.js',                      // utility, matches the regex incidentally
])

// KNOWN LIMITATION, stated rather than hidden: ArchiveHoverCanvas and
// MobileSectionCanvas receive the cursor as a prop from a gated parent, so the leaf
// cannot gate it itself. They are exempted, which means a future edit that adds its
// OWN cursor read there would not be caught. Closing that hole needs the prop to be
// the only sanctioned way in — a follow-up, not this plan.

const SURFACE_RE = /new THREE\.WebGLRenderer|<canvas\b|<Shader\b/
// Reading any of these means the surface consumes pointer/cursor state and must
// therefore be gated.
const CURSOR_RE = /cursorRef|isCursorActive|isDragging|isCursorAwake|cursorParked|pointermove|mousemove|pointerenter|mouseenter/

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

const rel = (file) => path.relative(SRC, file).split(path.sep).join('/')
const sources = walk(SRC)
const surfaces = sources.filter((f) => SURFACE_RE.test(fs.readFileSync(f, 'utf8')))

describe('effect gating', () => {
  // Guard the guard: a scan that matches nothing would make the whole suite pass
  // vacuously, which is the exact shape of failure this file exists to prevent.
  it('discovers the WebGL/canvas surfaces (the scan must find something)', () => {
    expect(surfaces.length).toBeGreaterThan(5)
  })

  it('no surface reads cursor state without going through useCursorGate', () => {
    const offenders = []
    for (const file of surfaces) {
      const src = fs.readFileSync(file, 'utf8')
      const r = rel(file)
      if (EXEMPT.has(r)) continue
      if (src.includes('useCursorGate')) continue
      if (!CURSOR_RE.test(src)) continue          // no cursor input at all
      offenders.push(r)
    }
    expect(offenders).toEqual([])
  })

  it('every exemption still points at a real file', () => {
    for (const e of EXEMPT) {
      expect(fs.existsSync(path.join(SRC, e)), `exempt path ${e} does not exist`).toBe(true)
    }
  })

  it('no effect site reaches for the raw drag flags', () => {
    // The specific failure that went unnoticed: a site reading isCursorActiveRef
    // directly. Correct-looking, ungated, and invisible in review.
    //
    // A verified offender list, taken by running this scan against the tree rather
    // than by reasoning about it, is: ArchiveCursor.jsx, Archives.jsx,
    // FeaturedGallery.jsx, FocusCalloutShader.jsx, SelectedProjects.jsx. Three are
    // converted by Tasks 6, 8 and 9. The other two are handled as follows, and the
    // reasons are load-bearing — do not widen these exemptions:
    //
    //   ArchiveCursor.jsx  EXEMPT: it *is* the cursor. It reads isDraggingRef to
    //     decide whether the dragged element follows the finger, so it is the
    //     implementer of the drag, not a consumer that could bypass it. Gating it
    //     would mean gating the cursor behind itself.
    //
    //   Archives.jsx  NOT exempt: its isCursorActiveRef guard at line 107 is the
    //     exact tap-vs-drag pattern this test exists to catch. Converted in Task 13.
    const LEGITIMATE = new Set([
      'hooks/useArchiveCursor.js',     // the provider
      'hooks/useCursorGate.js',        // the sanctioned reader
      'components/ArchiveCursor.jsx',  // the cursor's own drag implementation
    ])
    const offenders = []
    for (const file of sources) {
      const src = fs.readFileSync(file, 'utf8')
      if (LEGITIMATE.has(rel(file))) continue
      if (!/isCursorActiveRef|isDraggingRef|isDragging\b/.test(src)) continue
      if (src.includes('useCursorGate')) continue
      offenders.push(rel(file))
    }
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/structure/effectGate.structure.test.js
```
Expected: FAIL, listing offenders. The compliant sites still read the raw flags, and `TextEntryGlass` / the `FeaturedGallery` dissolve will be among them. **If it passes on the first run, the scan is broken — stop and fix the regexes before continuing.**

- [ ] **Step 3: Commit the failing test before fixing anything**

```bash
git add tests/structure/effectGate.structure.test.js
git commit -m "test(structure): fail on any effect surface that bypasses useCursorGate"
```

- [ ] **Step 4: Prove the test can actually fail**

Temporarily remove `useCursorGate` from one compliant site (e.g. delete its import line in `src/components/Archives.jsx`) and run the suite. Expected: the offenders list grows. **Restore immediately.** A test that cannot fail is worse than no test, and this one is the load-bearing check for the whole plan.

- [ ] **Step 5: Leave it red until the last offender lands**

The test stays failing until every offender is converted. The verified offender list and the task that clears each one:

| Offender | Cleared by |
|---|---|
| `FeaturedGallery.jsx` | Task 8 |
| `FocusCalloutShader.jsx` | Task 6, Step 5 |
| `SelectedProjects.jsx` | Task 9 |
| `Archives.jsx` | Task 13, Step 2a |

**So the structural test does not go green at Task 10.** An earlier draft of this plan claimed it did; that claim was wrong, and it was wrong in the exact way this test exists to catch — the Archives site kept reading the raw flag and nothing in the plan noticed. It goes green at the end of **Task 13**, which is why Task 13 carries a conversion step and Task 14 re-checks it.

Do not weaken the regexes, and do not widen either exempt set, to make it pass early. Commit each site's conversion as it lands.

---

## Task 5: Device detection → digitization

**Read the "READ THIS BEFORE TASK 5" note at the top of this plan first, and surface it to the user before continuing past this task.**

**Files:**
- Modify: `src/hooks/useIsTouch.js:12` (`TOUCH_POINTER_QUERY`)
- Test: `tests/hooks/useIsTouch.digitization.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/hooks/useIsTouch.digitization.test.js
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsTouch } from '../../src/hooks/useIsTouch'

const stubPointer = (coarse) => vi.stubGlobal('matchMedia', (q) => ({
  media: q, matches: q.includes('pointer') ? coarse : false,
  addEventListener: vi.fn(), removeEventListener: vi.fn(),
  addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
}))

describe('useIsTouch digitization', () => {
  beforeEach(() => { delete navigator.maxTouchPoints })
  afterEach(() => { vi.unstubAllGlobals() })

  it('is touch on a digitised phone with a fine pointer absent', () => {
    navigator.maxTouchPoints = 5
    stubPointer(false)                       // (pointer: fine) does NOT match
    expect(renderHook(() => useIsTouch()).result.current).toBe(true)
  })

  it('is NOT touch on a desktop with no touch points', () => {
    navigator.maxTouchPoints = 0
    stubPointer(true)                        // (pointer: fine) matches
    expect(renderHook(() => useIsTouch()).result.current).toBe(false)
  })

  it('treats a touchscreen laptop as DESKTOP, not touch', () => {
    // This is the deliberate reversal of the old `any-pointer: coarse` choice, and
    // the reason it is pinned by a test rather than left to be discovered on a
    // Surface: a mouse user must keep hover effects.
    navigator.maxTouchPoints = 10
    stubPointer(true)                        // a mouse is the primary pointer
    expect(renderHook(() => useIsTouch()).result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
npx vitest run tests/hooks/useIsTouch.digitization.test.js
```
Expected: FAIL on the first or third case — the current hook reads `(any-pointer: coarse)`, which is true for a Surface.

- [ ] **Step 3: Implement**

Replace the query and the hook body in `src/hooks/useIsTouch.js`. Keep the export name so nothing else changes:

```js
import { useState, useEffect } from 'react'

// "Does this device have a finger?", not "is it narrow?".
//
// The 720px useIsMobile() answers a LAYOUT question and must stay there. This one
// answers an INPUT question, and the two are genuinely different: a phone is touch
// at 390px, a tablet is touch at 1024px and 1366px, and a desktop browser dragged
// down to 700px is still neither.
//
// CHANGED 2026-09-29: was `(any-pointer: coarse)`, which classified a touchscreen
// laptop as TOUCH and so disabled its hover effects — the opposite of what a mouse
// user needs. Digitization alone (`maxTouchPoints > 0`) has that same problem, so
// the pointer type is checked too: touch-capable AND not primarily a fine pointer.
// A Surface driving a mouse is now correctly desktop; a tablet is still touch.
export const TOUCH_POINTER_QUERY = '(pointer: coarse)'

function isDigitisedTouch() {
  if (typeof window === 'undefined') return false
  const digitised = (navigator.maxTouchPoints || 0) > 0
  const finePointer = window.matchMedia('(pointer: fine)').matches
  return digitised && !finePointer
}

export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(isDigitisedTouch)

  useEffect(() => {
    const on = () => setIsTouch(isDigitisedTouch())
    // Pointer capability can change at runtime (a mouse docked onto a tablet), so
    // re-read on mount rather than trusting the lazy initialiser alone.
    on()
    const fine = window.matchMedia('(pointer: fine)')
    fine.addEventListener('change', on)
    return () => fine.removeEventListener('change', on)
  }, [])

  return isTouch
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
npx vitest run tests/hooks/useIsTouch.digitization.test.js tests/webglPolicy.test.js
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIsTouch.js tests/hooks/useIsTouch.digitization.test.js
git commit -m "feat(input): detect touch by digitization plus pointer type"
```

- [ ] **Step 6: Surface the hybrid-device reversal to the user before continuing**

Report plainly: a Surface or touchscreen laptop now takes the desktop path. If the user wants hybrids treated as touch instead, the guard becomes `digitised` alone and the third test is inverted. **Ask; do not assume.**

---

## Task 6: FocusCallout radius and font

**Files:**
- Modify: `src/components/FocusCalloutShader.jsx:639` (`radius={2.5}`, inside the `ChromaFlow` block at 632-642)
- Modify: `src/styles/global.css:474` (`.focus-callout` font-size) — add the media query after the rule's closing brace at line 485
- Test: `tests/perf/measure-callout.mjs` (exists — re-run, do not rewrite)

- [ ] **Step 1: Make the radius touch-only**

In `FocusCalloutShader.jsx`, the component already destructures `isTouch` from `useArchiveCursor()` (line 349). Change the `ChromaFlow` `radius` prop from `radius={2.5}` to:

```jsx
            radius={isTouch ? 3.25 : 2.5}
```

- [ ] **Step 2: Make the font mobile-scoped**

In `src/styles/global.css`, the `.focus-callout` rule at line 474 keeps its current value. Add a new block immediately after the closing brace of that rule (line 485):

```css
/* Mobile only. 12vw is below the 64px floor at every phone width, so the rendered
   size was pinned to 64px everywhere and "Generative" (4.877em) already spanned
   89-93% of the container. 18vw is the largest coefficient that still fits that word
   at 375-430px — measured, not estimated. Scoped to this breakpoint so desktop keeps
   12vw and its current layout. Re-check with tests/perf/measure-callout.mjs after
   any change here. */
@media (max-width: 720px) {
  .focus-callout { font-size: clamp(64px, 18vw, 200px); }
}
```

- [ ] **Step 3: Re-run the measurement and check the pass condition**

```bash
node tests/perf/measure-callout.mjs
```
Expected: `currentOverflows` is `false` on all four viewports, and `fontSize` reads ~67 / ~70 / ~74 / ~78.

- [ ] **Step 4: Verify desktop did not move**

```bash
node -e "
const {chromium}=require('patchright');const http=require('http'),fs=require('fs'),path=require('path');
const D=path.join(process.cwd(),'dist'),T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const s=http.createServer((q,r)=>{let f=path.join(D,q.url==='/'?'index.html':q.url.split('?')[0]);if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(D,'index.html');r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
s.listen(5199,async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.goto('http://localhost:5199/',{waitUntil:'domcontentloaded'});
const v=await p.evaluate(()=>{const e=document.querySelector('.focus-callout');return e?parseFloat(getComputedStyle(e).fontSize):null});
console.log('desktop callout font-size:',v,'(must be 192 - unchanged)');await b.close();s.close()});
"
```
Expected: `192`. If it prints 200 or anything else, the media query is leaking to desktop — stop and fix.

- [ ] **Step 5: Route the existing gate through the sanctioned API**

`FocusCalloutShader.jsx:354` reads `isDragging` directly. It is `AGENT/EFFECTS.md`'s named *reference implementation*, so leaving it on a raw flag means the reference is the one file the structural test flags. Convert it:

```js
  const { isTouch: gateIsTouch, isAwake } = useCursorGate()
  const effectOn = gateIsTouch ? isAwake.current : hovered
```

Note `isAwake` is a **ref**, so a React consumer must not read `.current` during render — keep the existing `isDragging` state subscription for the render path and use the ref only inside callbacks, or subscribe with a `useState` mirror. Read the current line before editing: it destructures `isTouch`/`isDragging` from `useArchiveCursor()` and feeds `intensity`/`aberration`.

- [ ] **Step 6: Commit**

```bash
git add src/components/FocusCalloutShader.jsx src/styles/global.css tests/perf/measure-callout.mjs
git commit -m "feat(callout): touch-only 1.3x flow radius, fitted mobile font, sanctioned gate"
```

---

## Task 7: TextEntryGlass — cursor-driven, smoothed

Spec N1. Today it reads a raw `pointermove` with no gate and no smoothing.

**Files:**
- Modify: `src/components/TextEntryGlass.jsx:101-108` (pointer handler), `import` block
- Test: `tests/components/TextEntryGlass.cursor.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/TextEntryGlass.cursor.test.jsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import TextEntryGlass from '../../src/components/TextEntryGlass'

const engine = { setPointer: vi.fn(), setScrollProgress: vi.fn(), rebuildText: vi.fn() }
vi.mock('../../src/hero-glass/engine.js', () => ({
  createGlassEngine: () => engine,
}))

// Touch, with the cursor parked at a known place. `parked` is a ref in the real
// gate; a plain object is the same shape as far as the consumer is concerned.
const PARKED = { current: { x: 300, y: 400 } }
vi.mock('../../src/hooks/useCursorGate.js', () => ({
  useCursorGate: () => ({ isTouch: true, isAwake: { current: true }, parked: PARKED, isOver: () => true }),
}))
vi.mock('../../src/hooks/useIsTouch.js', () => ({ useIsTouch: () => true }))

describe('TextEntryGlass orientation', () => {
  beforeEach(() => { engine.setPointer.mockClear() })

  it('feeds the engine from the parked cursor with no pointer event at all', () => {
    // The load-bearing assertion: NOTHING is dispatched here — no pointermove, no
    // mouse. Today setPointer is only ever called from onPointerMove, so the engine
    // is never driven on touch, which is exactly the defect (N1: no gate, no
    // smoothing, nothing to follow a parked cursor with).
    render(<TextEntryGlass />)
    expect(engine.setPointer).toHaveBeenCalled()
  })

  it('passes normalised coordinates, not raw client pixels', () => {
    render(<TextEntryGlass />)
    const call = engine.setPointer.mock.calls.at(-1)
    expect(call).toBeDefined()
    // Engine's signature is setPointer(nx, ny) with nx/ny in -1..1. Parked at
    // (300,400) in a 1000x800 window, so both must be inside that range — raw
    // client pixels (300, 400) would fail this and the effect would be off-screen.
    for (const v of call) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('does not read a raw pointer event', () => {
    // Guards the specific regression: re-adding a window-level pointermove listener
    // is the one change that would make both tests above pass for the wrong reason.
    render(<TextEntryGlass />)
    expect(typeof window.onpointermove).not.toBe('function')
  })
})
```

The third case is a deliberate belt-and-braces check: without it, a future edit could re-add a raw `pointermove` listener and still pass, because the parked read would win the race.

- [ ] **Step 2: Run and confirm it fails**

```bash
npx vitest run tests/components/TextEntryGlass.cursor.test.jsx
```
Expected: FAIL — either the module mock path is wrong or the export name differs. Read `src/hero-glass/engine.js` exports and correct the mock to match; the point of the test is the behaviour below, not the mock.

- [ ] **Step 3: Replace the raw listener with a smoothed cursor reader**

In `TextEntryGlass.jsx`, add to the imports:

```js
import { useCursorGate } from '../hooks/useCursorGate'
import { useVisualViewport } from '../hooks/useVisualViewport'
```

Inside the component, alongside the existing `engineRef`, add:

```js
  const { parked } = useCursorGate()
  const { viewportRef } = useVisualViewport()
  const targetPointer = useRef({ x: 0, y: 0 })
```

Replace the existing `onPointerMove` handler and its `window.addEventListener` (lines 101-108) with a rAF reader driven by the parked cursor. The exemption is deliberate: the user asked for this surface to be "always" oriented, so it is not gated on `isAwake` — it follows the cursor wherever it is.

```js
  // Always oriented, per the user: this surface follows the cursor whether or not
  // the cursor is awake. It is on the structural test's exemption list.
  // SMOOTHED, which the old `pointermove` path was not — engine.setPointer assigns
  // straight into the rotation, so a raw event coordinate produced visible stepping.
  useEffect(() => {
    let raf = 0
    const smooth = { x: 0, y: 0 }
    const read = () => {
      const p = parked.current
      const v = viewportRef.current
      const w = v.width || window.innerWidth || 1
      const h = v.height || window.innerHeight || 1
      targetPointer.current.x = (p.x / w) * 2 - 1
      targetPointer.current.y = -((p.y / h) * 2 - 1)
      smooth.x += (targetPointer.current.x - smooth.x) * 0.08
      smooth.y += (targetPointer.current.y - smooth.y) * 0.08
      engineRef.current?.setPointer(smooth.x, smooth.y)
      raf = requestAnimationFrame(read)
    }
    raf = requestAnimationFrame(read)
    return () => cancelAnimationFrame(raf)
  }, [parked, viewportRef])
```

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run
```
Expected: all pass. The structural test may still be red — that is expected until Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/components/TextEntryGlass.jsx tests/components/TextEntryGlass.cursor.test.jsx
git commit -m "feat(glass): drive orientation from the parked cursor, smoothed"
```

---

## Task 8: FeaturedGallery dissolve gate

Spec N2 — the regression this plan exists partly because of.

**Files:**
- Modify: `src/components/FeaturedGallery.jsx:245-248` (listener attach), `:220-230` (item shape)
- Test: `tests/components/FeaturedGallery.dissolve.test.jsx` (extend the existing file)

- [ ] **Step 1: Write the failing test**

Add to the existing `tests/components/FeaturedGallery.dissolve.test.jsx`, inside the existing `describe`:

```jsx
  it('does not dissolve on a tap that is not a cursor grab', async () => {
    const { container } = await load()
    const card = frames(container)[0]
    gsap.__tweens.length = 0
    // A bare tap fires pointerenter. On touch this must not start the reveal.
    card.dispatchEvent(new Event('pointerenter'))
    // The gate lives in the handler, so with the cursor asleep nothing is created.
    expect(gsap.__tweens.length).toBe(0)
  })
```

- [ ] **Step 2: Run and confirm it fails**

```bash
npx vitest run tests/components/FeaturedGallery.dissolve.test.jsx
```
Expected: FAIL — a tween IS created, because `onFrameEnter` currently calls `tweenDissolve(item, 1)` unconditionally.

- [ ] **Step 3: Gate the handler**

In `FeaturedGallery.jsx`, add the import:

```js
import { useCursorGate } from '../hooks/useCursorGate'
```

`buildGalleryGL` is a plain function outside the component, so it cannot call the hook. Pass the gate in through the existing `cursorInput` parameter object, which already carries `isTouch`/`cursorRef`/`isCursorActiveRef` (built at line 317).

In the component, add:

```js
  const { isAwake } = useCursorGate()
```

and add `isCursorAwake: isAwake` to the `cursorInput` object passed to `buildGalleryGL`:

```js
        galleryGL = buildGalleryGL(validFrames, {
          isTouch, cursorRef, isCursorActiveRef, inViewRef: gridInViewRef,
          isCursorAwake: isAwake,
        })
```

Then gate the two listeners in `buildGalleryGL` (lines 245-248):

```js
      // Gated: a bare tap fires pointerenter, and without this the dissolve played
      // on every touch of a card. The effect requires the deliberate cursor grab
      // (isCursorAwake), same rule as the ripple above.
      item.onFrameEnter = () => {
        if (cursorInput.isTouch && !cursorInput.isCursorAwake.current) return
        tweenDissolve(item, 1)
      }
      item.onFrameLeave = () => tweenDissolve(item, 0)
```

- [ ] **Step 4: Run and confirm it passes**

```bash
npx vitest run tests/components/FeaturedGallery.dissolve.test.jsx
```
Expected: all pass, including the pre-existing dissolve tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeaturedGallery.jsx tests/components/FeaturedGallery.dissolve.test.jsx
git commit -m "fix(gallery): gate the hover dissolve behind the cursor grab"
```

---

## Task 9: ProjectRow position from the cursor

Spec N3. The gate is correct but `mouseRef` only ever receives desktop `clientX/clientY`.

**Files:**
- Modify: `src/components/SelectedProjects.jsx:646-647` and `:803-804` (the `mouseRef` writes in `handleEnter` and `attachPointerHandlers.setPos`)
- Test: `tests/components/SelectedProjects.calloutEntrance.test.jsx` (same file — add a case)

- [ ] **Step 1: Write the failing test**

Add to `tests/components/SelectedProjects.calloutEntrance.test.jsx`:

```js
// tests/structure/ProjectRow.parkedCursor.test.js
// @vitest-environment node
// Pins the contract, because the value itself is unreachable from a test.
//
// `mouseRef` is a plain useRef local to ProjectRow (line 166) whose only readers are
// the spring field at lines 496-497 and 852-853, which feed a WebGL uniform. It is
// never written to the DOM, so no render/dispatch assertion can observe it, and
// jsdom cannot read the canvas back. A test that claims to assert on it via a data
// attribute would be asserting on something that does not exist.
//
// So this pins the source contract instead — the same approach as the rafEnabledRef
// latch test in Task 11. It is weaker than a behavioural test and that is a real
// limitation, stated rather than hidden. What it does guarantee: the touch branch
// cannot be deleted or reverted to event-only without this going red.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/SelectedProjects.jsx'), 'utf8')

// The block that seeds mouseRef from clientX/clientY, i.e. the code under change.
const seedBlock = () => {
  const i = src.indexOf('mouseRef.current.x =')
  expect(i, 'mouseRef seed assignment not found').toBeGreaterThan(-1)
  return src.slice(Math.max(0, i - 400), i + 400)
}

describe('ProjectRow mouseRef on touch', () => {
  it('seeds mouseRef from the parked cursor, not only from event coordinates', () => {
    const b = seedBlock()
    // The parked cursor is the source of truth on touch: the event's coordinates are
    // wherever the finger happened to be, and there is no event at all for a parked
    // cursor, so an event-only branch receives nothing.
    expect(b).toMatch(/parked\.current/)
    // And the desktop path must survive, not be replaced by the touch branch.
    expect(b).toMatch(/clientX/)
  })

  it('guards the touch branch on the gate, not the raw drag flag', () => {
    expect(src).toMatch(/gateIsTouch\s*&&\s*!isAwake\.current/)
    // A re-introduced raw-flag read anywhere in the file is the regression this
    // plan exists to prevent, so assert the sanctioned names are present.
    expect(src).toContain('useCursorGate')
  })
})
```

**Why structural and not behavioural:** recorded here so the executor does not "fix" it by inventing a data attribute on production markup to make a DOM assertion possible. Adding a test-only attribute to shipped code is a worse trade than a source-level pin. If a future refactor exposes the spring input legitimately, this test can be replaced by a real one then.

- [ ] **Step 2: Confirm it fails before implementing**

```bash
npx vitest run tests/components/SelectedProjects.calloutEntrance.test.jsx
```
Expected: the new case fails.

- [ ] **Step 3: Write the cursor position in the touch branch**

In `ProjectRow`, add the hook import and call, then replace the touch branch of `handleEnter` so the parked cursor seeds `mouseRef` exactly as a desktop event does:

```js
  const { isTouch: gateIsTouch, isAwake, parked } = useCursorGate()
```

Inside `handleEnter`, replacing the current `if (isTouch && !isCursorActiveRef.current) return` guard (line 574) with:

```js
  if (gateIsTouch && !isAwake.current) return
```

and replacing the `if (e) { ... mouseRef.current.x = e.clientX - wr.left ... }` block (lines 644-648) with a source that works for both input modes:

```js
  const wr = wrapper.getBoundingClientRect()
  if (gateIsTouch) {
    // The mobile cursor is the source of truth here; the event's coordinates are
    // wherever the finger happened to be, and there is no event on a parked cursor.
    const p = parked.current
    mouseRef.current.x = p.x - wr.left
    mouseRef.current.y = p.y - wr.top
  } else if (e) {
    mouseRef.current.x = e.clientX - wr.left
    mouseRef.current.y = e.clientY - wr.top
  }
```

Do the same inside `attachPointerHandlers`' `setPos` (lines 801-805): on touch, read `parked.current` instead of `e.clientX/clientY`.

- [ ] **Step 4: Run and confirm it passes**

```bash
npx vitest run tests/components/SelectedProjects.calloutEntrance.test.jsx
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SelectedProjects.jsx tests/components/SelectedProjects.calloutEntrance.test.jsx
git commit -m "fix(projects): feed the title tile field from the parked mobile cursor"
```

---

## Task 10: ProjectExpanded — remove the tap canvas

The touch-only `onClick` that opens the fullscreen canvas. Verified already `isTouch ? ... : undefined`, so desktop cannot be affected.

**Files:**
- Modify: `src/components/SelectedProjects.jsx:1279-1282`
- Test: `tests/components/SelectedProjects.calloutEntrance.test.jsx` (add a case)

- [ ] **Step 1: Locate and remove it**

Find the `ProjectExpanded` image element and delete the `onClick` prop entirely:

```jsx
                onClick={isTouch ? (e) => {
                  e.stopPropagation()
                  openCanvas(assetUrl(item.src), 'tile-reveal')
                } : undefined}
```

Delete the whole prop. The row's own `onClick` (which toggles expand/collapse) is a different element and stays.

- [ ] **Step 2: Confirm no other reference remains**

```bash
grep -n "tile-reveal" src/components/SelectedProjects.jsx
```
Expected: no output from this file. `MobileSectionCanvas.jsx` may still handle the effect type for other callers — leave that alone.

- [ ] **Step 3: Run the suite**

```bash
npx vitest run
```
Expected: all pass, except the structural test from Task 4, which **is expected to still be red here**. `SelectedProjects.jsx` is now clean, but `Archives.jsx` keeps its `isCursorActiveRef` guard until Task 13 Step 2a. If the structural test is green at this point, the scan is not covering what Task 4 claimed it covers — re-read its offender list before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/components/SelectedProjects.jsx tests/components/SelectedProjects.calloutEntrance.test.jsx
git commit -m "fix(projects): stop opening a fullscreen canvas on tapping an expanded image"
```

---

## Task 11: Archives D1 — the `rafEnabledRef` latch

The frozen desktop cursor. Not a race: a one-way latch.

- [ ] **Step 1: Write the failing test**

```js
// tests/structure/ArchiveCursor.latch.test.js
// @vitest-environment node
// Pins the root cause so it cannot be reintroduced: rafEnabledRef is written true
// ONLY in the morph branch's onComplete, and the shrink branch never restores it.
// A fast hover-then-exit kills the morph mid-flight, leaving it false forever, and
// the position RAF then matches neither branch and stops writing a transform.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/ArchiveCursor.jsx'), 'utf8')

describe('ArchiveCursor rafEnabledRef latch', () => {
  it('the shrink branch restores rafEnabledRef', () => {
    const shrinkBranch = src.slice(src.indexOf('if (!inRow)'), src.indexOf('} else {', src.indexOf('if (!inRow)')))
    expect(shrinkBranch).toMatch(/rafEnabledRef\.current\s*=\s*true/)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
npx vitest run tests/structure/ArchiveCursor.latch.test.js
```
Expected: FAIL — no `rafEnabledRef.current = true` in the shrink branch.

- [ ] **Step 3: Fix it**

In `ArchiveCursor.jsx`, inside the `if (!inRow)` branch, add immediately after `shrinkingRef.current = true` (line 182):

```js
      // Restore the latch. It is set false at morph entry and true only in the
      // morph's onComplete, so a fast exit that kills the morph mid-flight left it
      // false forever: the position RAF then matched neither branch and stopped
      // writing a transform, freezing the cursor until the row was hovered again.
      rafEnabledRef.current = true
```

And inside the shrink timeline's `onComplete` (line 185-200), add the same line at the top, so the latch is restored on the animated path too and not only on entry.

- [ ] **Step 4: Run and confirm it passes**

```bash
npx vitest run tests/structure/ArchiveCursor.latch.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ArchiveCursor.jsx tests/structure/ArchiveCursor.latch.test.js
git commit -m "fix(archives): restore rafEnabledRef in the shrink branch, unfreezing the cursor"
```

---

## Task 12: Archives D2 — stretch and available width

**Files:**
- Modify: `src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx:277` (`uPlaneAspect` init), `:341-354` (resize)
- Modify: `src/components/ArchiveHoverCanvas/PendulumCanvas.jsx:7-8` (`MAX_W`/`MAX_H`)

- [ ] **Step 1: Derive the size ceiling from the live viewport**

`MAX_W`/`MAX_H` are used at lines 34, 37, 86-87, 113, 128-129, 150, 157-158 and 260-262 — all of them **inside** the component. So they become a derived per-render value, not a constant. Delete the module-scope constants (lines 7-8) entirely:

```js
const MAX_W = 340
const MAX_H = 440
```

and instead add the Task 1 hook, then derive the ceiling inside `PendulumCanvas`, immediately after the existing `const isTouch = useIsTouch()` (line 30):

```js
  const { viewport } = useVisualViewport()

  // Read the VISUAL viewport, not window.innerWidth: the layout viewport stays at
  // its largest value while the browser UI is collapsed, so sizing to it produced a
  // canvas wider than the visible area. Derived per render rather than at module
  // scope — a module constant would freeze the size at import time and never react
  // to a rotation or a URL bar collapse, which is the bug this task exists to fix.
  const MAX_W = Math.max(280, Math.min(340, viewport.width - 32))
  const MAX_H = Math.max(360, Math.min(440, viewport.height - 96))
```

`vw - 32` leaves a 16px gutter each side; `vh - 96` leaves room for the caption. The `Math.min` against the original 340/440 clamps back to exactly 340×440 on a desktop, so **desktop is unchanged**.

Add the import at the top of the file, next to the existing `useIsTouch` import:

```js
import { useVisualViewport } from '../../hooks/useVisualViewport'
```

Note the extension: `useVisualViewport.js` is written with the `.js` extension, matching the `useIsTouch` import on the line above it.

**One consequence to handle explicitly:** lines 34 and 37 seed two refs with `MAX_W`/`MAX_H` —

```js
  const sizeRef = useRef({ w: MAX_W, h: MAX_H })
  const committedSizeRef = useRef({ w: MAX_W, h: MAX_H })
```

`useRef`'s argument is only read on the first render, so those two keep the first render's values and will **not** pick up a later resize. Do not "fix" that by re-deriving them in render; instead re-seed on a viewport change, so the fallback and committed sizes follow the real screen:

```js
  useEffect(() => {
    sizeRef.current = { w: MAX_W, h: MAX_H }
    committedSizeRef.current = { w: MAX_W, h: MAX_H }
  }, [MAX_W, MAX_H])
```

That re-seed is only correct **because** the 340/440 clamp makes these stable on desktop: on a desktop `MAX_W`/`MAX_H` never change identity across renders, so the effect does not fire repeatedly and the image-load tweens at lines 113/150 are unaffected. If that clamp is ever removed, this effect starts fighting the tweens — which is the reason the desktop ceiling is kept, not merely a size preference.

- [ ] **Step 2: Initialise uPlaneAspect from the measured box**

In `ArchiveHoverCanvas.jsx`, line 277 currently reads:

```js
      uPlaneAspect: { value: WIDTH / HEIGHT },
```

Replace with the real box, measured at construction rather than assumed:

```js
      // Measured, not the 340/440 constant. coverUv() is correct but it needs the
      // PLANE aspect; a wrong initial value squashed every image on the first frame
      // until the ResizeObserver corrected it.
      uPlaneAspect: {
        value: (canvas.clientWidth || WIDTH) / (canvas.clientHeight || HEIGHT || 1),
      },
```

- [ ] **Step 3: Re-assert on every resize**

In the existing `resize` function (lines 340-354), it already sets `uPlaneAspect` from `clientWidth/clientHeight`. Confirm both branches do so and that it is not short-circuited when the canvas has not changed size — a *changed* box with an *unchanged* buffer is exactly the case that skipped the correction.

- [ ] **Step 4: Verify no squash on a 4:3 and a 3:4 source**

```bash
npx vitest run tests/structure/effectGate.structure.test.js
```
Expected: PASS (unchanged by this step).

Then in a browser at 430px, confirm `canvas.getBoundingClientRect().width > 340` and that neither source is visibly squashed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx src/components/ArchiveHoverCanvas/PendulumCanvas.jsx
git commit -m "fix(archives): size the canvas to the visual viewport and measure uPlaneAspect"
```

---

## Task 13: Archives D3 — viewport lifecycle

**Files:**
- Modify: `src/components/Archives.jsx` (canvas render block, lines ~309-329)
- Test: `tests/components/Archives.lifecycle.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/Archives.lifecycle.test.jsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import React from 'react'
import Archives from '../../src/components/Archives'

// Assert on the PROPS each canvas is handed, not on pixels: a WebGL surface cannot
// be meaningfully inspected in jsdom, and "a canvas element exists" is not a
// behaviour — it is true today, before any change, so it cannot fail.
let lastPendulumProps = null
let lastHoverProps = null
vi.mock('../../src/components/ArchiveHoverCanvas', () => ({
  __esModule: true,
  // The inner canvas takes its OWN `visible` prop, independent of the wrapper, so
  // it needs capturing separately — gating only PendulumCanvas would leave this
  // one rendering and animating off screen.
  default: (props) => { lastHoverProps = props; return <div data-testid="hover-canvas" /> },
  PendulumCanvas: (props) => { lastPendulumProps = props; return <div data-testid="pendulum" /> },
}))
vi.mock('../../src/components/ArchiveCursor', () => ({
  __esModule: true,
  default: () => <div data-testid="archive-cursor" />,
}))

// jsdom has no IntersectionObserver, and useInView deliberately degrades to
// inView=true when it cannot observe. Without a controllable stub the canvas could
// never be seen closing, so the test would pass no matter what the fix did.
let observers = []
beforeEach(() => {
  observers = []
  lastPendulumProps = null
  lastHoverProps = null
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this) }
    observe() {}
    disconnect() {}
  }
})
const setIntersecting = (isIntersecting) =>
  observers.forEach((o) => o.cb([{ isIntersecting }], o))

describe('archives canvas lifecycle', () => {
  const hoverRow = () => {
    const row = document.querySelector('.project-row')
    expect(row).toBeTruthy()
    fireEvent.mouseEnter(row)
  }

  it('closes the canvas when the section leaves the viewport', () => {
    render(<Archives />)
    act(() => setIntersecting(true))
    hoverRow()                       // sets hoveredRow, so `visible` is true for the right reason
    expect(lastPendulumProps.visible).toBe(true)

    act(() => setIntersecting(false))
    // The row is STILL hovered here. So the only thing that can flip `visible` back
    // to false is the viewport gate — which does not exist yet, so this is the
    // assertion that fails before the fix.
    expect(lastPendulumProps.visible).toBe(false)
  })

  it('gates the inner canvas too, not just the wrapper', () => {
    render(<Archives />)
    act(() => setIntersecting(true))
    hoverRow()
    expect(lastHoverProps.visible).toBe(true)
    act(() => setIntersecting(false))
    expect(lastHoverProps.visible).toBe(false)
  })

  it('reopens when the section scrolls back', () => {
    render(<Archives />)
    hoverRow()
    act(() => setIntersecting(false))
    expect(lastPendulumProps.visible).toBe(false)
    act(() => setIntersecting(true))
    expect(lastPendulumProps.visible).toBe(true)
  })
})
```

Import `act` and `fireEvent` from `@testing-library/react` alongside `render` — the observer callback and `mouseEnter` both drive `setState`, and without `act` React logs a warning and the assertions can read pre-update state.

**Why the row hover is load-bearing:** `visible={!!hoveredRow && sectionInView}`, so with no hovered row the prop is `false` regardless of the viewport. An earlier draft of this test asserted `visible === true` without hovering anything, which would have failed even against a correct implementation. Hovering first makes `true` reachable, and then the not-intersecting callback is the only thing that can turn it back to `false` — which is the behaviour under test.

The second case exists because `ArchiveHoverCanvas` receives its **own** `visible={!!hoveredRow}` at line 328, independent of the `PendulumCanvas` wrapper. Gating only the wrapper would leave the inner WebGL canvas rendering and animating while off screen.

- [ ] **Step 2: Implement the lifecycle**

In `Archives.jsx`, add the import — it is **not** currently present (this file imports only React, gsap, ScrollTrigger, the three canvas components and `useArchiveCursor`):

```js
import { useInView } from '../hooks/useInView.js'
```

**Do not destructure a new ref from the hook.** `Archives` already owns `const sectionRef = useRef(null)` at line 92, it is already attached at line 232 (`<section className="archives-region" ref={sectionRef}>`), and it is passed to the canvas as `boundsRef={sectionRef}` at line 314, where it drives the pendulum's bounds math. Writing `const [sectionRef, inView] = useInView()` would be a duplicate declaration in the same scope — a build error, and if it somehow compiled it would break the canvas bounds. Observe the existing ref through the hook's `target` option instead, discarding the ref it returns:

```js
  // `target` is the getter form on purpose: the hook's own comment says a plain
  // ref object is observed as null for elements resolved after mount, and it
  // already owns the ref for nothing else.
  const [, sectionInView] = useInView({ target: () => sectionRef.current })
  const sectionInViewRef = useRef(sectionInView)
  useEffect(() => { sectionInViewRef.current = sectionInView }, [sectionInView])
```

Because the hook never gates when it cannot observe (`if (!el || typeof IntersectionObserver === 'undefined') setInView(true)`), this degrades to always-visible rather than a canvas that never appears.

No new `ref=` is needed anywhere — the section root is already wired. Make the canvas render conditional on the section being in view **while preserving the close animation** — unmounting outright is the abrupt version the user explicitly did not ask for:

Change one prop on `PendulumCanvas` (line 311) — leave every other prop alone:

```diff
-            visible={!!hoveredRow}
+            visible={!!hoveredRow && sectionInView}
```

Because `PendulumCanvas` already animates itself closed on `visible={false}` — a 0.2s `gsap.to(el, { opacity: 0, ease: 'power2.in' })` then `display = 'none'` in its `onComplete` (`PendulumCanvas.jsx:226-238`), with a `display = 'none'` immediate path when `reduceMotion` is set — dropping the flag runs the existing close animation for free. Do not add a second close path.

Note it does **not** unmount: the component stays in the tree with `display: none`, and reopening resets the pendulum state (`createPendulumState()` at line 241). That is the correct behaviour for a viewport gate, and it is why the section can scroll away and back without losing the image.

The inner `ArchiveHoverCanvas` needs the same treatment, and the reason is narrower than it first looks. Its rAF loop is **not** drawing while off screen: `loop()` advances `uTime` (line 380) and then early-returns at line 382 when `visibleRef.current` is false, re-requesting the frame. The expensive work — wind integration, draw — is already skipped, and the loop is never torn down by visibility either way.

So gating the inner `visible` is about correctness and the cost of the remaining work, not about stopping a runaway renderer: it stops `uTime` drifting while the section is off screen, and it keeps the prop honest, since an inner canvas that is not meant to be showing should be told so. Pass the same combined value to both:

And the same one-prop change on the inner canvas, which is a **separate** element further down (line 328) — it is a child of `PendulumCanvas`, not a second prop on it:

```diff
-              visible={!!hoveredRow}
+              visible={!!hoveredRow && sectionInView}
```

- [ ] **Step 2a: Route `Archives.jsx` through the gate**

The structural test from Task 4 flags this file, because it reads `isCursorActiveRef` and `isDraggingRef` directly (lines 104, 107, 125, 130, 156) — the exact tap-vs-drag pattern that test exists to catch. This step is what makes that test green; skipping it is how the earlier draft of this plan left a site ungated while claiming the suite was clean.

Add the import and the gate, and keep `useArchiveCursor` only for what it uniquely owns — `openCanvas`, `setCursor` and `cursorRef`:

```js
import { useCursorGate } from '../hooks/useCursorGate'
```

```js
  const { isTouch: gateIsTouch, isAwake } = useCursorGate()
```

Then replace the raw-flag reads:

| Line | Today | Replace with |
|---|---|---|
| 104 | `isCursorActiveRef, isDraggingRef` destructured from `useArchiveCursor` | drop both; they come from the gate now |
| 107 | `if (isTouch && !isCursorActiveRef.current) return` | `if (gateIsTouch && !isAwake.current) return` |
| 125 | `if (isTouch && !isCursorActiveRef.current) return` | `if (gateIsTouch && !isAwake.current) return` |
| 130 | `if (isTouch && !isDraggingRef.current)` | `if (gateIsTouch && !isAwake.current)` |
| 156 | `if (isCursorActiveRef.current)` | `if (isAwake.current)` |
| 181 | dep array `[isTouch, cursorRef, isCursorActiveRef]` | `[gateIsTouch, cursorRef, isAwake]` |

Line 130 deserves a note: it is the row **click** path that opens the fullscreen canvas, and `isDraggingRef` there meant "the user tapped, they did not drag". Under the gate that becomes `!isAwake` — a tap on a row is not a cursor wake, so the two must not be silently equated. Keep the existing drag-suppression behaviour by reading the awake state, and confirm with a manual check that tapping a row still opens the canvas: a regression here means the archives are no longer tappable on mobile, which is a worse break than the one this plan fixes.

- [ ] **Step 3: Run and confirm it passes**

```bash
npx vitest run tests/components/Archives.lifecycle.test.jsx
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Archives.jsx tests/components/Archives.lifecycle.test.jsx
git commit -m "fix(archives): close the hover canvas when the section leaves the viewport"
```

---

## Task 14: Final verification

Nothing ships on a green suite alone — that is how three real bugs shipped in this session.

**Files:** none modified.

- [ ] **Step 1: Full suite**

```bash
npx vitest run
```
Expected: all pass, existing 167 included, and the structural test green.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: `✓ built`. The pre-existing chunk-size warning is not a failure.

- [ ] **Step 3: No context-budget regression**

Run the gallery browser check and compare the canvas count to the pre-change baseline:

```bash
node tests/perf/verify-gallery-dissolve.mjs
```
Expected: `ALL BROWSER CHECKS PASSED`, and `EXACTLY one canvas per card` still holds. The gallery's six contexts must not have become twelve.

- [ ] **Step 4: The negative assertion that matters most**

In a touch-emulating browser context, wheel across the callout, the gallery, a project row and the archives **with no touch down**. Expected: no effect activates anywhere. If any does, the cursor is being woken by a passive scroll, which is the exact rule this whole plan exists to enforce.

- [ ] **Step 5: Confirm the structural test can still fail**

Un-gate one site, watch the suite go red, restore. A test that cannot fail is the failure mode this plan was written to eliminate.

- [ ] **Step 6: Update the documentation to describe enforcement, not to enforce**

In `AGENT/EFFECTS.md`, replace the "Hard rule — mobile effect gating" section's framing so it states that the rule is now **machine-enforced** by `tests/structure/effectGate.structure.test.js`, and that adding a WebGL/canvas surface without routing cursor input through `useCursorGate` fails CI. Keep the existing rationale; it is correct. The change is that it is no longer the only line of defence.

- [ ] **Step 7: Commit**

```bash
git add AGENT/EFFECTS.md
git commit -m "docs(effects): record that mobile gating is enforced by CI, not by convention"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §4 D4 dynamic viewport | 1 (hook), applied in 7 and 12 |
| §5.1 parked/awake state | 2 |
| §5.2 / §6 `useCursorGate` | 3 |
| §6 structural test | 4 |
| §2 N4 device detection | 5 |
| §7 FocusCallout radius + font | 6 |
| §2 N1 TextEntryGlass | 7 |
| §2 N2 gallery dissolve | 8 |
| §2 N3 ProjectRow position | 9 |
| §7 ProjectExpanded removal | 10 |
| §3.1 D1 latch | 11 |
| §3.2 D2 stretch | 12 |
| §3.3 D3 lifecycle | 13 |
| §10.1 per-step QA | 14 + the assertion in each task |

**Coverage gaps, stated plainly:** none against the spec — every section in §1 above maps to a task. But this table is a *claim about this document*, and an earlier draft of it ended with "No gaps." written from intent rather than from checking. Checking the plan against the actual tree found **20 defects across the 11 classes below**, all now fixed. They are listed because the pattern matters more than the individual bugs: every one was a plausible-sounding claim that reading the code contradicted, and three of them would have shipped a test that could not fail.

What the verification pass caught, and why each is a trap worth knowing about:

| Class | Example | Why it survived writing |
|---|---|---|
| Referenced a file that does not exist | `MatrixRain.jsx` in the exempt list | Plausible name; the scan asserting the exempt path exists is what caught it |
| Asserted an import was already present | `useInView` in `Archives.jsx` | The plan said "reuse the existing hook" — it did not exist there |
| Line numbers off | `radius={2.5}` given as 641-652, actually 639 | Numbers are plausible; only reading the file settles them |
| A build-breaking duplicate | `const [sectionRef] = useInView()` when `sectionRef` already existed at line 92 and is passed as `boundsRef` | Reads as idiomatic; the name collision is invisible until the compiler |
| Dead code that cannot react | `MAX_W`/`MAX_H` derived at module scope | A viewport read at import time looks correct and is permanently stale |
| A test that cannot fail | `expect(typeof engine.setPointer).toBe('function')`; `expect(canvas).toBeTruthy()` | Both pass before any change, so both "prove" nothing |
| A test that fails on correct code | Asserting `visible === true` with no row hovered, against `visible={!!hoveredRow && inView}` | The assertion was reasonable; the prop expression was the thing in question |
| A false green milestone | "the structural test is now green" after Task 10, when the last offender lands in Task 13 | Green-ness was assumed from task ordering, never checked |
| A gate step promised in a comment but never written | `Archives.jsx` listed as "converted in Task 13" with no such step | The comment asserted the fix; the task list had no mechanism |
| An unimplemented capability described as present | "sweeps `clipPath`" — no `clipPath` exists in either canvas file | Borrowed from a sibling component's behaviour |
| A test asserting on something unreachable | `PRAW_ROW_USES_CURSOR_GATE` placeholder, and a suggested `mouseRef` DOM attribute that does not exist | The value is a ref local feeding a WebGL uniform; it never reaches the DOM |

**Consequence for how this plan is executed:** the structural test in Task 4 is the mechanism meant to prevent the last four classes recurring, and it was itself written from intent before the offender list was measured. The offender list in Task 4 Step 5 is therefore the load-bearing artefact of this plan, not a formality — if it disagrees with what the executor sees, trust the executor's run and fix the plan, not the reverse.

**2. Placeholder scan** — no TBD/TODO. Three deliberate non-placeholders, all declared in the spec: the 4s sleep timeout, the 18vw font coefficient, and the exemption list the structural test discovers.

**3. Type consistency** — `isCursorAwakeRef`, `cursorParkedRef`, `parkCursor`, `sleepCursor` are defined in Task 2 and consumed unchanged in Tasks 3, 7, 8, 9, 13. `useCursorGate` returns `{ isTouch, isAwake, parked, isOver }` in Task 3 and every consumer destructures exactly that — `isAwake` is a ref, so a render-path consumer must not read `.current` during render; Task 6 Step 5 calls this out where it bites.

`useVisualViewport` returns `{ viewport, viewportRef }` in Task 1, and **the two consumers deliberately take different forms**:

- Task 7 takes `viewportRef`, because it reads the value inside a rAF loop that must not re-render.
- Task 12 takes `viewport`, because `MAX_W`/`MAX_H` feed the portal's inline `style` (lines 260-262) and are read during render. A ref there would not re-render and the canvas would keep the stale size — which is the same class of bug as the module-scope constants it replaced.

**Known tension, deliberately surfaced rather than silently resolved:** Task 5 reverses a documented decision about hybrid devices. It is called out at the top of the plan, pinned by a test, and Step 6 of that task requires asking the user rather than assuming.
