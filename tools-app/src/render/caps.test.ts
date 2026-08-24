import { describe, expect, it } from 'vitest'
import { resolveCaps } from './caps'

describe('resolveCaps', () => {
  it('desktop_allows_1920_dpr2_60fps', () => {
    expect(resolveCaps(false)).toEqual({ maxWidth: 1920, dprCap: 2, maxFps: 60 })
  })

  it('coarse_pointer_caps_1280_scale1_30fps', () => {
    expect(resolveCaps(true)).toEqual({ maxWidth: 1280, dprCap: 1, maxFps: 30 })
  })
})
