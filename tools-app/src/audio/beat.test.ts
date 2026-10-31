// src/audio/beat.test.ts — T2 guarantees: detection, gate, BPM convergence,
// beat binding modulation, manual BPM untouched.
import { beforeEach, describe, expect, test } from 'vitest'
import {
  createBeatTracker,
  getEstimatedBpm,
  resetBeatTracker,
  withBeat,
} from './beat'
import { resolveEffectValue } from '../engine/effects'
import type { AudioFrame, Frame } from '../core/types'

beforeEach(() => {
  resetBeatTracker()
})

function flatTracker(n = 43, v = 0.1, dt = 1 / 43) {
  const t = createBeatTracker()
  for (let i = 0; i < n; i++) t.push(v, i * dt)
  return t
}

describe('beat tracker', () => {
  test('flat signal never fires', () => {
    const t = flatTracker(100)
    expect(t.push(0.1, 100 / 43)).toEqual({ detected: false, strength: 0 })
  })

  test('spike over the moving average fires with strength', () => {
    const t = flatTracker()
    const hit = t.push(0.9, 43 / 43)
    expect(hit.detected).toBe(true)
    expect(hit.strength).toBeCloseTo(1)
  })

  test('min-interval gate swallows the immediate echo', () => {
    const t = flatTracker()
    const at = 43 / 43
    expect(t.push(0.9, at).detected).toBe(true)
    expect(t.push(0.9, at + 0.01).detected).toBe(false)
  })

  test('periodic spikes converge the estimate toward 120 BPM', () => {
    const t = createBeatTracker({ initialBpm: 90 })
    for (let i = 0; i < 43; i++) t.push(0.1, i / 43)
    for (let k = 1; k <= 6; k++) {
      t.push(0.9, 1 + k * 0.5)
      for (let j = 1; j < 20; j++) t.push(0.1, 1 + k * 0.5 + j / 43)
    }
    const bpm = t.getEstimatedBpm()
    expect(bpm).toBeGreaterThan(100)
    expect(bpm).toBeLessThanOrEqual(125)
  })

  test('reset restores the default estimate', () => {
    flatTracker().push(0.9, 2)
    resetBeatTracker()
    expect(getEstimatedBpm()).toBe(120)
  })
})

describe('beat in frames and bindings', () => {
  const frame: Frame = { timeSec: 0, dt: 1 / 60, bpm: 120 }

  function baseAudio(): AudioFrame {
    return { bass: 0.5, mid: 0, treble: 0, level: 0.4, spectrum: new Float32Array(0), bpm: 120 }
  }

  test('withBeat attaches a reading without mutating the input', () => {
    const input = baseAudio()
    const out = withBeat(input, 0.1, 10)
    expect('beat' in input).toBe(false)
    expect(out.beat).toEqual({ detected: false, strength: 0 })
    // Manual BPM passes through untouched: the tracker never rewrites it.
    const manual = withBeat({ ...input, bpm: 82 }, 0.9, 20)
    expect(manual.bpm).toBe(82)
  })

  test("source 'beat' modulates by transient strength", () => {
    const bindings = [{ param: 'brightness', source: 'beat' as const, curve: 'linear' as const, amount: 0.5 }]
    const hot: AudioFrame = { ...baseAudio(), beat: { detected: true, strength: 0.8 } }
    expect(resolveEffectValue(0, bindings, 'brightness', frame, hot)).toBeCloseTo(0.4)
  })

  test('missing beat info falls back to base (fail-safe)', () => {
    const bindings = [{ param: 'brightness', source: 'beat' as const, curve: 'linear' as const, amount: 0.5 }]
    expect(resolveEffectValue(0.2, bindings, 'brightness', frame, baseAudio())).toBe(0.2)
  })
})
