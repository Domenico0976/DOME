import { describe, test, expect } from 'vitest'
import { flowfieldTool } from './flowfield'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 2, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 100, quality: 'high' }
const item: StackItem = {
  uid: 'ff',
  toolId: 'flowfield',
  toolVersion: '4.0.0',
  params: { scale: 8, speed: 1, viscosity: 0.5, particles: 128, color: '#0a0a0a' },
  audio: [],
  automations: [],
  hidden: false,
}

describe('flowfield 4.0.0', () => {
  test('renders without throwing', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => flowfieldTool.render(ctx, frame, item, audio, stack)).not.toThrow()
  })
})
