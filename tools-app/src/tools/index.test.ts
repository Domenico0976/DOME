import { describe, test, expect, vi } from 'vitest'
import { getCatalog } from '../core/registry'
import type { StackItem, Frame, AudioFrame, StackRenderContext } from '../core/types'
import { solidColorTool } from './inputs/solidColor'
import { particlesTool } from './generative/particles'
import { halftoneTool } from './filters/halftone'
import { waveformTool } from './scopes/waveform'
import { spectrumTool, bucketRange, bucketMean } from './scopes/spectrum'
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

  test('registers all 15 generative tools', () => {
    const ids = getCatalog().Generative.map((t) => t.id).sort()
    expect(ids).toEqual(
      [
        'brutalist', 'doodle', 'ferrofluid', 'flowfield', 'kaleidoscope', 'liquidmetal',
        'molecules', 'particles', 'plasma', 'rings', 'shaders', 'spectrum', 'starfield', 'tunnel',
        'waveform',
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

  function mkItem(toolId: string, params: Record<string, number | string>): StackItem {
    return { uid: 'sk', toolId, toolVersion: '1.0.0', params, audio: [], automations: [], hidden: false }
  }

  function recordingCtx() {
    return {
      canvas: { width: 100, height: 100 },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D & {
      fillRect: ReturnType<typeof vi.fn>
      stroke: ReturnType<typeof vi.fn>
    }
  }

  const specAudio: AudioFrame = {
    bass: 0.5,
    mid: 0.3,
    treble: 0.2,
    level: 0.4,
    spectrum: Float32Array.from([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
    bpm: 120,
  }

  test('waveform draws bg + one rect per bar (deterministic)', () => {
    const ctx = recordingCtx()
    waveformTool.render(ctx, frame, mkItem('waveform', { mode: 'bars', bars: 8, amplitude: 1 }), specAudio, stack)
    // 1 bg fill + 8 bars
    expect(ctx.fillRect).toHaveBeenCalledTimes(9)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100)
  })

  test('waveform renders empty spectrum without throwing', () => {
    expect(() => waveformTool.render(stubCtx(), frame, mkItem('waveform', { mode: 'mirror', bars: 64 }), audio, stack)).not.toThrow()
  })

  test('spectrum buckets cover bins without overlap (linear)', () => {
    expect(bucketRange(0, 4, 16, 'linear')).toEqual({ from: 0, to: 4 })
    expect(bucketRange(3, 4, 16, 'linear')).toEqual({ from: 12, to: 16 })
    expect(bucketMean(Float32Array.from([0.5, 0.5]), 0, 2)).toBeCloseTo(0.5)
    expect(bucketMean(new Float32Array(0), 0, 4)).toBe(0)
  })

  test('spectrum draws bg + one rect per band (deterministic)', () => {
    const ctx = recordingCtx()
    spectrumTool.render(ctx, frame, mkItem('spectrum', { mode: 'bars', bands: 8, scale: 'linear', amplitude: 1 }), specAudio, stack)
    expect(ctx.fillRect).toHaveBeenCalledTimes(9)
  })

  test('spectrum scope strokes a polyline without throwing on empty input', () => {
    const ctx = recordingCtx()
    spectrumTool.render(ctx, frame, mkItem('spectrum', { mode: 'scope' }), audio, stack)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })
})
