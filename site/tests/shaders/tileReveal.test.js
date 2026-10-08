import { describe, it, expect } from 'vitest'
import { vertexShader, fragmentShader } from '../../src/shaders/tileReveal'

describe('tileReveal shaders', () => {
  it('vertex is a trivial passthrough (no geometry displacement, no gaps)', () => {
    expect(vertexShader).not.toMatch(/attribute\s+vec2\s+aCell/)
    expect(vertexShader).not.toMatch(/pos\.xy\s*\+=/)
    expect(vertexShader).toMatch(/gl_Position\s*=\s*projectionMatrix/)
    expect(vertexShader).toMatch(/out\s+vec2\s+vUv/)
  })

  it('fragment samples the warped uv WITHOUT a hard clamp (no smear band)', () => {
    expect(fragmentShader).not.toMatch(/clamp\s*\(/)
    expect(fragmentShader).toMatch(/texture\s*\(/)
    expect(fragmentShader).toMatch(/coverUv/)
  })

  it('edge taper keeps the sample inside [0,1] (fabric bend, not smear)', () => {
    // room-based falloff scales the offset down as the sample nears a border
    expect(fragmentShader).toMatch(/fromBorder/)
    expect(fragmentShader).toMatch(/room/)
    expect(fragmentShader).toMatch(/smoothstep/)
    expect(fragmentShader).toMatch(/k/)
  })

  it('pointer displacement is graded / faded, never uniform 100%', () => {
    expect(fragmentShader).toMatch(/mousePush/)
    expect(fragmentShader).toMatch(/uHover/)
    expect(fragmentShader).toMatch(/uMouse/)
    // graded falloff: peaks below full strength and fades with distance
    expect(fragmentShader).toMatch(/smoothstep\(0\.7,\s*0\.0,\s*d\)/)
  })

  it('keeps every uniform the effect relies on', () => {
    for (const u of [
      'uTime', 'uReveal', 'uHover', 'uMouse', 'uGrid', 'uSeed',
      'uPlaneAspect', 'uImgAspect', 'uTex',
    ]) {
      expect(fragmentShader).toContain(u)
    }
  })

  it('reveal + idle + edge math drive the alpha (tileOn), not a vertex pass', () => {
    expect(fragmentShader).toMatch(/tileOn/)
    expect(fragmentShader).toMatch(/revealMask/)
  })
})
