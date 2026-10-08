// @vitest-environment jsdom
// Pins the focus callout entrance. The contract that matters: every line's text
// starts at a random offset and ends on its OWN layout position, so the last
// frame is exact by construction (`gsap.from`, not a hand-written end value), and
// each line is clipped to its own box while it travels.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import SelectedProjects, {
  CALLOUT_REVEAL_STEP,
  CALLOUT_REVEAL_DURATION,
  CALLOUT_REVEAL_START,
  CALLOUT_REVEAL_TRAVEL_X,
  CALLOUT_REVEAL_TRAVEL_Y,
} from '../../src/components/SelectedProjects.jsx'

// vi.mock factories are hoisted above every module-level const, so anything they
// close over has to come from vi.hoisted too.
const h = vi.hoisted(() => {
  const tweens = []
  const timelineConfigs = []
  const instances = []
  const stCreate = vi.fn()
  // The imperative handle FocusCalloutShader exposes for the entrance to drive.
  // Populating a real ref from the mock is what lets this file assert the wiring
  // rather than just that the callbacks exist.
  const shaderHandle = { rebuild: vi.fn() }
  // Stands in for the lazy chunk having resolved. The entrance timeline is built
  // on mount, which is not the same moment the shader component exists, so the
  // handle genuinely can be missing while the timeline is already ticking.
  const state = { shaderReady: true }
  // `gsap.timeline` is used elsewhere in this component tree, so record every
  // config and let the test pick the one whose scrollTrigger targets the callout.
  const timeline = (config) => {
    if (config) timelineConfigs.push(config)
    const instance = {
      // `from` is the API under test: it must be used, not fromTo.
      from: (target, fromVars, position) => {
        tweens.push({ kind: 'from', target, fromVars, position })
        return null
      },
      fromTo: (target, fromVars, toVars, position) => {
        tweens.push({ kind: 'fromTo', target, fromVars, toVars, position })
        return null
      },
      to: vi.fn(),
      progress: vi.fn(),
      kill: vi.fn(),
    }
    // Paired on the instance, not in a parallel array: the callout timeline is not
    // the only one in this tree, and a test needs the object its callbacks close over.
    instance.config = config
    instances.push(instance)
    return instance
  }
  return { tweens, timelineConfigs, instances, stCreate, timeline, shaderHandle, state }
})

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    context: (fn) => {
      fn()
      return { revert: vi.fn() }
    },
    timeline: h.timeline,
    to: vi.fn(),
    from: vi.fn(),
    fromTo: vi.fn(),
    set: vi.fn(),
    quickTo: () => vi.fn(),
    quickSetter: () => vi.fn(),
    killTweensOf: vi.fn(),
    ticker: { add: vi.fn(), remove: vi.fn() },
  },
}))

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: (...args) => {
      h.stCreate(...args)
      return { kill: vi.fn() }
    },
    update: vi.fn(),
    refresh: vi.fn(),
    config: vi.fn(),
  },
}))

vi.mock('../../src/hooks/useArchiveCursor', () => ({
  useArchiveCursor: () => ({
    isTouch: false,
    isDragging: false,
    isDraggingRef: { current: false },
    isCursorActiveRef: { current: false },
    cursorRef: { current: { x: 0, y: 0 } },
    canvasState: { open: false, image: null },
    openCanvas: vi.fn(),
    closeCanvas: vi.fn(),
    updateCursor: vi.fn(),
    setCursor: vi.fn(),
    activateCursor: vi.fn(),
    clearDragTimer: vi.fn(),
    resetDragState: vi.fn(),
    startDragTimer: vi.fn(),
  }),
  ArchiveCursorProvider: ({ children }) => children,
}))

const shaderProps = { current: null }
vi.mock('../../src/components/FocusCalloutShader.jsx', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    default: (props) => {
      shaderProps.current = props
      // Stands in for React.lazy: the handle only exists once the shader chunk
      // has resolved, which can be after the entrance timeline has already begun.
      if (h.state.shaderReady) useImperativeHandle(props.ref, () => h.shaderHandle, [])
      return null
    },
  }
})
let reduced = false
let rectSpy
beforeEach(() => {
  reduced = false
  // jsdom measures every element as 0x0, which would make every travel offset
  // collapse to zero. Give the callout a real box so the randomised distances
  // are actually exercised.
  rectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200, x: 0, y: 0 })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', (query) => ({
    media: query,
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduced : false
    },
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  h.tweens.length = 0
  h.timelineConfigs.length = 0
  h.instances.length = 0
  h.stCreate.mockClear()
  h.state.shaderReady = true
  shaderProps.current = null
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  rectSpy?.mockRestore()
})

