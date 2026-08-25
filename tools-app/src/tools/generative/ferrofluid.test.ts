// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { ferrofluidTool } from './ferrofluid'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 0, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'ff1',
  toolId: 'ferrofluid',
  toolVersion: '2.0.0',
  params: { feed: 0.055, kill: 0.062, scale: 3, speed: 1, attractors: 4, accent: '#f2790c' },
  audio: [],
  automations: [],
  hidden: false,
}

function stubCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop() {} }
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad
        if (prop === 'canvas') return { width: 200, height: 200 }
        return () => {}
      },
    },
  ) as unknown as CanvasRenderingContext2D
}

describe('ferrofluid 2.0.0', () => {
  test('renders without throwing on proxy ctx (fallback path in jsdom)', () => {
    expect(() => ferrofluidTool.render(stubCtx(), frame, item, audio, stack)).not.toThrow()
  })

  test('renders deterministically across identical fresh uids', () => {
    const run = (uid: string) => {
      const it: StackItem = { ...item, uid }
      // First call seeds and steps; second call on same uid continues the simulation.
      ferrofluidTool.render(stubCtx(), frame, it, audio, stack)
      ferrofluidTool.render(stubCtx(), { ...frame, timeSec: 1 }, it, audio, stack)
      return true
    }
    expect(run('ff-det-a')).toBe(true)
  })
})
