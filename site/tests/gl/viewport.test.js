// @vitest-environment jsdom
// Contract for the shared viewport registry in src/gl/viewport.js.
//
// The point is not tidiness. Every section owning a WebGL surface wants the same thing:
// stop drawing when offscreen, because an offscreen renderer still costs a draw call per
// frame and still holds GPU memory that another context may need. Before this each
// consumer allocated its own IntersectionObserver and guessed its own margin — useInView
// used `240px 0px`, and archives/footer/gallery each picked their own. One observer with
// one margin keeps them consistent and gives the page a single place to see what is
// currently rendering.
//
// jsdom has no IntersectionObserver (Archives.lifecycle.test.jsx notes the same gap), so
// the harness below supplies one and lets each test drive the intersection records.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let releases = []
let instances = []

class FakeObserver {
  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.observed = new Set()
    instances.push(this)
  }

  observe(el) { this.observed.add(el) }

  unobserve(el) { this.observed.delete(el) }

  disconnect() { this.observed.clear(); this.disconnected = true }

  emit(entries) {
    this.callback(entries, this)
  }
}

const loadRegistry = async () => {
  vi.resetModules()
  return import('../../src/gl/viewport.js')
}

const makeEl = (top, bottom) => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top })
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  releases = []
  instances = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  window.innerHeight = 800
})

afterEach(() => {
  for (const release of releases) release()
  releases = []
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('subscribeInView', () => {
  it('reports the current state immediately, before any intersection fires', async () => {
    const { subscribeInView } = await loadRegistry()
    const seen = []
    // Mounted already on screen: a component that waits for the first observer callback
    // spends one frame rendering before it knows, which on a fast scroll is a visible flash.
    releases.push(subscribeInView(makeEl(100, 300), (v) => seen.push(v)))

    expect(seen).toEqual([true])
  })

  it('reports false for an element below the fold', async () => {
    const { subscribeInView } = await loadRegistry()
    const seen = []
    releases.push(subscribeInView(makeEl(2000, 2400), (v) => seen.push(v)))

    expect(seen).toEqual([false])
  })

  it('delivers later intersection changes', async () => {
    const { subscribeInView } = await loadRegistry()
    const el = makeEl(100, 300)
    const seen = []
    releases.push(subscribeInView(el, (v) => seen.push(v)))

    instances[0].emit([{ target: el, isIntersecting: false }])

    expect(seen).toEqual([true, false])
  })

  it('shares one observer across every subscriber', async () => {
    const { subscribeInView, inViewObserverCount } = await loadRegistry()
    const a = makeEl(100, 200)
    const b = makeEl(300, 400)
    const c = makeEl(500, 600)
    releases.push(subscribeInView(a, () => {}))
    releases.push(subscribeInView(b, () => {}))
    releases.push(subscribeInView(c, () => {}))

    expect(instances).toHaveLength(1)
    expect(inViewObserverCount()).toBe(1)
    expect(instances[0].observed.size).toBe(3)
  })

  it('uses one margin for all sections', async () => {
    const { subscribeInView } = await loadRegistry()
    releases.push(subscribeInView(makeEl(100, 200), () => {}))
    releases.push(subscribeInView(makeEl(300, 400), () => {}))

    // The old per-consumer margins disagreed (useInView used 240px); a shared registry has
    // to commit to one value or the inconsistency just moves. 80px keeps ~1 frame
    // of warm-up without firing during normal mobile scroll velocity.
    expect(instances[0].options.rootMargin).toBe('80px 0px')
  })

  it('stops delivering after unsubscribe', async () => {
    const { subscribeInView } = await loadRegistry()
    const el = makeEl(100, 300)
    const seen = []
    const release = subscribeInView(el, (v) => seen.push(v))

    release()
    instances[0].emit([{ target: el, isIntersecting: false }])

    expect(seen).toEqual([true])
  })

  it('disconnects the observer once the last subscriber leaves', async () => {
    const { subscribeInView, inViewObserverCount } = await loadRegistry()
    const a = makeEl(100, 200)
    const b = makeEl(300, 400)
    const releaseA = subscribeInView(a, () => {})
    const releaseB = subscribeInView(b, () => {})

    releaseA()
    expect(inViewObserverCount()).toBe(1)
    releaseB()
    expect(inViewObserverCount()).toBe(0)
  })

  it('keeps the observer alive for the remaining subscribers', async () => {
    const { subscribeInView, inViewObserverCount } = await loadRegistry()
    const a = makeEl(100, 200)
    const b = makeEl(300, 400)
    const releaseA = subscribeInView(a, () => {})
    releases.push(subscribeInView(b, () => {}))

    releaseA()

    expect(inViewObserverCount()).toBe(1)
  })

  it('tolerates a missing element or callback', async () => {
    const { subscribeInView } = await loadRegistry()
    expect(() => subscribeInView(null, () => {})()).not.toThrow()
    expect(() => subscribeInView(makeEl(0, 10), null)()).not.toThrow()
  })
})