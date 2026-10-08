// @vitest-environment jsdom
// The pure resolution policy. Everything that needs a GPU is out of scope here on
// purpose — jsdom has no WebGL and no layout, so a test that pretended to measure
// frame time would be measuring nothing.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PIXEL_BUDGET,
  fitScale,
  pixelRatioFor,
} from '../../src/utils/renderScale.js'

describe('fitScale', () => {
  it('leaves a surface that already fits at full resolution', () => {
    expect(fitScale(1000, 500)).toBe(1)
    expect(fitScale(1000, 500, 10_000_000)).toBe(1)
  })

  it('scales down once the budget is exceeded, keeping the aspect ratio', () => {
    // A budget of a quarter of the area halves BOTH dimensions, so the box keeps
    // its shape and the mask-to-surface alignment survives.
    expect(fitScale(2000, 1000, 500_000)).toBeCloseTo(0.5, 10)
    expect(fitScale(2000 * 0.5, 1000 * 0.5, 500_000)).toBe(1)
  })

  it('brings the area to the budget, whatever the aspect ratio', () => {
    for (const [w, h] of [[2560, 1512], [1920, 1080], [1280, 800], [3440, 1440]]) {
      const k = fitScale(w, h, 1_000_000)
      expect(w * k * (h * k)).toBeCloseTo(1_000_000, 4)
    }
  })

  it('never supersamples and never returns a degenerate scale', () => {
    // A tall thin surface has to shrink on both axes, not have one floored to zero.
    const k = fitScale(10_000, 20, 100_000)
    expect(k).toBeLessThan(1)
    expect(k).toBeGreaterThan(0)
    expect(10_000 * k * 20 * k).toBeCloseTo(100_000, 4)
    expect(fitScale(2560, 1512, 1)).toBeGreaterThan(0)
  })

  it('degrades to 1 rather than NaN on an unmeasured or invalid box', () => {
    // The hook renders before the first measurement, and a display:none surface
    // measures zero. Neither may produce a transform that collapses the canvas.
    expect(fitScale(0, 0)).toBe(1)
    expect(fitScale(-100, 500)).toBe(1)
    expect(fitScale(1000, 500, 0)).toBe(1)
    expect(Number.isFinite(fitScale(2560, 1512, DEFAULT_PIXEL_BUDGET))).toBe(true)
  })
})

describe('pixelRatioFor', () => {
  it('passes dpr through untouched on a surface inside the budget', () => {
    // 1440x900 CSS is 1.3 Mpx, comfortably under the budget, so a retina display
    // must still get 2x — capping it here would cost quality for nothing.
    expect(pixelRatioFor(1440, 900, 2)).toBe(2)
    expect(pixelRatioFor(1440, 900, 1)).toBe(1)
  })

  it('never exceeds the device ratio or the hard ceiling', () => {
    expect(pixelRatioFor(800, 600, 3)).toBe(2)
    expect(pixelRatioFor(800, 600, 3, { max: 1.5 })).toBe(1.5)
  })

  it('caps the big desktop case that was actually measured at 14.7 Mpx', () => {
    // The regression this exists for: 2560x1440 at dpr 2 used to ask three.js for
    // 5120x2880, and every pass rendered at that size.
    const r = pixelRatioFor(2560, 1440, 2)
    expect(r).toBeLessThan(2)
    const devicePixels = 2560 * r * 1440 * r
    expect(devicePixels).toBeLessThan(14_748_000)
  })

  it('holds the device pixel count to the budget across viewports', () => {
    for (const [w, h] of [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      const r = pixelRatioFor(w, h, 2)
      expect(w * r * h * r).toBeLessThanOrEqual(DEFAULT_PIXEL_BUDGET * 4)
    }
  })

  it('refuses to go below the floor, whatever the budget asks for', () => {
    // A soft frame is cheaper than an unreadable one: the text layer is rasterised
    // into a texture, so below the floor it stops being legible.
    const r = pixelRatioFor(7680, 4320, 2, { budget: 1000, floor: 0.75 })
    expect(r).toBe(0.75)
  })

  it('survives a missing or nonsensical devicePixelRatio', () => {
    expect(Number.isFinite(pixelRatioFor(1920, 1080, 0))).toBe(true)
    expect(Number.isFinite(pixelRatioFor(1920, 1080, undefined))).toBe(true)
    expect(Number.isFinite(pixelRatioFor(0, 0, 2))).toBe(true)
  })
})
