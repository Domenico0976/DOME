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
})
