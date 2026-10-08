import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { useArchiveCursor, ArchiveCursorProvider, throttleRAF, resetRAFThrottle } from '../../src/hooks/useArchiveCursor'

// The provider force-closes any open canvas while isTouch is false, so a test that
// exercises openCanvas has to run as a touch device. It used to get that for free:
// the old `any-pointer: coarse` query matched the ambient matchMedia stub. The
// digitised check also reads navigator.maxTouchPoints, which jsdom leaves at 0, so
// without this the canvas closes before it can be asserted on. Non-pointer queries
// are delegated so useIsMobile's max-width reading is untouched.
const asTouchDevice = () => {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
  const realMatchMedia = window.matchMedia
  vi.stubGlobal('matchMedia', (q) => {
    if (!q.includes('pointer')) return realMatchMedia(q)
    return {
      media: q, matches: !q.includes('fine'),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }
  })
}

describe('useArchiveCursor', () => {
  let originalInnerWidth

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true
    })
  })

  it('should throw when used outside provider', () => {
    expect(() => renderHook(() => useArchiveCursor())).toThrow(
      'useArchiveCursor must be used within ArchiveCursorProvider'
    )
  })

  it('should return initial state with isMobile and canvasState', () => {
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    expect(result.current.isMobile).toBe(false)
    expect(result.current.canvasState.open).toBe(false)
    expect(result.current.canvasState.image).toBeNull()
    expect(result.current.isDragging).toBe(false)
    expect(result.current.cursorRef.current).toEqual({ x: 0, y: 0 })
  })

  it('should expose the latest pointer position to WebGL consumers', () => {
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    act(() => result.current.updateCursor(120, 240))

    expect(result.current.cursorRef.current).toEqual({ x: 120, y: 240 })
  })

  it('should detect mobile when width is below 720px', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 375,
      writable: true,
      configurable: true
    })
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    expect(result.current.isMobile).toBe(true)
  })

  it('should open canvas with an image', () => {
    asTouchDevice()
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    act(() => {
      result.current.openCanvas('test-image.jpg')
    })

    expect(result.current.canvasState.open).toBe(true)
    expect(result.current.canvasState.image).toBe('test-image.jpg')
  })

  it('should close canvas and clear image', () => {
    asTouchDevice()
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    act(() => {
      result.current.openCanvas('test-image.jpg')
    })
    expect(result.current.canvasState.open).toBe(true)

    act(() => {
      result.current.closeCanvas()
    })

    expect(result.current.canvasState.open).toBe(false)
    expect(result.current.canvasState.image).toBeNull()
  })

  it('should start drag timer and set isDragging after 100ms', async () => {
    vi.useFakeTimers()
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    act(() => {
      result.current.startDragTimer()
    })
    expect(result.current.isDragging).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isDragging).toBe(true)
    vi.useRealTimers()
  })

  it('should clear drag timer and reset dragging state', async () => {
    vi.useFakeTimers()
    const wrapper = ({ children }) =>
      React.createElement(ArchiveCursorProvider, null, children)
    const { result } = renderHook(() => useArchiveCursor(), { wrapper })

    act(() => {
      result.current.startDragTimer()
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.isDragging).toBe(true)

    act(() => {
      result.current.resetDragState()
    })
    expect(result.current.isDragging).toBe(false)
    vi.useRealTimers()
  })
})

describe('throttleRAF', () => {
  beforeEach(() => {
    resetRAFThrottle()
  })

  it('allows callback on first call (initial lastFrameTime is -Infinity)', () => {
    const callback = vi.fn()
    const throttled = throttleRAF(callback)
    throttled(16)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(16)
  })

  it('allows callback when >= 16ms elapsed since last frame', () => {
    const callback = vi.fn()
    const throttled = throttleRAF(callback)
    throttled(16)
    throttled(32)
    throttled(48)
    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenCalledWith(16)
    expect(callback).toHaveBeenLastCalledWith(48)
  })

  it('skips callback when < 16ms elapsed since last frame', () => {
    const callback = vi.fn()
    const throttled = throttleRAF(callback)
    throttled(16)
    throttled(20)
    throttled(25)
    throttled(32)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(16)
    expect(callback).toHaveBeenLastCalledWith(32)
  })

  it('passes the timestamp to the callback', () => {
    const callback = vi.fn()
    const throttled = throttleRAF(callback)
    throttled(100)
    expect(callback).toHaveBeenCalledWith(100)
  })
})
