// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { ArchiveCursorProvider, useArchiveCursor } from '../../src/hooks/useArchiveCursor'
import { useCursorGate, useAwakeState } from '../../src/hooks/useCursorGate'

const wrapper = ({ children }) => React.createElement(ArchiveCursorProvider, null, children)

// Drives the provider so the gate has real state to read.
const useHarness = () => {
  const cursor = useArchiveCursor()
  const gate = useCursorGate()
  return { cursor, gate }
}

const RECT = { left: 100, top: 200, right: 500, bottom: 500 }

describe('useCursorGate', () => {
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

describe('useAwakeState', () => {
  it('re-renders the consumer when the cursor wakes and sleeps', () => {
    // Guards the reactivity bridge. The ref form is deliberately non-reactive, so
    // without the subscription a component rendering from awake-ness renders once
    // and then silently keeps a stale value — no error, just a dead effect. Driven
    // through parkCursor/sleepCursor because setAwake is the only notifying writer:
    // mutating the ref directly would prove nothing, because that is precisely the
    // path that does not notify.
    const useBoth = () => {
      const cursor = useArchiveCursor()
      return { cursor, awake: useAwakeState() }
    }
    const { result } = renderHook(useBoth, { wrapper })
    expect(result.current.awake).toBe(false)

    act(() => { result.current.cursor.parkCursor(300, 300) })
    expect(result.current.awake).toBe(true)

    act(() => { result.current.cursor.sleepCursor() })
    expect(result.current.awake).toBe(false)
  })
})
