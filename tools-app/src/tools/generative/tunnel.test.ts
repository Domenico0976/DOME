import { describe, test, expect } from 'vitest'
import '../index'
import { tunnelTool } from './tunnel'
import { getCatalog } from '../../core/registry'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 3, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }

const mkItem = (params: Record<string, number | string>): StackItem => ({
  uid: 'tn',
  toolId: 'tunnel',
  toolVersion: '3.0.0',
  params,
  audio: [],
  automations: [],
  hidden: false,
})

describe('tunnel 3.0.0', () => {
  test('renders fallback without throwing (no GL)', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => tunnelTool.render(ctx, frame, mkItem({}), audio, stack)).not.toThrow()
  })

  test('registered in catalog', () => {
    expect(getCatalog().Generative.map((t) => t.id)).toContain('tunnel')
  })

  test('renders all shape variants without throwing', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    for (const shape of [0, 1, 2, 3, 4, 5] as const) {
      expect(() =>
        tunnelTool.render(ctx, frame, mkItem({ shape }), audio, stack),
      ).not.toThrow()
    }
  })

  test('horizon control is accepted', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() =>
      tunnelTool.render(ctx, frame, mkItem({ horizon: 0.5 }), audio, stack),
    ).not.toThrow()
  })
})
