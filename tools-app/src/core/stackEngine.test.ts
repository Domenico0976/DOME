import { describe, test, expect } from 'vitest'
import { registerTool } from './registry'
import { evaluateStack } from './stackEngine'
import type { StackItem, ToolDef } from './types'

function makeItem(toolId: string, hidden = false): StackItem {
  return { uid: toolId, toolId, toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden }
}

describe('stack engine', () => {
  test('evaluates visible items in order, skips hidden and missing', () => {
    const calls: string[] = []
    const a: ToolDef = {
      id: 'a', kind: 'input', version: '1.0.0', label: 'A', icon: '', category: 'Inputs',
      defaultParams: {}, controls: [], render: () => { calls.push('a') },
    }
    const b: ToolDef = {
      id: 'b', kind: 'generative', version: '1.0.0', label: 'B', icon: '', category: 'Generative',
      defaultParams: {}, controls: [], render: () => { calls.push('b') },
    }
    registerTool(a)
    registerTool(b)

    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }

    evaluateStack(ctx, frame, audio, [makeItem('a'), makeItem('b', true), makeItem('missing')])
    expect(calls).toEqual(['a'])
  })

  test('front of stack (index 0) is painted last so it appears on top', () => {
    const calls: string[] = []
    const a: ToolDef = {
      id: 'a', kind: 'input', version: '1.0.0', label: 'A', icon: '', category: 'Inputs',
      defaultParams: {}, controls: [], render: () => { calls.push('a') },
    }
    const b: ToolDef = {
      id: 'b', kind: 'generative', version: '1.0.0', label: 'B', icon: '', category: 'Generative',
      defaultParams: {}, controls: [], render: () => { calls.push('b') },
    }
    registerTool(a)
    registerTool(b)

    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }

    evaluateStack(ctx, frame, audio, [makeItem('a'), makeItem('b')])
    expect(calls).toEqual(['b', 'a'])
  })

  test('applies item blendMode and opacity to the canvas context', () => {
    const tool: ToolDef = {
      id: 't', kind: 'input', version: '1.0.0', label: 'T', icon: '', category: 'Inputs',
      defaultParams: {}, controls: [], render: () => {},
    }
    registerTool(tool)

    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D
    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }

    evaluateStack(ctx, frame, audio, [{ ...makeItem('t'), blendMode: 'multiply', opacity: 0.5 }])
    expect(ctx.globalCompositeOperation).toBe('multiply')
    expect(ctx.globalAlpha).toBe(0.5)
  })

  test('passes the requested quality through to the tool render context', () => {
    let receivedQuality: string | undefined
    const tool: ToolDef = {
      id: 'q', kind: 'input', version: '1.0.0', label: 'Q', icon: '', category: 'Inputs',
      defaultParams: {}, controls: [], render: (_ctx, _frame, _item, _audio, stackCtx) => {
        receivedQuality = stackCtx.quality
      },
    }
    registerTool(tool)

    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }

    evaluateStack(ctx, frame, audio, [makeItem('q')], { quality: 'low' })
    expect(receivedQuality).toBe('low')
  })

  test('WebGL branch sets composite+alpha from item BEFORE drawImage', () => {
    const calls: string[] = []
    const tool: ToolDef = {
      id: 'gl', kind: 'generative', version: '1.0.0', label: 'GL', icon: '', category: 'Generative',
      defaultParams: {}, controls: [], render: () => {},
    }
    registerTool(tool)

    const fakeGlCanvas = { width: 100, height: 100 }
    const gl = { canvas: fakeGlCanvas } as unknown as WebGL2RenderingContext

    const ctx = {
      save() { calls.push('save') },
      restore() { calls.push('restore') },
      canvas: { width: 100, height: 100 },
      set globalCompositeOperation(v: string) {
        calls.push(`composite=${v}`)
      },
      set globalAlpha(v: number) {
        calls.push(`alpha=${v}`)
      },
      drawImage() { calls.push('drawImage') },
    } as unknown as CanvasRenderingContext2D

    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }

    evaluateStack(ctx, frame, audio, [{ ...makeItem('gl'), blendMode: 'multiply', opacity: 0.5 }], { gl })

    const compositeIdx = calls.indexOf('composite=multiply')
    const alphaIdx = calls.indexOf('alpha=0.5')
    const drawIdx = calls.indexOf('drawImage')
    expect(compositeIdx).toBeGreaterThan(-1)
    expect(alphaIdx).toBeGreaterThan(-1)
    expect(drawIdx).toBeGreaterThan(-1)
    expect(compositeIdx).toBeLessThan(drawIdx)
    expect(alphaIdx).toBeLessThan(drawIdx)
  })

  test('repeated frames do not compound bindings nor mutate store params', () => {    const seen: number[] = []
    const tool: ToolDef = {
      id: 'cmp', kind: 'generative', version: '1.0.0', label: 'Cmp', icon: '', category: 'Generative',
      defaultParams: {}, controls: [],
      render: (_ctx, _frame, item) => { seen.push(Number(item.params.speed)) },
    }
    registerTool(tool)
    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0.8, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }
    const item: StackItem = {
      uid: 'cmp', toolId: 'cmp', toolVersion: '1.0.0',
      params: { speed: 1 },
      audio: [{ id: 'b1', param: 'speed', source: 'bass', curve: 'linear', amount: 0.5 }],
      automations: [], hidden: false,
    }
    evaluateStack(ctx, frame, audio, [item])
    evaluateStack(ctx, frame, audio, [item])
    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
    expect(seen[0]).toBeCloseTo(1.4)
    expect(item.params.speed).toBe(1)
  })

  test('muted bindings are skipped by the engine', () => {
    const seen: number[] = []
    const tool: ToolDef = {
      id: 'mute', kind: 'generative', version: '1.0.0', label: 'Mute', icon: '', category: 'Generative',
      defaultParams: {}, controls: [],
      render: (_ctx, _frame, item) => { seen.push(Number(item.params.speed)) },
    }
    registerTool(tool)
    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
    const frame = { timeSec: 0, dt: 0, bpm: 120 }
    const audio = { bass: 0.8, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(64), bpm: 120 }
    const item: StackItem = {
      uid: 'mute', toolId: 'mute', toolVersion: '1.0.0',
      params: { speed: 1 },
      audio: [{ id: 'b1', param: 'speed', source: 'bass', curve: 'linear', amount: 0.5 }],
      automations: [], hidden: false,
    }
    evaluateStack(ctx, frame, audio, [item], { muted: new Set(['mute-speed']) })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(1)
  })
})
