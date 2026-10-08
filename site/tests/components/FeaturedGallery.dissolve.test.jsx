// @vitest-environment jsdom
// Pins the hover dissolve reveal in FeaturedGallery.
//
// The gallery had NO test coverage before this, which is the whole reason these
// assertions exist: two of them guard a documented, previously-shipped regression
// (Chrome's context-loss storm from per-hover renderer churn) and would otherwise
// fail silently if someone "simplified" the two-mesh scene back into two canvases.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import gsap from 'gsap'

const h = vi.hoisted(() => {
  const renderers = []
  const textures = []
  const loadedUrls = []
  // Every ShaderMaterial ever constructed, so a test can ask what a given scene is
  // made of without reaching into three.js internals.
  const materials = []
  const cameras = []
  // URLs the fake loader should reject, so the failure paths are reachable in a test.
  const failUrls = new Set()
  // Mutable input state, because the touch gate is the thing under test: a test has
  // to be able to say "touch device, cursor asleep" and then "cursor awake".
  const cursor = { isTouch: false, awake: false, parked: { x: 0, y: 0 } }
  return { renderers, textures, loadedUrls, materials, cameras, failUrls, cursor }
})

vi.mock('three', () => {
  class Vector2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y }
    set(x, y) { this.x = x; this.y = y }
  }
  class WebGLRenderer {
    constructor(opts) {
      this.domElement = opts?.canvas
      this.calls = { setPixelRatio: 0, setClearColor: 0, setSize: 0, render: 0, dispose: 0, forceContextLoss: 0 }
      h.renderers.push(this)
    }
    setPixelRatio() { this.calls.setPixelRatio++ }
    setClearColor() { this.calls.setClearColor++ }
    setSize() { this.calls.setSize++ }
    getPixelRatio() { return 1 }
    render() { this.calls.render++ }
    dispose() { this.calls.dispose++ }
    forceContextLoss() { this.calls.forceContextLoss++ }
  }
  class ShaderMaterial {
    constructor(opts) {
      this.uniforms = opts?.uniforms || {}
      this.vertexShader = opts?.vertexShader
      this.fragmentShader = opts?.fragmentShader
      this.transparent = opts?.transparent
      h.materials.push(this)
    }
    dispose() {}
  }
  class Mesh {
    constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = { z: 0 } }
  }
  class Scene {
    constructor() { this.children = [] }
    add(o) { this.children.push(o) }
    traverse(fn) { this.children.forEach(fn) }
  }
  class OrthographicCamera {
    constructor(...a) { this.args = a; this.position = { z: 0 }; h.cameras.push(this) }
  }
  class PlaneGeometry {
    constructor(w, h) { this.w = w; this.h = h }
    dispose() {}
  }
  class TextureLoader {
    // Invoked synchronously: the gallery's build is already Promise-chained, and
    // flushing here keeps the assertions free of timer plumbing. A real decode is
    // async, but nothing under test depends on that ordering.
    load(url, onLoad, _onProgress, onError) {
      h.loadedUrls.push(url)
      if (h.failUrls.has(url)) { onError?.(new Error('blocked')); return }
      const tex = { image: { width: 400, height: 300 }, dispose() {} }
      h.textures.push(tex)
      onLoad?.(tex)
    }
  }
  return {
    Vector2, WebGLRenderer, ShaderMaterial, Mesh, Scene, OrthographicCamera, PlaneGeometry,
    TextureLoader,
    SRGBColorSpace: 'srgb',
    LinearFilter: 1006,
  }
})

