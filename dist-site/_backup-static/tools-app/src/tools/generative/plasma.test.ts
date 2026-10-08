// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import '../index'
import { plasmaTool } from './plasma'
import { getCatalog } from '../../core/registry'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 2, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }

const mkItem = (params: Record<string, number | string | string[]>): StackItem => ({
  uid: 'pl1',
  toolId: 'plasma',
  toolVersion: '3.0.0',
  params,
  audio: [],
  automations: [],
  hidden: false,
})

describe('plasma tool', () => {
  test('renders fallback without throwing (no GL)', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => plasmaTool.render(ctx, frame, mkItem({}), audio, stack)).not.toThrow()
  })

  test('accepts all new controls: roughness, baseColor, accentColor', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() =>
      plasmaTool.render(ctx, frame, mkItem({ roughness: 0.7, baseColor: '#ff0000', accentColor: '#00ff00' }), audio, stack),
    ).not.toThrow()
  })

  test('registered in catalog', () => {
    expect(getCatalog().Generative.map((t) => t.id)).toContain('plasma')
  })
})
