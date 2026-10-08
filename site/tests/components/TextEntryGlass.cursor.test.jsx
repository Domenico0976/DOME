// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import TextEntryGlass from '../../src/components/TextEntryGlass'

// The engine entry point is the async mountTorusKnot, not a factory: it resolves to
// the live engine handle, and that handle is what setPointer lives on.
const engine = {
  setPointer: vi.fn(), setScrollProgress: vi.fn(), rebuildText: vi.fn(),
  resize: vi.fn(), setPaused: vi.fn(), dispose: vi.fn(),
}
vi.mock('../../src/hero-glass/engine.js', () => ({
  mountTorusKnot: async () => engine,
}))

// Touch, with the cursor parked at a known place. `parked` is a ref in the real
// gate; a plain object is the same shape as far as the consumer is concerned.
const PARKED = { current: { x: 300, y: 400 } }
vi.mock('../../src/hooks/useCursorGate.js', () => ({
  useCursorGate: () => ({ isTouch: true, isAwake: { current: true }, parked: PARKED, isOver: () => true }),
  useAwakeState: () => true,
}))

const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
const settle = async () => {
  // The engine mounts asynchronously, so the rAF reader starts a microtask later.
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  await act(async () => { await frame() })
}

describe('TextEntryGlass orientation', () => {
  beforeEach(() => { engine.setPointer.mockClear() })

  it('feeds the engine from the parked cursor with no pointer event at all', async () => {
    // The load-bearing assertion: NOTHING is dispatched here — no pointermove, no
    // mouse. Today setPointer is only ever called from onPointerMove, so the engine
    // is never driven on touch, which is exactly the defect (N1: no gate, no
    // smoothing, nothing to follow a parked cursor with).
    render(<TextEntryGlass />)
    await settle()
    expect(engine.setPointer).toHaveBeenCalled()
  })

  it('passes normalised coordinates, not raw client pixels', async () => {
    render(<TextEntryGlass />)
    await settle()
    const call = engine.setPointer.mock.calls.at(-1)
    expect(call).toBeDefined()
    // Engine signature is setPointer(nx, ny) with nx/ny in -1..1. Parked at
    // (300,400) in a 1024x768 window, so both must be inside that range — raw
    // client pixels (300, 400) would fail this and the effect would be off-screen.
    for (const v of call) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
