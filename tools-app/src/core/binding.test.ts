import { describe, test, expect } from 'vitest'
import { resolveParam } from './binding'
import type { StackItem } from './types'

function item(over: Partial<StackItem> = {}): StackItem {
  return {
    uid: 'x', toolId: 't', toolVersion: '1.0.0', params: { v: 0.5 }, audio: [], automations: [], hidden: false, ...over,
  }
}

const audio = { bass: 0.8, mid: 0.4, treble: 0.2, level: 0.5, spectrum: new Float32Array([0.1, 0.9, 0.3]), bpm: 120 }

describe('resolveParam', () => {
  test('static param returns base when no automation/audio', () => {
    expect(resolveParam(item({ params: { v: 0.3 } }), 'v', audio, 0)).toBe(0.3)
  })

  test('audio binding overrides static value', () => {
    const it = item({ params: { v: 0.5 }, audio: [{ param: 'v', source: 'bass', amount: 1, curve: 'linear' }] })
    const r = resolveParam(it, 'v', audio, 0)
    expect(typeof r).toBe('number')
    expect(r).not.toBe(0.5)
  })

  test('keyframe automation wins over audio binding', () => {
    const it = item({
      params: { v: 0.5 },
      audio: [{ param: 'v', source: 'bass', amount: 1, curve: 'linear' }],
      automations: [{ param: 'v', keyframes: [{ timeSec: 0, value: 0.9, easing: 'linear' }] }],
    })
    expect(resolveParam(it, 'v', audio, 0)).toBe(0.9)
  })

  test('string params pass through untouched', () => {
    expect(resolveParam(item({ params: { mode: 'lava' } }), 'mode', audio, 0)).toBe('lava')
  })
})
