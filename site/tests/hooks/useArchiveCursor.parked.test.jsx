// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { ArchiveCursorProvider, useArchiveCursor } from '../../src/hooks/useArchiveCursor'

const wrapper = ({ children }) => React.createElement(ArchiveCursorProvider, null, children)

const setup = () => renderHook(() => useArchiveCursor(), { wrapper })

describe('parked cursor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is asleep and unparked on mount', () => {
    const { result } = setup()
    expect(result.current.isCursorAwakeRef.current).toBe(false)
    expect(result.current.cursorParkedRef.current).toEqual({ x: 0, y: 0 })
  })

  it('parks and wakes on activateCursor', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    expect(result.current.isCursorAwakeRef.current).toBe(true)
  })

  it('records the parked position when a cursor drag moves', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { result.current.parkCursor(120, 340) })
    expect(result.current.cursorParkedRef.current).toEqual({ x: 120, y: 340 })
  })

  it('sleeps on an explicit sleepCursor', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { result.current.sleepCursor() })
    expect(result.current.isCursorAwakeRef.current).toBe(false)
  })

  it('falls asleep on its own after 4s of no cursor movement', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { vi.advanceTimersByTime(4000) })
    expect(result.current.isCursorAwakeRef.current).toBe(false)
  })

  it('stays awake while the cursor keeps moving', () => {
    const { result } = setup()
    act(() => { result.current.activateCursor() })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.parkCursor(10, 10) })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.isCursorAwakeRef.current).toBe(true)
  })
})
