// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import '../index'
import { shadersTool } from './shaders'
import { getCatalog } from '../../core/registry'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 4, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'sh1',
  toolId: 'shaders',
  toolVersion: '3.0.0',
  params: { noiseScale: 4, warp: 1, colorShift: 0, complexity: 4 },
  audio: [],
  automations: [],
  hidden: false,
}

describe('shaders tool', () => {
  test('renders fallback without throwing (no GL)', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => shadersTool.render(ctx, frame, item, audio, stack)).not.toThrow()
  })

  test('registered in catalog', () => {
    expect(getCatalog().Generative.map((t) => t.id)).toContain('shaders')
  })
})
