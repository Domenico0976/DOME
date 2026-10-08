// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVisualViewport } from '../../src/hooks/useVisualViewport'

describe('useVisualViewport', () => {
  let listeners

  const installVisualViewport = () => {
    const vv = {
      width: 390, height: 844, offsetTop: 0, scale: 1,
      addEventListener: vi.fn((t, fn) => listeners.push([t, fn])),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv })
    return vv
  }

  beforeEach(() => { listeners = [] })
  afterEach(() => { delete window.visualViewport })

  it('falls back to window.inner* when visualViewport is absent', () => {
    delete window.visualViewport
    window.innerWidth = 1200
    window.innerHeight = 800
    const { result } = renderHook(() => useVisualViewport())
    expect(result.current.viewport.width).toBe(1200)
    expect(result.current.viewport.height).toBe(800)
    expect(result.current.viewport.offsetTop).toBe(0)
  })

  it('prefers visualViewport over window.inner*', () => {
    installVisualViewport()
    window.innerHeight = 800          // layout viewport: stale, browser UI expanded
    const { result } = renderHook(() => useVisualViewport())
    // The whole point: these differ, and the visual one wins.
    expect(result.current.viewport.height).toBe(844)
  })

  it('updates on visualViewport resize', () => {
    installVisualViewport()
    const { result } = renderHook(() => useVisualViewport())
    expect(result.current.viewport.height).toBe(844)
    act(() => {
      const vv = window.visualViewport
      vv.height = 700
      listeners.find(([t]) => t === 'resize')[1]()
    })
    expect(result.current.viewport.height).toBe(700)
  })

  it('keeps viewportRef current without requiring a re-render consumer', () => {
    installVisualViewport()
    const { result } = renderHook(() => useVisualViewport())
    act(() => {
      const vv = window.visualViewport
      vv.height = 650
      listeners.find(([t]) => t === 'resize')[1]()
    })
    expect(result.current.viewportRef.current.height).toBe(650)
  })
})
