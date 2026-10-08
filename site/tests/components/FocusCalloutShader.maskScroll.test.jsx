// @vitest-environment jsdom
// Regression test for the focus-callout mask rebuild storm.
//
// The contract: once the entrance has settled, scrolling the page must not produce
// a single new mask encode. The mask is a function of exactly two inputs â€” the
// layout, and the entrance state â€” and scroll is neither. The change-detection
// signature used to mix a live `span.getBoundingClientRect()` with a
// `containerRect` captured during an EARLIER `draw()`, so a scroll changed the
// signature and rebuilt a mask that was pixel-identical: ~30 encodes per second,
// for the whole duration of the scroll, entrance long since finished.
//
// The harness below reproduces the exact DOM that SelectedProjects.jsx:1408-1417
// renders around <FocusCalloutShader>. That coupling is load-bearing: mounted on
// its own, the component finds no `.focus-callout__text-line` descendants, falls
// into its no-DOM fallback, and the polling loop has nothing to read â€” so the bug
// would not reproduce and the test would pass vacuously.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import React from 'react'
import FocusCalloutShader from '../../src/components/FocusCalloutShader.jsx'

// Module-level so the identity is stable, exactly like the CALLOUT_LINES_*
// constants the real parent passes (SelectedProjects.jsx:19-20). A new array per
// render would remount the effect and the test would be measuring that instead.
const LINES = ['alpha', 'beta', 'gamma', 'delta']

// The component now reads cursor state through useCursorGate/useAwakeState, which
// destructure the parked/awake refs out of this same module — so the mock has to
// carry the full shape, not just the two flags it happened to need before. Still a
// non-touch device: the mask/scroll path under test is the desktop one.
vi.mock('../../src/hooks/useArchiveCursor', () => ({
  useArchiveCursor: () => ({
    isTouch: false,
    isCursorAwakeRef: { current: false },
    cursorParkedRef: { current: { x: 0, y: 0 } },
    subscribeCursorAwake: () => () => {},
  }),
}))

// WebGPU does not exist in jsdom and the shader stack is not what is under test;
// the encode path runs before any of it. Stub the components to plain markers.
vi.mock('shaders/react', () => ({
  Shader: ({ children, className }) => (
    <div className={className} data-testid="gl-stack">
      {children}
    </div>
  ),
  Swirl: () => null,
  ChromaFlow: () => null,
  FlutedGlass: () => null,
  FilmGrain: () => null,
  ImageTexture: () => null,
}))

const h = vi.hoisted(() => ({ encodes: 0, blobUrls: 0 }))

// â”€â”€ geometry under our control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Scroll moves the container and every span together, so their positions relative
// to each other never change. That is exactly the invariant the component claims
// in its own comment ("Relative to the container, so scrolling the page cannot
// change it") and the one this test holds it to.
const geo = { scrollY: 0, left: 0, top: 0, width: 1200, height: 400 }
const LINE_LEFT = 40
const LINE_WIDTH = 300
const LINE_HEIGHT = 100
// Kept separate from the mutable copy so beforeEach can restore it: one test
// deliberately shifts a line, and that must not leak into the others.
const LINE_TOP_BASE = LINES.map((_, i) => i * 110)
const LINE_TOP = [...LINE_TOP_BASE]
let LINE_WIDTH_OVERRIDE = 0

const resizeCallbacks = []
function fireResize() {
  for (const cb of resizeCallbacks) cb([], null)
}

function box(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }
}

function lineIndexOf(el) {
  const line = el.closest?.('.focus-callout__text-line')
  if (!line) return -1
  const list = el.closest('.focus-callout__text-wrapper')
  return Array.prototype.indexOf.call(list?.children ?? [], line)
}