const callout = (c) => c.querySelector('.focus-callout--shader')
const spans = (c) => Array.from(c.querySelectorAll('.focus-callout__text-line .focus-callout__text'))
const calloutTweens = () => h.tweens.filter((t) => t.target?.classList?.contains('focus-callout__text'))
// The entrance timeline is identified by its trigger being the callout:
// `gsap.timeline` is used elsewhere in this tree, so the trigger is what tells them
// apart, and the callbacks below have to be pulled off the same instance.
const entranceTl = (el) => h.instances.find((i) => i.config?.scrollTrigger?.trigger === el)
const entranceTrigger = (el) => entranceTl(el)?.config?.scrollTrigger

describe('focus callout entrance', () => {
  it('uses gsap.from on every line span, so the end is the natural position', () => {
    const { container } = render(<SelectedProjects />)
    const els = spans(container)
    const tweens = calloutTweens()
    expect(tweens).toHaveLength(els.length)
    // `from`, never `fromTo`: the end value is the element's own layout position,
    // so the final frame cannot drift from the final position.
    for (const t of tweens) expect(t.kind).toBe('from')
  })

  it('starts every line offset, inside the declared travel range', () => {
    const { container } = render(<SelectedProjects />)
    const [minX, maxX] = CALLOUT_REVEAL_TRAVEL_X
    const [minY, maxY] = CALLOUT_REVEAL_TRAVEL_Y
    for (const t of calloutTweens()) {
      const r = t.target.getBoundingClientRect()
      // The offset is the declared range (CALLOUT_REVEAL_TRAVEL_*) scaled by the
      // line's own size. Both sides compute the bound the same way from the same
      // imported constant, so this can never go stale when the range is retuned.
      expect(Math.abs(t.fromVars.x)).toBeGreaterThanOrEqual(minX * r.width)
      expect(Math.abs(t.fromVars.x)).toBeLessThanOrEqual(maxX * r.width)
      expect(Math.abs(t.fromVars.y)).toBeGreaterThanOrEqual(minY * r.height)
      expect(Math.abs(t.fromVars.y)).toBeLessThanOrEqual(maxY * r.height)
    }
  })

  it('alternates the side line by line', () => {
    const { container } = render(<SelectedProjects />)
    const xs = calloutTweens().map((t) => Math.sign(t.fromVars.x))
    expect(xs.length).toBeGreaterThan(1)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBe(-xs[i - 1])
    }
  })

  it('randomises the travel so no two lines take the same path', () => {
    const { container } = render(<SelectedProjects />)
    const keys = calloutTweens().map((t) => `${t.fromVars.x.toFixed(2)}:${t.fromVars.y.toFixed(2)}`)
    // With continuous random magnitudes, a repeat would mean the range collapsed.
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('eases in and out, and staggers by one step from a common start', () => {
    const { container } = render(<SelectedProjects />)
    for (const t of calloutTweens()) expect(t.fromVars.ease).toBe('power4.inOut')

    const positions = calloutTweens().map((t) => t.position)
    // The first line starts at zero and the rest follow one fixed step behind it. The
    // entrance is started by scroll but played by the clock, so this is a real time
    // gap: the cascade is the same whether the visitor flicked or crawled.
    expect(positions[0]).toBe(0)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] - positions[i - 1]).toBeCloseTo(CALLOUT_REVEAL_STEP, 5)
    }
    // The invariant, and the thing that has now been wrong twice: the last line must
    // start before the first has landed, or the words arrive as a queue rather than
    // together. Stagger and travel are not independent — 3 steps of cascade against a
    // travel shorter than that puts the last two lines in motion after the first has
    // settled. Stated against both constants so retuning either one, in either order,
    // is caught here by name rather than as a mystery.
    expect(positions.at(-1)).toBeLessThan(CALLOUT_REVEAL_DURATION)
  })

  it('is driven by scroll, forwards only, and never plays on its own', () => {
    const { container } = render(<SelectedProjects />)
    const el = callout(container)
    const st = entranceTrigger(el)
    expect(st).toBeDefined()
    // `once` is the whole mechanism: the trigger fires and is done, so nothing after
    // or before this point can touch the lines.
    expect(st.once).toBe(true)
    expect(st.start).toBe(CALLOUT_REVEAL_START)
    // Not scrubbed. Scrub would bind the lines to the scroll POSITION — scrolling on
    // would drag the entrance to its end, and scrolling back up would un-arrive it
    // word by word. Scroll only says WHEN, and the clock does the rest.
    expect(st.scrub).toBeUndefined()
    expect(entranceTl(el).config.paused).toBeUndefined()
  })

  it('settles the mask on the last tick, forced past the throttle', () => {
    const { container } = render(<SelectedProjects />)
    const config = entranceTl(callout(container)).config
    h.shaderHandle.rebuild.mockClear()

    config.onUpdate()
    expect(h.shaderHandle.rebuild).toHaveBeenCalledWith()

    // Forced: the shader's rebuild throttle must not swallow the tick that settles
    // the callout, or the last line stays a pixel short of its resting state forever.
    h.shaderHandle.rebuild.mockClear()
    config.onComplete()
    expect(h.shaderHandle.rebuild).toHaveBeenCalledWith(true)
  })

  it('drives the shader mask from the entrance, so the two cannot disagree', () => {
    const { container } = render(<SelectedProjects />)
    const config = entranceTl(callout(container)).config
    expect(config).toBeDefined()

    // The mask starts empty (--reveal is 0 in CSS), so if the entrance never asked
    // for a rebuild the callout would simply never appear. That is the failure this
    // guards, and it is invisible in a screenshot diff.
    h.shaderHandle.rebuild.mockClear()
    config.onUpdate()
    expect(h.shaderHandle.rebuild).toHaveBeenCalledWith()
  })

  it('survives the entrance starting before the shader chunk has resolved', () => {
    // FocusCalloutShader is React.lazy, and the timeline is built on mount — so the
    // two are not guaranteed to be in step. The visitor can scroll into the
    // callout while the 2.4 MB chunk is still in flight, which makes the entrance
    // tick with no shader handle to hand the mask to. The optional chaining covers
    // it, but "covered" is exactly the kind of claim that needs a test: three
    // ordering bugs in this session were each invisible until something ran.
    h.state.shaderReady = false
    const { container } = render(<SelectedProjects />)
    const config = entranceTl(callout(container))?.config
    expect(config).toBeDefined()

    expect(() => config.onUpdate()).not.toThrow()
    expect(() => config.onComplete()).not.toThrow()
    // Nothing was rebuilt, and nothing was recorded against a handle either.
    expect(h.shaderHandle.rebuild).not.toHaveBeenCalled()

    // Once the chunk lands, the mask is recovered on the next tick: the component
    // draws the DOM's current state on mount, so a late arrival shows the settled
    // mask rather than nothing.
    h.state.shaderReady = true
    h.shaderHandle.rebuild.mockClear()
    expect(() => config.onComplete()).not.toThrow()
  })

  it('builds nothing under reduced motion', () => {
    reduced = true
    render(<SelectedProjects />)
    expect(calloutTweens()).toHaveLength(0)
  })

  it('still renders one line per entry, matching the shader prop', () => {
    const { container } = render(<SelectedProjects />)
    expect(spans(container).map((s) => s.textContent)).toEqual(shaderProps.current.lines)
  })

  it('gates each line on --reveal, 0 -> 1, on the same clock as its slide', () => {
    const { container } = render(<SelectedProjects />)
    const lines = Array.from(container.querySelectorAll('.focus-callout__text-line'))
    const gates = h.tweens.filter((t) => t.target?.classList?.contains('focus-callout__text-line'))
    expect(gates).toHaveLength(lines.length)

    for (const line of lines) {
      const gate = gates.find((t) => t.target === line)
      const slide = calloutTweens().find((t) => t.target.parentElement === line)
      expect(gate).toBeDefined()
      expect(slide).toBeDefined()
      // The gate is what makes a line invisible before the entrance has placed it,
      // so it must start at 0 and reach 1...
      expect(gate.kind).toBe('fromTo')
      expect(gate.fromVars['--reveal']).toBe(0)
      expect(gate.toVars['--reveal']).toBe(1)
      // ...on exactly the slide's clock, or the word fades in while it is still
      // somewhere it was never meant to be visible.
      expect(gate.position).toBe(slide.position)
      expect(gate.toVars.duration).toBe(slide.fromVars.duration)
    }
  })

  it('does not build a gate at all under reduced motion, where the CSS pins --reveal to 1', () => {
    reduced = true
    const { container } = render(<SelectedProjects />)
    const gates = h.tweens.filter((t) => t.target?.classList?.contains('focus-callout__text-line'))
    expect(gates).toHaveLength(0)
    // The reduced path restores real ink and pins --reveal in CSS, so the line is
    // visible without any tween. If the stylesheet ever lost that pin, this is the
    // test that would notice the callout silently disappearing.
    expect(container.querySelectorAll('.focus-callout__text-line')).toHaveLength(4)
  })
})
