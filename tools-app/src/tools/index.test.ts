import { describe, test, expect, vi } from 'vitest'
import { getCatalog } from '../core/registry'
import type { StackItem, Frame, AudioFrame, StackRenderContext } from '../core/types'
import { solidColorTool } from './inputs/solidColor'
import { particlesTool } from './generative/particles'
import { halftoneTool } from './filters/halftone'
import * as tools from './index'

const item: StackItem = {
  uid: 'x',
  toolId: 'solidColor',
  toolVersion: '1.0.0',
  params: { color: '#123456' },
  audio: [],
  automations: [],
  hidden: false,
}
const frame: Frame = { timeSec: 0, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 100, height: 100, quality: 'high' }

function stubCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop() {} }
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad
        if (prop === 'canvas') return { width: 100, height: 100 }
        return () => {}
      },
    },
  ) as unknown as CanvasRenderingContext2D
}

describe('tools registration surface', () => {
  test('registers all 6 input tools', () => {
    void tools
    const ids = getCatalog().Inputs.map((t) => t.id).sort()
    expect(ids).toEqual(['audioFile', 'camera', 'gradient', 'imageVideo', 'solidColor', 'text'].sort())
  })

  test('registers all 10 generative tools', () => {
    const ids = getCatalog().Generative.map((t) => t.id).sort()
    expect(ids).toEqual(
      [
        'ferrofluid', 'flowfield', 'kaleidoscope', 'liquidmetal', 'molecules',
        'particles', 'plasma', 'rings', 'starfield', 'tunnel',
      ].sort(),
    )
  })

  test('solidColor renders a filled rect', () => {
    const ctx = { fillStyle: '', fillRect: vi.fn() } as unknown as CanvasRenderingContext2D
    solidColorTool.render(ctx, frame, item, audio, stack)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100)
    expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('#123456')
  })

  test('particles renders without throwing', () => {
    expect(() => particlesTool.render(stubCtx(), frame, item, audio, stack)).not.toThrow()
  })

  test('registers all 6 filter tools', () => {
    const ids = getCatalog().Filters.map((t) => t.id).sort()
    expect(ids).toEqual(
      ['facets', 'halftone', 'pixelator', 'reLight', 'thermal', 'typeShape'].sort(),
    )
  })

  test('halftone renders without throwing (graceful without getImageData)', () => {
    expect(() => halftoneTool.render(stubCtx(), frame, item, audio, stack)).not.toThrow()
  })
})
