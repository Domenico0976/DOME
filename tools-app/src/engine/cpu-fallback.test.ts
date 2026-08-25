import { describe, test, expect } from 'vitest'
import { applyAdjustmentsCPU, applyWavesCPU, applyGrainCPU } from './cpu-fallback'

function img2x1(r: number, g: number, b: number): ImageData {
  const img = new ImageData(2, 1)
  img.data[0] = r
  img.data[1] = g
  img.data[2] = b
  img.data[3] = 255
  img.data[4] = r
  img.data[5] = g
  img.data[6] = b
  img.data[7] = 255
  return img
}

const NEUTRAL = { contrast: 50, exposure: 50, saturation: 50, temperature: 50, tint: 50 }

describe('cpu fallback effects', () => {
  test('exposure doubles mid-gray at +1EV (75)', () => {
    const img = img2x1(64, 64, 64)
    applyAdjustmentsCPU(img, { ...NEUTRAL, exposure: 75 })
    expect(img.data[0]).toBe(128)
    expect(img.data[1]).toBe(128)
    expect(img.data[2]).toBe(128)
  })

  test('exposure halves at -1EV (25)', () => {
    const img = img2x1(200, 200, 200)
    applyAdjustmentsCPU(img, { ...NEUTRAL, exposure: 25 })
    expect(img.data[0]).toBe(100)
  })

  test('contrast 50 is neutral for every level', () => {
    const img = img2x1(37, 99, 200)
    applyAdjustmentsCPU(img, { ...NEUTRAL })
    expect([img.data[0], img.data[1], img.data[2]]).toEqual([37, 99, 200])
  })

  test('temperature warms white (R up, B down)', () => {
    const img = img2x1(255, 255, 255)
    applyAdjustmentsCPU(img, { ...NEUTRAL, temperature: 100 })
    expect(img.data[0]).toBe(255)
    expect(img.data[2]).toBe(232)
  })

  test('tint 0 pushes gray toward green', () => {
    const img = img2x1(128, 128, 128)
    applyAdjustmentsCPU(img, { ...NEUTRAL, tint: 0 })
    expect(img.data[0]).toBe(128)
    expect(img.data[1]).toBe(Math.round((128 / 255 + (50 - 0) * 0.0012) * 255))
    expect(img.data[2]).toBe(128)
  })

  test('waves shifts row by sine offset (deterministic)', () => {
    const img = new ImageData(4, 1)
    for (let x = 0; x < 4; x++) {
      img.data[x * 4] = x * 60
      img.data[x * 4 + 3] = 255
    }
    applyWavesCPU(img, { intensity: 0, quantity: 0.08, speed: 1 }, 1)
    expect(Array.from(img.data.slice(0, 16)).filter((_, i) => i % 4 === 0)).toEqual([0, 60, 120, 180])
  })

  test('grain with same seed is reproducible', () => {
    const a = img2x1(100, 100, 100)
    const b = img2x1(100, 100, 100)
    applyGrainCPU(a, { intensity: 0.5 }, 99)
    applyGrainCPU(b, { intensity: 0.5 }, 99)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
  })
})
