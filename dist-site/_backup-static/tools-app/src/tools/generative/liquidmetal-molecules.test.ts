import { describe, test, expect } from 'vitest'
import '../index'
import { liquidMetalTool } from './liquidmetal'
import { moleculesTool } from './molecules'
import { getCatalog } from '../../core/registry'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 1, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }

const mkItem = (uid: string, toolId: string): StackItem => ({
  uid,
  toolId,
  toolVersion: '3.0.0',
  params: {},
  audio: [],
  automations: [],
  hidden: false,
})

describe('liquid metal + molecules', () => {
  test('both render without throwing on proxy ctx', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => liquidMetalTool.render(ctx, frame, mkItem('lm1', 'liquidmetal'), audio, stack)).not.toThrow()
    expect(() => moleculesTool.render(ctx, frame, mkItem('mol1', 'molecules'), audio, stack)).not.toThrow()
  })

  test('registered in catalog', () => {
    const ids = getCatalog().Generative.map((t) => t.id)
    expect(ids).toContain('liquidmetal')
    expect(ids).toContain('molecules')
  })
})
