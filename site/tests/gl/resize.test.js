// @vitest-environment jsdom
// Contract for the shared resize registry in src/gl/resize.js.
//
// The regression this guards is the hero-glass scattering on mobile. `.text-entry` is
// `height: 100dvh`, and `dvh` tracks the browser UI, so scrolling collapsed/expanded the
// URL bar and changed the element's height. The old per-section ResizeObserver called
// engine.resize() on every one of those, reallocating the WebGL drawing buffer mid-scroll.
// jsdom gives clientWidth/clientHeight as 0, so every case below drives them explicitly —
// otherwise the registry would skip the element (`if (!width || !height) continue`) and
// these tests would pass vacuously.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const LAYOUT = 800

let rafQueue = []
let releases = []

const setLayoutHeight = (value) => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value })
}

const makeEl = (width, height) => {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => height })
  Object.defineProperty(el, 'isConnected', { configurable: true, get: () => true })
  document.body.appendChild(el)
  return el
}

const resizeEl = (el, width, height) => {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => height })
}

const flushFrames = () => {
  const pending = rafQueue
  rafQueue = []
  for (const cb of pending) cb(16)
}

// Each test gets a fresh module: the registry keeps per-entry baselines, and reusing the
// module across tests would let one case's baseline decide another's outcome.
const loadRegistry = async () => {
  vi.resetModules()
  return import('../../src/gl/resize.js')
}

beforeEach(() => {
  rafQueue = []
  releases = []
  setLayoutHeight(LAYOUT)
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  for (const release of releases) release()
  releases = []
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('registerResize', () => {
  it('reports the current size immediately, before any event', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ width: 400, height: 600, orientation: false })
  })

  it('ignores a height-only change while the layout viewport is stable', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    // The URL bar collapses: the element follows dvh down, the layout viewport does not.
    resizeEl(el, 400, 700)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen).toHaveLength(1)
  })

  it('stays quiet across a whole scroll of dvh churn', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    for (const h of [620, 660, 700, 660, 620, 660, 700]) {
      resizeEl(el, 400, h)
      window.dispatchEvent(new Event('resize'))
      flushFrames()
    }

    expect(seen).toHaveLength(1)
  })

  it('delivers a width change even though the height also moved', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    // A real rotation: the width is the tell, and the previous height was never allocated.
    resizeEl(el, 700, 600)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen).toHaveLength(2)
    expect(seen[1]).toMatchObject({ width: 700, height: 600 })
  })

  it('flags an orientation flip', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    resizeEl(el, 600, 400)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen[1].orientation).toBe(true)
  })

  it('delivers a height change when the layout viewport itself moved', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    setLayoutHeight(500)
    resizeEl(el, 400, 500)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen).toHaveLength(2)
    expect(seen[1]).toMatchObject({ width: 400, height: 500 })
  })

  it('still fires for a height change when allowHeight opts out of the filter', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s), { allowHeight: true }))

    resizeEl(el, 400, 700)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen).toHaveLength(2)
  })

  it('coalesces a burst of events into one delivery per frame', async () => {
    const { registerResize } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    releases.push(registerResize(el, (s) => seen.push(s)))

    resizeEl(el, 500, 600)
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('orientationchange'))
    expect(rafQueue).toHaveLength(1)

    flushFrames()
    expect(seen).toHaveLength(2)
  })

  it('keeps baselines separate between registered surfaces', async () => {
    const { registerResize } = await loadRegistry()
    const wide = makeEl(1200, 600)
    const narrow = makeEl(300, 600)
    const wideSeen = []
    const narrowSeen = []
    releases.push(registerResize(wide, (s) => wideSeen.push(s)))
    releases.push(registerResize(narrow, (s) => narrowSeen.push(s)))

    // Only the wide one changes. A shared module-level baseline would have compared the
    // narrow element against 1200 and fired it spuriously, or swallowed this resize.
    resizeEl(wide, 1400, 600)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(wideSeen).toHaveLength(2)
    expect(narrowSeen).toHaveLength(1)
  })

  it('stops delivering after unregister', async () => {
    const { registerResize, resizeSubscriberCount } = await loadRegistry()
    const el = makeEl(400, 600)
    const seen = []
    const release = registerResize(el, (s) => seen.push(s))
    expect(resizeSubscriberCount()).toBe(1)

    release()
    resizeEl(el, 500, 600)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen).toHaveLength(1)
    expect(resizeSubscriberCount()).toBe(0)
  })

  it('keeps listening while any surface is still registered', async () => {
    const { registerResize } = await loadRegistry()
    const a = makeEl(400, 600)
    const b = makeEl(400, 600)
    const seen = []
    const releaseA = registerResize(a, (s) => seen.push(s))
    const releaseB = registerResize(b, (s) => seen.push(s))
    releaseA()

    resizeEl(b, 500, 600)
    window.dispatchEvent(new Event('resize'))
    flushFrames()

    expect(seen).toHaveLength(3)
    releaseB()
  })
})