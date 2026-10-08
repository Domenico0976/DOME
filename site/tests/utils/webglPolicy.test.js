import { describe, it, expect } from 'vitest'
import { shouldEnableSectionWebGL } from '../../src/utils/webglPolicy'

describe('shouldEnableSectionWebGL', () => {
  it('enables section WebGL on mobile when motion is allowed', () => {
    expect(shouldEnableSectionWebGL({ isMobile: true, reduceMotion: false })).toBe(true)
  })

  it('enables section WebGL on desktop when motion is allowed', () => {
    expect(shouldEnableSectionWebGL({ isMobile: false, reduceMotion: false })).toBe(true)
  })

  it('disables section WebGL when reduced motion is preferred', () => {
    expect(shouldEnableSectionWebGL({ isMobile: false, reduceMotion: true })).toBe(false)
  })
})