vi.mock('gsap', () => {
  // The dissolve is driven by gsap.to(), so the mock has to actually run the tween for
  // the hover assertions to mean anything. A bare vi.fn() records the call and moves
  // nothing, which is exactly how a listener that was never attached still looks
  // plausible from a unit test.
  const tweens = []
  return {
    default: {
      registerPlugin: vi.fn(),
      context: (fn) => { fn(); return { revert: vi.fn() } },
      fromTo: vi.fn(),
      to: (target, vars) => {
        // The from/to pair is captured at CREATION time, which is the only way a test
        // can express "the tween was interrupted halfway" — mutating `target.v`
        // afterwards does not travel back to the item, because onComplete has already
        // written the final value into it.
        const numeric = typeof vars.v === 'number' && typeof target.v === 'number'
        const from = numeric ? target.v : undefined
        const to = numeric ? vars.v : undefined
        const tween = {
          target,
          vars,
          killed: false,
          kill() { this.killed = true },
          progress(f) {
            if (numeric) target.v = from + (to - from) * f
            vars.onUpdate?.()
          },
          // Jump to the end: these tests assert the DESTINATION state, not the curve.
          // The curve is GSAP's business.
          finish() {
            this.progress(1)
            vars.onComplete?.()
          },
        }
        tweens.push(tween)
        return tween
      },
      set: vi.fn(),
      ticker: { add: vi.fn(), remove: vi.fn() },
      __tweens: tweens,
    },
  }
})

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: vi.fn(), update: vi.fn(), refresh: vi.fn(), config: vi.fn() },
}))

vi.mock('../../src/hooks/useArchiveCursor', () => ({
  useArchiveCursor: () => ({
    isMobile: false,
    isTouch: h.cursor.isTouch,
    isDraggingRef: { current: h.cursor.isTouch && h.cursor.awake },
    cursorRef: { current: h.cursor.parked },
    isCursorActiveRef: { current: h.cursor.isTouch && h.cursor.awake },
    openCanvas: vi.fn(),
  }),
  ArchiveCursorProvider: ({ children }) => children,
}))

// The gallery reads its gate through useCursorGate, so the mock has to answer with
// the same mutable state. `isAwake` stays a ref, matching the real hook's shape.
vi.mock('../../src/hooks/useCursorGate', () => ({
  useCursorGate: () => ({
    isTouch: h.cursor.isTouch,
    isAwake: { current: h.cursor.awake },
    parked: { current: h.cursor.parked },
    isOver: () => false,
  }),
  useAwakeState: () => h.cursor.awake,
}))

