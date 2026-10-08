// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gsap } from 'gsap'
import React from 'react'
import Archives from '../../src/components/Archives'

// The choreography is driven off the hovered index in React state, not off CSS sibling
// selectors: `tr:hover ~ tr` matches only FOLLOWING siblings, so rows ABOVE the hovered
// one would never shift right. Asserting on the `data-hovered` attribute is what makes
// those rows reachable at all — a test that only checked the hovered row would pass
// against the broken CSS-only approach.
vi.mock('../../src/components/ArchiveHoverCanvas', () => ({
  __esModule: true,
  default: () => <div data-testid="hover-canvas" />,
  PendulumCanvas: ({ children }) => <div data-testid="pendulum">{children}</div>,
}))
vi.mock('../../src/components/ArchiveCursor', () => ({
  __esModule: true,
  default: () => <div data-testid="archive-cursor" />,
}))

const latch = vi.hoisted(() => ({ closed: false, row: null }))

// isMobile must be false: the desktop branch renders the <table> whose rows carry
// data-hovered. The mobile branch renders a .project-row list instead, and this
// choreography is desktop-only.
vi.mock('../../src/hooks/useArchiveCursor', () => ({
  useArchiveCursor: () => ({
    isMobile: false,
    isTouch: false,
    openCanvas: vi.fn(),
    closeCanvas: vi.fn(),
    setCursor: vi.fn(),
    cursorRef: { current: { x: 0, y: 0 } },
    isDraggingRef: { current: false },
    isCursorActiveRef: { current: false },
    latchedClosed: { current: latch.closed },
    setLatchedClosed: (i) => { latch.closed = true; latch.row = i },
    clearLatchedClosed: () => { latch.closed = false; latch.row = null },
    isFreshInteraction: (i) => (latch.closed ? i !== latch.row : true),
  }),
  ArchiveCursorProvider: ({ children }) => children,
}))

beforeEach(() => {
  latch.closed = false
  latch.row = null
  // Desktop pin: Archives renders the mobile list at <=1024px, and jsdom
  // defaults to 1024 wide — without this the table under test never mounts.
  window.innerWidth = 1440
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb }
    observe() {}
    disconnect() {}
    trigger(isIntersecting) { this.cb([{ isIntersecting }], this) }
  }
})

const rows = () => Array.from(document.querySelectorAll('.archives-table tbody tr'))

describe('archives row choreography', () => {
  it('renders the desktop table and marks every row', () => {
    render(<Archives />)
    const r = rows()
    expect(r.length).toBeGreaterThan(1)
    for (const row of r) {
      expect(row.getAttribute('data-hovered')).toBe('false')
    }
  })

  it('marks the hovered row and leaves the others false, including rows ABOVE it', () => {
    render(<Archives />)
    const r = rows()
    act(() => { fireEvent.mouseEnter(r[2]) })

    const hovered = r.map((row) => row.getAttribute('data-hovered'))
    expect(hovered[2]).toBe('true')
    // Row 0 and row 1 sit ABOVE the hovered row. Sibling selectors could never reach
    // them, which is precisely why the state-driven attribute exists.
    expect(hovered[0]).toBe('false')
    expect(hovered[1]).toBe('false')
    expect(hovered[3]).toBe('false')
  })

  it('clears the mark on leave so the table returns to rest', () => {
    render(<Archives />)
    const r = rows()
    act(() => { fireEvent.mouseEnter(r[1]) })
    expect(r[1].getAttribute('data-hovered')).toBe('true')
    act(() => { fireEvent.mouseLeave(r[1]) })
    for (const row of rows()) {
      expect(row.getAttribute('data-hovered')).toBe('false')
    }
  })

  it('does not rely on a tr:hover sibling selector', () => {
    // Guards the specific regression this design exists to prevent.
    const src = readFileSync(
      resolve(process.cwd(), 'src/styles/global.css'), 'utf8')
    expect(src).not.toMatch(/tr:hover\s*~/)
  })

  // The four tests above only prove `data-hovered` is bound. Deleting the whole
  // timeline effect would leave every one of them green, so the animation itself
  // needs its own coverage.
  it('builds a timeline that shifts hovered cells left and the rest right', () => {
    const tweens = []
    const spy = vi.spyOn(gsap, 'timeline').mockImplementation(() => ({
      to: (target, vars, position) => { tweens.push({ target, vars, position }); return null },
      kill: () => {},
    }))

    render(<Archives />)
    const r = rows()
    act(() => { fireEvent.mouseEnter(r[1]) })

    expect(spy, 'no GSAP timeline was created').toHaveBeenCalled()
    // Every tween shares position 0 so weight, movement and opacity start together.
    for (const t of tweens) expect(t.position).toBe(0)

    const shifts = tweens.filter((t) => t.vars.x !== undefined)
    expect(shifts.length).toBeGreaterThan(0)
    const hoveredCell = r[1].querySelector('td.col-name')

    // Only the hovered row travels, and it travels further than the original 12px.
    expect(shifts.some((t) => t.target === hoveredCell && t.vars.x === -28)).toBe(true)
    // Non-hovered rows must NOT shift right. This is the regression the current
    // requirement exists to prevent: a non-zero x on any other row is a failure, not a
    // style choice.
    for (const t of shifts) {
      if (r[3].contains(t.target)) expect(t.vars.x).toBe(0)
    }
    // Travel is a long glide on one shared easing.
    for (const t of shifts) {
      expect(t.vars.duration).toBe(0.6)
      expect(t.vars.ease).toBe('expo.out')
    }
    // The weight tween is deliberately shorter: it re-runs layout on every step.
    const weights = tweens.filter((t) => t.vars.fontWeight !== undefined)
    expect(weights.some((t) => t.target === hoveredCell && t.vars.fontWeight === 600)).toBe(true)
    expect(weights.some((t) => t.target === r[3].querySelector('td.col-name') && t.vars.fontWeight === 500)).toBe(true)
    for (const t of weights) expect(t.vars.duration).toBe(0.25)

    // Non-hovered rows still dim to 0.8; the hovered row stays at full opacity.
    const fades = tweens.filter((t) => t.vars.opacity !== undefined)
    expect(fades.some((t) => t.target === r[1] && t.vars.opacity === 1)).toBe(true)
    expect(fades.some((t) => t.target === r[3] && t.vars.opacity === 0.8)).toBe(true)

    spy.mockRestore()
  })

  it('returns the whole table to rest when no row is hovered', () => {
    // Treating "all non-hovered" as the resting state would park the table 12px
    // right permanently, so with nothing hovered every row must sit at zero.
    const tweens = []
    const spy = vi.spyOn(gsap, 'timeline').mockImplementation(() => ({
      to: (target, vars, position) => { tweens.push({ target, vars, position }); return null },
      kill: () => {},
    }))

    render(<Archives />)
    act(() => { fireEvent.mouseEnter(rows()[1]) })
    tweens.length = 0
    act(() => { fireEvent.mouseLeave(rows()[1]) })

    const shifts = tweens.filter((t) => t.vars.x !== undefined)
    expect(shifts.length).toBeGreaterThan(0)
    for (const t of shifts) expect(t.vars.x).toBe(0)
    const fades = tweens.filter((t) => t.vars.opacity !== undefined)
    for (const t of fades) expect(t.vars.opacity).toBe(1)

    spy.mockRestore()
  })
})
