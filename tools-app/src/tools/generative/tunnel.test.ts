import { describe, test, expect } from 'vitest'
import { tunnelTool } from './tunnel'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 3, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'tn',
  toolId: 'tunnel',
  toolVersion: '2.0.0',
  params: { rings: 40, speed: 1, hue: 280, shape: 'square' },
  audio: [],
  automations: [],
  hidden: false,
}

describe('tunnel 2.0.0', () => {
  test('renders circle/square/triangle without throwing', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    for (const shape of ['circle', 'square', 'triangle'] as const) {
      expect(() =>
        tunnelTool.render(ctx, frame, { ...item, params: { ...item.params, shape } }, audio, stack),
      ).not.toThrow()
    }
  })
})
