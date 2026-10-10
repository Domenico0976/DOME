// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { usePerfMonitor } from '../hooks/usePerfMonitor'
import '../tools'

function Harness({ opts }: { opts?: Parameters<typeof usePerfMonitor>[0] }) {
  usePerfMonitor(opts)
  return null
}

describe('usePerfMonitor', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function drive(opts: Parameters<typeof usePerfMonitor>[0], clock: () => number, steps: number) {
    let pending: FrameRequestCallback | null = null
    render(<Harness opts={{ ...opts, now: clock, requestAnimationFrame: (cb: FrameRequestCallback) => { pending = cb; return 1 } }} />)
    for (let i = 0; i < steps; i++) {
      act(() => {
        if (pending) pending(0)
      })
    }
  }

  test('degraded after sustained over-budget frames', () => {
    let step = 0
    const clock = () => {
      step += 1
      // 30ms/frame (over budget) for 120 frames, then 10ms/frame.
      return step <= 120 ? step * 30 : 3600 + (step - 120) * 10
    }
    drive({ thresholdMs: 24, sustainedMs: 2000 }, clock, 100)
    expect(useProjectStore.getState().perf.level).toBe('degraded')
    expect(useProjectStore.getState().perf.reason).toContain('over budget')
  })

  test('recovers to ok after sustained in-budget frames', () => {
    let step = 0
    const clock = () => {
      step += 1
      // 30ms/frame for 120 frames, then 10ms/frame for 250 frames.
      return step <= 120 ? step * 30 : 3600 + (step - 120) * 10
    }
    drive({ thresholdMs: 24, sustainedMs: 2000 }, clock, 370)
    expect(useProjectStore.getState().perf.level).toBe('ok')
  })

  test('writes store only on transitions, not every frame', () => {
    let writes = 0
    const unsub = useProjectStore.subscribe((s) => {
      void s.perf
      writes += 1
    })
    let step = 0
    const clock = () => {
      step += 1
      return step <= 120 ? step * 30 : 3600 + (step - 120) * 10
    }
    drive({ thresholdMs: 24, sustainedMs: 2000 }, clock, 370)
    unsub()
    // Only two perf-level transitions: degraded then ok.
    expect(useProjectStore.getState().perf.level).toBe('ok')
    expect(writes).toBe(2)
  })

  test('no-op when disabled', () => {
    let pending: FrameRequestCallback | null = null
    render(
      <Harness
        opts={{
          enabled: false,
          now: () => 100,
          requestAnimationFrame: (cb) => { pending = cb; return 1 },
        }}
      />,
    )
    act(() => {
      if (pending) pending(0)
    })
    expect(useProjectStore.getState().perf.level).toBe('ok')
  })
})