function rectFor(el) {
  // The component resolves its container as `maskCanvas.parentElement`, which in
  // the real tree is the `.focus-callout` div.
  if (el.classList?.contains('focus-callout')) {
    return box(geo.left, geo.top - geo.scrollY, geo.width, geo.height)
  }
  const i = lineIndexOf(el)
  if (i >= 0) {
    const width = LINE_WIDTH_OVERRIDE || LINE_WIDTH
    return box(LINE_LEFT, LINE_TOP[i] - geo.scrollY, width, LINE_HEIGHT)
  }
  return box(0, 0, 0, 0)
}

// â”€â”€ 2D canvas stub â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// jsdom has no 2D context, and the component bails out of both cacheLine() and
// compositeLinesUrl() when it gets null, so nothing would ever be encoded.
// Where the mask actually blits each raster, in mask-canvas px. Recorded rather than
// inspected on the encoded image because the canvas stub has no pixels: this is the only
// place the drawn geometry is observable, and the scroll-invariance test below lives or
// dies on exactly these numbers.
const draws = []

const contexts = new WeakMap()
function makeCtx() {
  return {
    font: '',
    textBaseline: '',
    textAlign: '',
    fillStyle: '',
    letterSpacing: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    setTransform() {},
    clearRect() {},
    fillRect() {},
    fillText() {},
    strokeText() {},
    drawImage(img, x, y) { draws.push({ x, y }) },
    putImageData() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rect() {},
    clip() {},
    measureText: (t) => ({
      width: String(t).length * 12,
      fontBoundingBoxAscent: 70,
      fontBoundingBoxDescent: 20,
    }),
    getImageData: (_x, _y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h) * 4),
    }),
  }
}

// â”€â”€ clock + frame driver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let now = 0
let rafQueue = []

function stepFrame() {
  const queue = rafQueue
  rafQueue = []
  for (const cb of queue) cb(now)
}

// Advance n frames, each far enough apart to clear MASK_MIN_INTERVAL_MS (33ms), so
// the throttle can never be what is being measured. Wrapped in act() because a
// completed encode commits state (setMaskDataUrl) outside React's knowledge.
function advance(n) {
  act(() => {
    for (let i = 0; i < n; i++) {
      now += 50
      stepFrame()
    }
  })
}

const revealOf = new WeakMap()
const realGCS = window.getComputedStyle

