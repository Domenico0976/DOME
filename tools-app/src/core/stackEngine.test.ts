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
})
