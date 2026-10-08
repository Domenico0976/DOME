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
  // `children` must be rendered: ArchiveHoverCanvas is nested inside PendulumCanvas,
  // so a mock that dropped them would never mount the inner canvas at all and the
  // test would assert against a null capture rather than a real prop.
  PendulumCanvas: ({ children, ...props }) => {
    lastPendulumProps = props
    return <div data-testid="pendulum">{children}</div>
  },
}))
vi.mock('../../src/components/ArchiveCursor', () => ({
  __esModule: true,
  default: () => <div data-testid="archive-cursor" />,
}))

// The latch is stateful, so a plain vi.fn() stub would be a lie: `clearLatchedClosed`
// must actually clear, or "reopens on a fresh interaction" could never pass and the
// test would be asserting against a mock rather than the behaviour. vi.hoisted is
// required because vi.mock factories are hoisted above the imports.
const latch = vi.hoisted(() => ({ closed: false, row: null }))

// Archives reads the cursor provider directly, and the provider throws outside its
// own tree, so a standalone render needs this rather than a real provider.
// isMobile must be true here: `.project-row` is only rendered by the list branch,
// and the desktop branch renders a <table> whose rows carry a different class.
vi.mock('../../src/hooks/useArchiveCursor', () => ({
  useArchiveCursor: () => ({
    isMobile: true,
    isTouch: false,
    openCanvas: vi.fn(),
    closeCanvas: vi.fn(),
    setCursor: vi.fn(),
    cursorRef: { current: { x: 0, y: 0 } },
    isDraggingRef: { current: false },
    isCursorActiveRef: { current: false },
    latchedClosed: { current: latch.closed },
    setLatchedClosed: (rowIndex) => { latch.closed = true; latch.row = rowIndex },
    clearLatchedClosed: () => { latch.closed = false; latch.row = null },
    // Mirrors the real hook: on mobile any tap counts as fresh; the desktop branch
    // additionally requires a row other than the one the latch closed on.
    isFreshInteraction: (rowIndex) => (latch.closed ? rowIndex !== latch.row : true),
  }),
  ArchiveCursorProvider: ({ children }) => children,
}))

// jsdom has no IntersectionObserver, and useInView deliberately degrades to
// inView=true when it cannot observe. Without a controllable stub the canvas could
// never be seen closing, so the test would pass no matter what the fix did.
let observers = []
beforeEach(() => {
  observers = []
  lastPendulumProps = null
  lastHoverProps = null
  latch.closed = false
  latch.row = null
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
    // to false is the viewport gate.
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

  // This inverted the previous expectation deliberately. Deriving visibility from
  // `sectionInView && hoveredRow` reopened the canvas on scroll-back, which was
  // explicitly rejected: once the section has left the viewport, only a fresh
  // interaction on a project may reopen it.
  it('does NOT reopen when the section scrolls back', () => {
    render(<Archives />)
    act(() => setIntersecting(true))
    hoverRow()
    act(() => setIntersecting(false))
    expect(lastPendulumProps.visible).toBe(false)

    // The row is still hovered and the section is visible again. Without the latch
    // this is exactly the case that reopened the canvas.
    act(() => setIntersecting(true))
    expect(lastPendulumProps.visible).toBe(false)
  })

  it('reopens only on a fresh interaction after a latch-close', () => {
    render(<Archives />)
    act(() => setIntersecting(true))
    hoverRow()
    act(() => setIntersecting(false))
    act(() => setIntersecting(true))
    expect(lastPendulumProps.visible).toBe(false)

    // Leaving the row and hovering a DIFFERENT one is the fresh interaction. Re-entering
    // the same row deliberately does not clear the latch — that is the spec's rule and
    // is covered by the test above.
    const rows = document.querySelectorAll('.project-row')
    expect(rows.length).toBeGreaterThan(1)
    act(() => { fireEvent.mouseLeave(rows[0]) })
    fireEvent.mouseEnter(rows[1])
    expect(lastPendulumProps.visible).toBe(true)
  })
})
