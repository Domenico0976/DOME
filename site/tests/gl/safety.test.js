// @vitest-environment jsdom
// Contract for the shared context-safety registry in src/gl/safety.js.
//
// Why this module exists: the page held seven `new THREE.WebGLRenderer(...)` sites and
// exactly one `webglcontextlost` listener. Mobile browsers cap live contexts and reclaim
// the oldest past the cap, so six of those surfaces could lose their context with nothing
// listening. `setupWebGLContextSafety` was already an export in MobileCanvas.jsx, so the
// primitive existed; it was just filed under one consumer.
//
// The assertion that matters most is the preventDefault one. Without it the browser never
// fires `webglcontextrestored`, so the recovery path would be unreachable code that still
// looks correct in review.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let releases = []

const loadRegistry = async () => {
  vi.resetModules()
  return import('../../src/gl/safety.js')
}

const makeCanvas = () => {
  const c = document.createElement('canvas')
  document.body.appendChild(c)
  return c
}

const fireContextLost = (canvas) => {
  const event = new Event('webglcontextlost', { cancelable: true })
  canvas.dispatchEvent(event)
  return event
}

beforeEach(() => {
  releases = []
})

afterEach(() => {
  for (const release of releases) release()
  releases = []
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('registerWebGLContext', () => {
  it('calls preventDefault on loss, so a restore can ever happen', async () => {
    const { registerWebGLContext } = await loadRegistry()
    const canvas = makeCanvas()
    releases.push(registerWebGLContext(canvas))

    const event = fireContextLost(canvas)
    expect(event.defaultPrevented).toBe(true)
  })

  it('notifies onLost and onRestored', async () => {
    const { registerWebGLContext } = await loadRegistry()
    const canvas = makeCanvas()
    const onLost = vi.fn()
    const onRestored = vi.fn()
    releases.push(registerWebGLContext(canvas, { onLost, onRestored }))

    fireContextLost(canvas)
    canvas.dispatchEvent(new Event('webglcontextrestored'))

    expect(onLost).toHaveBeenCalledTimes(1)
    expect(onRestored).toHaveBeenCalledTimes(1)
  })

  it('removes both listeners on unregister', async () => {
    const { registerWebGLContext } = await loadRegistry()
    const canvas = makeCanvas()
    const onLost = vi.fn()
    const release = registerWebGLContext(canvas, { onLost })

    release()
    fireContextLost(canvas)

    expect(onLost).not.toHaveBeenCalled()
  })

  it('covers several canvases from one implementation', async () => {
    const { registerWebGLContext } = await loadRegistry()
    const canvases = [makeCanvas(), makeCanvas(), makeCanvas()]
    const handlers = canvases.map(() => ({ onLost: vi.fn(), onRestored: vi.fn() }))
    canvases.forEach((c, i) => { releases.push(registerWebGLContext(c, handlers[i])) })

    for (const c of canvases) fireContextLost(c)
    for (const h of handlers) expect(h.onLost).toHaveBeenCalledTimes(1)
  })

  it('tolerates a missing canvas instead of throwing', async () => {
    const { registerWebGLContext } = await loadRegistry()
    expect(() => registerWebGLContext(null)()).not.toThrow()
    expect(() => registerWebGLContext(undefined)).not.toThrow()
  })

  it('still prevents default when no handlers were supplied', async () => {
    const { registerWebGLContext } = await loadRegistry()
    const canvas = makeCanvas()
    releases.push(registerWebGLContext(canvas))

    // The old MobileCanvas helper attached a bare listener whose only job was the
    // preventDefault. Dropping the handler argument must not drop that.
    expect(fireContextLost(canvas).defaultPrevented).toBe(true)
  })
})