function CalloutHarness({ handleRef }) {
  return (
    <div className="focus-callout focus-callout--shader">
      <FocusCalloutShader ref={handleRef} lines={LINES} />
      <div className="focus-callout__text-wrapper">
        {LINES.map((text) => (
          <div key={text} className="focus-callout__text-line">
            <span className="focus-callout__text">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mount, mark the entrance as finished, and let everything settle. */
function mountSettled() {
  const view = render(<CalloutHarness />)
  for (const line of view.container.querySelectorAll('.focus-callout__text-line')) {
    revealOf.set(line, 1)
  }
  advance(6)
  return view
}

describe('focus callout mask â€” no rebuild on scroll once the entrance has settled', () => {
  let rectSpy
  let nowSpy

  beforeEach(() => {
    h.encodes = 0
    h.blobUrls = 0
    geo.scrollY = 0
    geo.width = 1200
    now = 0
    rafQueue = []
    resizeCallbacks.length = 0
    LINE_WIDTH_OVERRIDE = 0
    LINE_TOP.splice(0, LINE_TOP.length, ...LINE_TOP_BASE)

    // jsdom has no ResizeObserver, and layout changes are how the mask is
    // invalidated now that no frame loop is watching for them.
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb) {
        resizeCallbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    // The global setup polyfill answers `true` to any query without a width
    // keyword, so `(prefers-reduced-motion: reduce)` would match and the component
    // would render the reduced-motion probe instead of the effect.
    vi.stubGlobal('matchMedia', () => ({
      media: '',
      matches: false,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)

    rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function () {
        return rectFor(this)
      })

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (kind) {
      if (kind !== '2d') return null
      if (!contexts.has(this)) contexts.set(this, makeCtx())
      return contexts.get(this)
    })

    // The encode counter. One toBlob == one mask rebuild attempt.
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      h.encodes += 1
      cb({ size: 4, type: 'image/png' })
    }

    // Must be unique per call: the component drops an encode whose URL is
    // unchanged, and a constant URL would make the test pass vacuously.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => `blob:mock/${++h.blobUrls}`,
      revokeObjectURL: vi.fn(),
    })

    vi.stubGlobal('getComputedStyle', (el) => {
      const cs = realGCS(el)
      return new Proxy(cs, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return (name) =>
              name === '--reveal'
                ? String(revealOf.get(el) ?? 0)
                : target.getPropertyValue(name)
          }
          const value = target[prop]
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    })

    // A second deferred draw through document.fonts.ready would be a second
    // encode nobody asked for; the entrance settled path does not need it.
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    rectSpy?.mockRestore()
    nowSpy?.mockRestore()
  })

  it('builds the static mask once the entrance is finished, then stops', () => {
    mountSettled()
    // The first draw rasterises and encodes; from there the signature is stable,
    // so a settled callout must go quiet rather than keep encoding.
    const afterFirstDraw = h.encodes
    expect(afterFirstDraw).toBeGreaterThan(0)
    advance(30)
    expect(h.encodes).toBe(afterFirstDraw)
  })

  it('produces no new mask encode while the page scrolls with the entrance settled', () => {
    mountSettled()
    const beforeScroll = h.encodes
    expect(beforeScroll).toBeGreaterThan(0)

    // Container and spans move together, so the mask is byte-identical after the
    // scroll. Any encode here is pure waste â€” and that is the reported lag.
    geo.scrollY = 60
    advance(20)

    expect(h.encodes).toBe(beforeScroll)
  })

  it('stays quiet across a long scroll in the opposite direction too', () => {
    mountSettled()
    const beforeScroll = h.encodes

    for (const y of [40, 120, 240, 0, -60]) {
      geo.scrollY = y
      advance(6)
    }

    expect(h.encodes).toBe(beforeScroll)
  })

  it('does not read layout every frame once the entrance is finished', () => {
    mountSettled()
    rectSpy.mockClear()
    advance(30)
    // The loop is supposed to be scoped to the entrance. A settled callout that
    // still walks the DOM 30 times over is the cost this test exists to kill,
    // independent of whether it happens to encode anything.
    expect(rectSpy).not.toHaveBeenCalled()
  })

  it('spends nothing on continuous scroll, which is what the fix bought', () => {
    mountSettled()
    const beforeScroll = h.encodes

    // Lenis-driven scrolling moves the page every frame, not in jumps. Before the
    // fix the stale-containerRect signature missed on two frames out of three and
    // measured 20 wasted encodes in 30 frames; the scroll-invariant offsets now
    // make the composite a no-op.
    for (let i = 0; i < 30; i++) {
      geo.scrollY += 4
      act(() => {
        now += 50
        stepFrame()
      })
    }

    expect(h.encodes).toBe(beforeScroll)
  })

  it('rebuilds when the layout actually changes, not when it does not', () => {
    mountSettled()
    const beforeResize = h.encodes

    // A real layout change: the callout re-wraps to a different width, which
    // invalidates the glyph rasters. This is the case a rebuild exists for, and
    // ResizeObserver is what has to make it happen.
    geo.width = 900
    fireResize()
    advance(2)

    expect(h.encodes).toBeGreaterThan(beforeResize)
  })

  it('rebuilds when a line is re-wrapped to a different width', () => {
    mountSettled()
    const beforeResize = h.encodes

    LINE_WIDTH_OVERRIDE = 220
    fireResize()
    advance(2)

    expect(h.encodes).toBeGreaterThan(beforeResize)
  })
})

describe('focus callout mask â€” the rebuild handle the entrance drives', () => {
  let nowSpy

  beforeEach(() => {
    h.encodes = 0
    h.blobUrls = 0
    geo.scrollY = 0
    geo.width = 1200
    now = 0
    rafQueue = []
    resizeCallbacks.length = 0
    LINE_WIDTH_OVERRIDE = 0
    LINE_TOP.splice(0, LINE_TOP.length, ...LINE_TOP_BASE)

    vi.stubGlobal('matchMedia', () => ({
      media: '',
      matches: false,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return rectFor(this)
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (kind) {
      if (kind !== '2d') return null
      if (!contexts.has(this)) contexts.set(this, makeCtx())
      return contexts.get(this)
    })
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      h.encodes += 1
      cb({ size: 4, type: 'image/png' })
    }
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => `blob:mock/${++h.blobUrls}`,
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('getComputedStyle', (el) => {
      const cs = realGCS(el)
      return new Proxy(cs, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return (name) =>
              name === '--reveal'
                ? String(revealOf.get(el) ?? 0)
                : target.getPropertyValue(name)
          }
          const value = target[prop]
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    })
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    nowSpy?.mockRestore()
  })

  it('encodes when the entrance asks it to', () => {
    // The whole effect depends on this: the mask starts empty (--reveal is 0 in
    // CSS), so if nothing ever calls rebuild() the callout is simply invisible.
    const handleRef = React.createRef()
    const view = render(<CalloutHarness handleRef={handleRef} />)
    for (const line of view.container.querySelectorAll('.focus-callout__text-line')) {
      revealOf.set(line, 1)
    }
    advance(4)
    const before = h.encodes

    act(() => handleRef.current.rebuild(true))

    expect(h.encodes).toBeGreaterThan(before)
  })

  it('throttles rebuilds, and lets the final one through regardless', () => {
    const handleRef = React.createRef()
    const view = render(<CalloutHarness handleRef={handleRef} />)
    for (const line of view.container.querySelectorAll('.focus-callout__text-line')) {
      revealOf.set(line, 1)
    }
    advance(4)
    const before = h.encodes

    act(() => {
      handleRef.current.rebuild(true)
      handleRef.current.rebuild()
      handleRef.current.rebuild()
    })
    // Two of those three land inside MASK_MIN_INTERVAL_MS of the first.
    expect(h.encodes).toBe(before + 1)

    // A forced rebuild ignores the throttle: the entrance's last tick is the one
    // that settles the callout, and dropping it can leave a line part-revealed.
    now += 100
    const beforeForced = h.encodes
act(() => handleRef.current.rebuild(true))
    expect(h.encodes).toBe(beforeForced + 1)
  })

  it('draws the mask in the same place after the page has scrolled', () => {
    // Regression guard for a bug this file's own geometry model made easy to write. The
    // mask cache stores each line's resting box, and the live position is recovered by
    // differencing the span's current rect against the one captured at cache time. Those
    // two reads happen in DIFFERENT frames. If the cached rect is a raw viewport rect, the
    // difference is the scroll delta, and every line is drawn thousands of pixels off —
    // which empties the mask entirely rather than misplacing it, so it reads as "the text
    // vanished" instead of "the text is in the wrong place". Both sides of the difference
    // have to be container-relative for the page's scroll to cancel out.
    const handleRef = React.createRef()
    const view = render(<CalloutHarness handleRef={handleRef} />)
    for (const line of view.container.querySelectorAll('.focus-callout__text-line')) {
      revealOf.set(line, 1)
    }
    advance(6)

    draws.length = 0
    act(() => handleRef.current.rebuild(true))
    const atRest = draws.map((d) => ({ x: d.x, y: d.y }))
    expect(atRest.length).toBeGreaterThan(0)

    // Far enough to be unmistakable, and not a multiple of the line pitch, so a partial
    // compensation could not accidentally pass.
    geo.scrollY = 4230
    draws.length = 0
    act(() => handleRef.current.rebuild(true))
    const afterScroll = draws.map((d) => ({ x: d.x, y: d.y }))

    expect(afterScroll).toEqual(atRest)
    // Spelled out as well, so a failure says what went wrong rather than only that two
    // arrays differ.
    for (const d of afterScroll) {
      expect(Math.abs(d.y)).toBeLessThan(geo.height)
    }
  })
})