let reduced = false
let rectSpy
beforeEach(() => {
  reduced = false
  h.renderers.length = 0
  h.textures.length = 0
  h.loadedUrls.length = 0
  h.materials.length = 0
  h.cameras.length = 0
  h.failUrls.clear()
  h.cursor.isTouch = false
  h.cursor.awake = false
  h.cursor.parked = { x: 0, y: 0 }
  // jsdom measures everything as 0x0, which makes uPlaneAspect NaN and hides the
  // 4:3-vs-card-aspect relationship the shader depends on.
  rectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0 })
  vi.stubGlobal('matchMedia', (query) => ({
    media: query,
    get matches() { return query.includes('prefers-reduced-motion') ? reduced : false },
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  // jsdom never fetches an <img>, so `complete` is false forever and the gallery's
  // pre-build gate (which awaits img.complete) would never open. Without this the
  // builder is unreachable and every assertion below would be testing nothing.
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get: () => true,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  rectSpy?.mockRestore()
})

// The build is Promise-chained (img.complete -> Promise.all -> buildGalleryGL), so
// every test has to let the microtask queue drain before it can see any of this.
const flush = async () => { await new Promise((r) => setTimeout(r, 0)) }

// requestAnimationFrame is stubbed to a no-op in this file (see beforeEach), so no
// real frame will ever arrive and the gallery's tick loop dies after its first pass.
// Drive it directly instead: grab the callback it scheduled and call it. Deterministic
// and instant, where waiting on a real frame would just time out.
const pump = (times = 3) => {
  const rafMock = vi.mocked(requestAnimationFrame)
  for (let i = 0; i < times; i += 1) {
    const calls = rafMock.mock.calls
    const last = calls[calls.length - 1]
    if (!last) break
    const cb = last[0]
    rafMock.mockClear()
    if (typeof cb === 'function') cb(performance.now())
  }
}

const load = async () => {
  const result = render(<FeaturedGallery />)
  await flush()
  return result
}

let FeaturedGallery
beforeEach(async () => {
  FeaturedGallery = (await import('../../src/components/FeaturedGallery.jsx')).default
})

const frames = (c) => Array.from(c.querySelectorAll('.gl-media__frame'))

describe('gallery hover dissolve', () => {
  it('gives every card a second image, distinct and 4:3', async () => {
    const { container } = await load()
    const backs = frames(container).map((f) => f.dataset.imgBack)
    expect(backs).toHaveLength(6)
    for (const b of backs) {
      expect(b).toMatch(/^https:\/\/picsum\.photos\/seed\/[^/]+\/400\/300$/)
    }
    // Distinct, or two cards would reveal the same placeholder and read as a bug.
    expect(new Set(backs).size).toBe(backs.length)
  })

  it('spends exactly one WebGL context per card, not two', async () => {
    const { container } = await load()
    // THE regression guard. The gallery's own comment records that renderer churn
    // triggered Chrome's context-loss storm, and the obvious way to "add a layer" is
    // a second <canvas>. Two meshes in one scene is the constraint, not an accident.
    expect(h.renderers).toHaveLength(frames(container).length)
  })

  it('builds two meshes in one scene, back behind front, not two canvases', async () => {
    const { container } = await load()
    expect(container.querySelectorAll('canvas.gl-media__canvas')).toHaveLength(6)
    // Two ShaderMaterials per card: the front dissolve layer and the revealed one.
    expect(h.materials).toHaveLength(12)
    const byCard = h.materials.filter((m) => m.uniforms.uDissolve)
    expect(byCard).toHaveLength(6)
  })

  it('extends the camera frustum so the back layer at z=-0.1 is not clipped', async () => {
    await load()
    // The old camera was OrthographicCamera(-1, 1, 1, -1, 0, 1) with the mesh at z=0
    // and the camera at z=1: the mesh sat exactly ON the far plane. A back layer at
    // z=-0.1 is 1.1 from the camera and would be clipped away entirely, so the far
    // plane has to exceed 1.1 for the reveal to be visible at all.
    expect(h.cameras.length).toBeGreaterThan(0)
    for (const c of h.cameras) {
      const far = c.args[5]
      expect(far).toBeGreaterThan(1.1)
    }
  })

  it('never lets the front layer ripple: it has no cursor uniforms at all', async () => {
    await load()
    const front = h.materials.filter((m) => m.uniforms.uDissolve)
    expect(front.length).toBeGreaterThan(0)
    for (const m of front) {
      // Structural, not a gate someone can flip: the un-revealed image has no
      // uHover/uMouse to drive a displacement with.
      expect(m.uniforms.uHover).toBeUndefined()
      expect(m.uniforms.uMouse).toBeUndefined()
    }
    const back = h.materials.filter((m) => m.uniforms.uRippleActive)
    expect(back).toHaveLength(6)
    for (const m of back) {
      expect(m.uniforms.uHover).toBeDefined()
      expect(m.uniforms.uMouse).toBeDefined()
    }
  })

  it('holds the ripple off until the dissolve has uncovered the back image', async () => {
    await load()
    const back = h.materials.find((m) => m.uniforms.uRippleActive)
    expect(back.uniforms.uRippleActive.value).toBe(0)
    expect(back.uniforms.uDarkness.value).toBe(1)
    const front = h.materials.find((m) => m.uniforms.uDissolve)
    expect(front.uniforms.uDissolve.value).toBe(0)
    // The erosion origin is the card centre and nothing else.
    expect(front.uniforms.uCenter.value.x).toBe(0.5)
    expect(front.uniforms.uCenter.value.y).toBe(0.5)
  })

  it('builds nothing at all under reduced motion', async () => {
    reduced = true
    const { container } = await load()
    expect(h.renderers).toHaveLength(0)
    // .is-ready is what hides the <img> and shows the canvas, so it must be absent or
    // the card would be left showing nothing.
    for (const f of frames(container)) expect(f.classList.contains('is-ready')).toBe(false)
  })

  it('requests only the front image (no separate back fetch) and readies all cards', async () => {
    const { container } = await load()
    // Single texture per card now (the back reuses it), so no picsum request occurs.
    const picsum = h.loadedUrls.filter((u) => u.includes('picsum'))
    expect(picsum).toHaveLength(0)
    const fronts = h.loadedUrls.filter((u) => !u.includes('picsum'))
    expect(fronts).toHaveLength(6)
    for (const f of frames(container)) expect(f.classList.contains('is-ready')).toBe(true)
  })

  // The next three are the regression guards for a bug the headless browser run
  // caught, not something anticipated: the two texture loads were originally nested,
  // so a failing back image meant the front load was never issued. `pending` could
  // then never reach zero, the render loop for the WHOLE gallery never started, and
  // every card silently stayed on its plain <img>. Nothing in jsdom failed, because
  // a nested load that never runs is indistinguishable from a slow one.
  it('requests the front image for all six cards', async () => {
    await load()
    const fronts = h.loadedUrls.filter((u) => !u.includes('picsum'))
    // Six front images, one per card.
    expect(fronts).toHaveLength(6)
    for (const u of fronts) expect(u).toMatch(/assets\/images\/projects/)
  })

  it('reveals the SAME image in colour (back reuses the front texture)', async () => {
    await load()
    // The dissolve must show B&W -> colour of the SAME picture, so the back layer's
    // texture IS the front layer's texture (not a separate picsum placeholder).
    const fronts = h.materials.filter((m) => m.uniforms.uDissolve).map((m) => m.uniforms.uTex.value)
    const backs = h.materials.filter((m) => m.uniforms.uRippleActive).map((m) => m.uniforms.uTex.value)
    expect(backs).toHaveLength(6)
    for (let i = 0; i < 6; i++) expect(backs[i]).toBe(fronts[i])
    // And the revealed layer carries no grayscale uniform (it renders full colour).
    for (const m of h.materials.filter((m) => m.uniforms.uRippleActive)) {
      expect(m.uniforms.uGrayscale).toBeUndefined()
    }
  })

  it('keeps building cards when the FRONT image fails', async () => {
    // The front image IS the card, so its loss is fatal for that card alone — but it
    // must not stall the gallery, which is the same `pending` counter.
    const { container } = await load()
    const front = h.loadedUrls.find((u) => u.includes('DOME'))
    h.failUrls.add(front)
    // A second mount is needed: the module-level gallery cache means the first build
    // is reused, and this is a fresh-render assertion.
    cleanup()
    h.loadedUrls.length = 0
    h.failUrls.add(front)
    const second = render(<FeaturedGallery />)
    await flush()
    const fs2 = Array.from(second.container.querySelectorAll('.gl-media__frame'))
    expect(fs2).toHaveLength(6)
    // The rest of the gallery still came up.
    expect(fs2.filter((f) => f.classList.contains('is-ready')).length).toBeGreaterThan(0)
  })

  // The listener bug. The dissolve's hover pair was attached in a loop over `items` at
  // the end of buildGalleryGL — but `items` is filled by the ASYNC texture callback, so
  // that loop iterated an empty array and wired nothing. The effect never fired, and
  // every check above still passed: they assert structure and uniforms, and a card
  // whose dissolve never runs has perfectly correct uniforms. The headless browser run
  // is what caught it, because the CSS scale(1.02) hover lift changes pixels and made
  // the dead effect look alive in a screenshot diff.
  it('attaches the dissolve hover listeners to a card that exists', async () => {
    const { container } = await load()
    const card = frames(container)[0]
    // jsdom has no PointerEvent constructor for this in older versions, and the
    // listener only reads its (unused) argument, so a plain Event is enough.
    card.dispatchEvent(new Event('pointerenter'))
    expect(gsap.__tweens.length).toBeGreaterThan(0)
    const tween = gsap.__tweens.at(-1)
    expect(tween.vars.v).toBe(1)
    // Slow but with ease-OUT: the erosion starts IMMEDIATELY on hover (no sluggish
    // start) and decelerates into the reveal, emphasising the pixel-cell crumble.
    expect(tween.vars.duration).toBe(1.25)
    expect(tween.vars.ease).toBe('power2.out')
  })

  it('drives the dissolve to 1 on enter and back to 0 on leave', async () => {
    const { container } = await load()
    const card = frames(container)[0]
    const front = h.materials.find((m) => m.uniforms.uDissolve)
    const back = h.materials.find((m) => m.uniforms.uRippleActive)

    gsap.__tweens.length = 0
    card.dispatchEvent(new Event('pointerenter'))
    gsap.__tweens.at(-1).finish()
    // Finishing the tween writes item.dissolve, but the uniform is only copied in the
    // render loop, so the tick has to run for the shader to see it. Assert the tween's
    // destination rather than the uniform: the loop is a separate concern with its own
    // coverage, and asserting through it would make this test depend on rAF timing.
    expect(gsap.__tweens.at(-1).target.v).toBe(1)
    expect(front.uniforms.uDissolve.value).toBe(0)

    card.dispatchEvent(new Event('pointerleave'))
    const back2 = gsap.__tweens.at(-1)
    expect(back2.vars.v).toBe(0)
    // Leaving is quicker than arriving, deliberately.
    expect(back2.vars.duration).toBe(0.4)
    expect(back).toBeDefined()
  })

  it('re-entering mid-reverse continues from the current value', async () => {
    const { container } = await load()
    const card = frames(container)[0]
    gsap.__tweens.length = 0

    // Hover, then interrupt the forward tween halfway.
    card.dispatchEvent(new Event('pointerenter'))
    const forward = gsap.__tweens.at(-1)
    forward.progress(0.5)
    card.dispatchEvent(new Event('pointerleave'))
    const reverse = gsap.__tweens.at(-1)
    // Seeded from 0.5, not from 0. Starting from 0 would snap a card that was flicked
    // twice visibly back to the start of the reveal.
    expect(reverse.target.v).toBe(0.5)

    // Interrupt the reverse halfway too, then come back: 0.5 - 0.25 of the way.
    reverse.progress(0.5)
    expect(reverse.target.v).toBe(0.25)
    card.dispatchEvent(new Event('pointerenter'))
    expect(gsap.__tweens.at(-1).target.v).toBe(0.25)
    // And the interrupted tween was killed, not left running against the new one.
    expect(forward.killed).toBe(true)
    expect(reverse.killed).toBe(true)
  })

  it('kills the dissolve tween on dispose, so it cannot write to a dead renderer', async () => {
    const { container } = await load()
    const card = frames(container)[0]
    gsap.__tweens.length = 0
    card.dispatchEvent(new Event('pointerenter'))
    const tween = gsap.__tweens.at(-1)
    expect(tween.killed).toBe(false)
    cleanup()
    // A live tween holds a reference to a uniform on a disposed context, and
    // forceContextLoss has already been called by then.
    expect(tween.killed).toBe(true)
    expect(card.isConnected).toBe(false)
  })

  // `active` shipped as a variable name in the back layer and is a reserved word in
  // GLSL ES. It compiled to nothing: the whole fragment shader was rejected, the back
  // layer never drew, and every other assertion in this file still passed. jsdom has no
  // GL context, so a syntax error in a shader is structurally invisible here — which
  // makes a reserved-word scan the cheapest possible guard against the whole class.
  it('uses no GLSL ES reserved words as identifiers', async () => {
    const { dissolveFrontFragment, dissolveBackFragment } = await import('../../src/shaders/dissolve.js')
    // Comments are stripped first: the word "using" appears in the explanatory comment
    // about the reserved-word trap and is not an identifier.
    const strip = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const RESERVED = [
      'active', 'asm', 'attribute', 'cast', 'class', 'common', 'double', 'enum', 'extern',
      'external', 'filter', 'fixed', 'flat', 'goto', 'half', 'inline', 'input', 'interface',
      'long', 'namespace', 'noinline', 'output', 'partition', 'public', 'row_major', 'short',
      'sizeof', 'static', 'superp', 'template', 'this', 'typedef', 'union', 'unsigned',
      'using', 'volatile', 'where', 'patch', 'resource', 'sample', 'subroutine', 'hvec',
      'fvec', 'dvec', 'packed',
    ]
    for (const [name, src] of [['front', dissolveFrontFragment], ['back', dissolveBackFragment]]) {
      const code = strip(src)
      for (const word of RESERVED) {
        expect(
          new RegExp(`(?<![A-Za-z0-9_])${word}(?![A-Za-z0-9_])`).test(code),
          `${name} shader uses reserved word "${word}" — it will not compile`,
        ).toBe(false)
      }
    }
  })

  // The touch gate. Both cases are needed: the first alone would also pass if the
  // dissolve were simply broken, which is why the awake case sits next to it.
  it('does not dissolve on a tap that is not a cursor grab', async () => {
    h.cursor.isTouch = true
    h.cursor.awake = false
    const { container } = await load()
    const card = frames(container)[0]
    gsap.__tweens.length = 0
    // A bare tap fires pointerenter. On touch this must not start the reveal.
    card.dispatchEvent(new Event('pointerenter'))
    // The gate lives in the handler, so with the cursor asleep nothing is created.
    expect(gsap.__tweens.length).toBe(0)
  })

  it('dissolves once the cursor is awake, so the gate is not just disabling it', async () => {
    h.cursor.isTouch = true
    h.cursor.awake = true
    h.cursor.parked = { x: 200, y: 150 }   // inside the mocked 400x300 card box
    const { container } = await load()
    const card = frames(container)[0]
    gsap.__tweens.length = 0
    // On touch the reveal is driven by the TICK, not by pointerenter: that event
    // fires when the finger lands, before any grab exists, and never fires again
    // when the cursor wakes — so gating on it could only ever block. The event alone
    // must still do nothing; a TICK is what has to run.
    card.dispatchEvent(new Event('pointerenter'))
    expect(gsap.__tweens.length).toBe(0)
    pump()
    expect(gsap.__tweens.length).toBeGreaterThan(0)
  })

  it('does not re-tween every frame while the cursor rests on the card', async () => {
    // The change-guard is load-bearing: without it tweenDissolve runs 60x a second,
    // killing and rebuilding its own tween, and the card never moves.
    h.cursor.isTouch = true
    h.cursor.awake = true
    h.cursor.parked = { x: 200, y: 150 }
    const { container } = await load()
    gsap.__tweens.length = 0
    pump()
    const afterFirst = gsap.__tweens.length
    expect(afterFirst).toBeGreaterThan(0)
    pump(5)
    // Five more ticks with the state unchanged add nothing.
    expect(gsap.__tweens.length).toBe(afterFirst)
  })

  it('still dissolves on hover for a mouse device', async () => {
    h.cursor.isTouch = false
    h.cursor.awake = false
    const { container } = await load()
    const card = frames(container)[0]
    gsap.__tweens.length = 0
    card.dispatchEvent(new Event('pointerenter'))
    // A mouse has no cursor grab, so gating on awake must NOT apply here or desktop
    // hover would stop working entirely. Desktop stays event-driven.
    expect(gsap.__tweens.length).toBeGreaterThan(0)
  })
})
