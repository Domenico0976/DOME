import { describe, test, expect } from 'vitest'
import { particlesTool } from './particles'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 1, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0.5, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'p1',
  toolId: 'particles',
  toolVersion: '3.0.0',
  params: { mode: 'chladni', a: 3, b: 4, m: 5, n: 6, freq: 1.5, density: 10, size: 2, color: '#ffffff', bgColor: '#000000' },
  audio: [],
  automations: [],
  hidden: false,
}

describe('particles 3.0.0 chladni', () => {
  test('renders without throwing and is deterministic given same uid', () => {
    const run = () => {
      const calls: unknown[] = []
      const ctx = {
        save: () => calls.push('save'),
        restore: () => calls.push('restore'),
        fillRect: () => calls.push('rect'),
      } as unknown as CanvasRenderingContext2D
      particlesTool.render(ctx, frame, item, audio, stack)
      return calls.length
    }
    expect(run()).toBe(run())
  })

  test('registers migration for 1.x items', async () => {
    const { TOOL_PARAM_MIGRATIONS } = await import('../../core/schema')
    expect(TOOL_PARAM_MIGRATIONS.particles).toBeDefined()
  })
})
