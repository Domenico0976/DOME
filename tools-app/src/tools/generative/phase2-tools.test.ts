import { describe, test, expect } from 'vitest'
import { doodleTool } from './doodle'
import { brutalistTool } from './brutalist'
import { particles2Tool } from './particles2'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 1, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const mk = (uid: string, toolId: string, params: Record<string, number | string>): StackItem => ({
  uid,
  toolId,
  toolVersion: '1.0.0',
  params,
  audio: [],
  automations: [],
  hidden: false,
})

describe('phase-2 generative tools', () => {
  test('doodle renders deterministic strokes', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => doodleTool.render(ctx, frame, mk('d1', 'doodle', {}), audio, stack)).not.toThrow()
  })

  test('brutalist draws cols x rows cells', () => {
    let cellCount = 0
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'beginPath'
            ? (..._a: unknown[]) => {
                cellCount++
              }
            : () => {},
      },
    ) as unknown as CanvasRenderingContext2D
    brutalistTool.render(ctx, frame, mk('b1', 'brutalist', { cols: 4 }), audio, stack)
    expect(cellCount).toBeGreaterThan(0)
  })

  test('particles2 attracts toward multiple centers', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => particles2Tool.render(ctx, frame, mk('q1', 'particles2', {}), audio, stack)).not.toThrow()
  })
})
