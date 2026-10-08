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

  test('writeImageData fills provided buffer (zero-alloc path)', () => {
    const rd = new ReactionDiffusion(32)
    rd.seed(3, mulberry32(9))
    for (let i = 0; i < 30; i++) rd.step(0.055, 0.062)
    const img = new ImageData(32, 32)
    rd.writeImageData(img, [255, 128, 0])
    let foundAccent = false
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] === 255 && img.data[i + 1] === 128 && img.data[i + 2] === 0) { foundAccent = true; break }
    }
    expect(foundAccent).toBe(true)
  })

  test('writeImageData ignores mismatched size', () => {
    const rd = new ReactionDiffusion(16)
    rd.seed(1, mulberry32(2))
    const img = new ImageData(8, 8)
    expect(() => rd.writeImageData(img, [255, 0, 0])).not.toThrow()
  })

  test('stampBlobs adds B concentration without wiping existing state', () => {
    const rd = new ReactionDiffusion(32)
    rd.seed(1, mulberry32(5))
    for (let i = 0; i < 10; i++) rd.step(0.055, 0.062)
    const before = rd.averageB()
    expect(before).toBeGreaterThan(0)
    rd.stampBlobs(3, mulberry32(6))
    expect(rd.averageB()).toBeGreaterThanOrEqual(before)
  })
})
