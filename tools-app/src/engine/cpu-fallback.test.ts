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

describe('cpu fallback effects', () => {
  test('brightness shifts additively and clamps', () => {
    const img = img2x1(10, 20, 30)
    applyAdjustmentsCPU(img, { brightness: 100, contrast: 0, saturation: 0 })
    expect(img.data[0]).toBe(110)
    const clipped = img2x1(250, 250, 250)
    applyAdjustmentsCPU(clipped, { brightness: 50, contrast: 0, saturation: 0 })
    expect(clipped.data[0]).toBe(255)
  })

  test('contrast scales around 128', () => {
    const img = img2x1(128, 128, 128)
    applyAdjustmentsCPU(img, { brightness: 0, contrast: 50, saturation: 0 })
    expect(img.data[0]).toBe(128)
  })

  test('desaturation pulls toward luminance', () => {
    const img = img2x1(255, 0, 0)
    applyAdjustmentsCPU(img, { brightness: 0, contrast: 0, saturation: -1 })
    const lum = Math.round(0.299 * 255 + 0.587 * 0 + 0.114 * 0)
    expect(img.data[0]).toBe(lum)
    expect(img.data[1]).toBe(lum)
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
