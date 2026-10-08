// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsTouch } from '../../src/hooks/useIsTouch'

const stubPointer = (coarse) => vi.stubGlobal('matchMedia', (q) => ({
  media: q, matches: q.includes('pointer') ? coarse : false,
  addEventListener: vi.fn(), removeEventListener: vi.fn(),
  addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
}))

describe('useIsTouch digitization', () => {
  beforeEach(() => { delete navigator.maxTouchPoints })
  afterEach(() => { vi.unstubAllGlobals() })

  it('is touch on a digitised phone with a fine pointer absent', () => {
    navigator.maxTouchPoints = 5
    stubPointer(false)                       // (pointer: fine) does NOT match
    expect(renderHook(() => useIsTouch()).result.current).toBe(true)
  })

  it('is NOT touch on a desktop with no touch points', () => {
    navigator.maxTouchPoints = 0
    stubPointer(true)                        // (pointer: fine) matches
    expect(renderHook(() => useIsTouch()).result.current).toBe(false)
  })

  it('treats a touchscreen laptop as TOUCH, even with a mouse attached', () => {
    // Reversed 2026-09-30. An earlier version of this file asserted the opposite
    // ("treats a touchscreen laptop as DESKTOP"), on the reasoning that a mouse user
    // needs hover. The user overruled it: a device with a digitiser shows the
    // DIGITISED version, mouse or not. Pinning it here so the hybrid case stays a
    // decision rather than drifting back.
    navigator.maxTouchPoints = 10
    stubPointer(true)                        // a mouse IS the primary pointer
    expect(renderHook(() => useIsTouch()).result.current).toBe(true)
  })

  it('ignores the pointer type entirely', () => {
    // The point of the reversal: `(pointer: fine)` must not participate at all.
    navigator.maxTouchPoints = 10
    stubPointer(false)
    expect(renderHook(() => useIsTouch()).result.current).toBe(true)
  })
})
