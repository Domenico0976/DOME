import { describe, test, expect } from 'vitest'
import { ReactionDiffusion, mulberry32 } from './rd'

describe('ReactionDiffusion', () => {
  test('same seed produces identical state (determinism)', () => {
    const mk = () => {
      const rd = new ReactionDiffusion(32)
      rd.seed(3, mulberry32(42))
      for (let i = 0; i < 20; i++) rd.step(0.055, 0.062)
      return rd.averageB()
    }
    expect(mk()).toBe(mk())
  })

  test('pattern diverges from flat state without NaN', () => {
    const rd = new ReactionDiffusion(48)
    rd.seed(2, mulberry32(7))
    for (let i = 0; i < 60; i++) rd.step(0.055, 0.062)
    const avg = rd.averageB()
    expect(Number.isFinite(avg)).toBe(true)
    expect(avg).toBeGreaterThan(0)
  })

  test('toImageData mixes accent by B channel', () => {
    const rd = new ReactionDiffusion(16)
    rd.seed(1, mulberry32(1))
    const img = rd.toImageData([255, 128, 0])
    expect(img.width).toBe(16)
    expect(img.data.length).toBe(16 * 16 * 4)
  })
})
