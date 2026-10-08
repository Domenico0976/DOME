// @vitest-environment node
// The death fade is the one behaviour in this hook that cannot be observed from a unit test:
// the head has to leave the grid, fall past the bottom edge and dissolve over DEATH_FADE_MS,
// all inside a requestAnimationFrame loop on a 2D context. What CAN be pinned down is the
// shape of the code, and three of these assertions guard real regressions rather than
// restating the implementation.
//
// The load-bearing one is the reset. `s.y = -Math.random() * 4` used to sit on
// `if (s.y - TRAIL > rows)`, i.e. the frame after the head left the grid. Put the reset back
// there and the stream respawns at the top in the same frame the head dissolves, so the
// effect is never on screen for a single frame while every other assertion still passes.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/hooks/useMatrixRain.js'), 'utf8')

const frameBody = () => {
  const m = /const frame = \(now\) => \{[\s\S]*?\n {4}\}/.exec(src)
  expect(m, 'frame() not found').not.toBeNull()
  return m[0]
}

describe('matrix rain death fade', () => {
  it('declares both death constants before frame() uses them', () => {
    const fade = /const DEATH_FADE_MS = ([\d.]+)/.exec(src)
    const blur = /const DEATH_BLUR_PX = ([\d.]+)/.exec(src)
    expect(fade, 'DEATH_FADE_MS missing').not.toBeNull()
    expect(blur, 'DEATH_BLUR_PX missing').not.toBeNull()
    expect(Number(fade[1])).toBeGreaterThan(0)
    expect(Number(blur[1])).toBeGreaterThan(0)
    // A const is in the temporal dead zone until its declaration runs, so referencing one of
    // these above the other would be a latent ReferenceError even though frame() only runs
    // later via rAF.
    expect(src.indexOf('const DEATH_FADE_MS')).toBeLessThan(src.indexOf('const frame ='))
    expect(src.indexOf('const DEATH_BLUR_PX')).toBeLessThan(src.indexOf('const frame ='))
  })

  it('resets the stream only after the fade has finished', () => {
    // The old form is the regression: respawn on the frame the head leaves the grid.
    expect(src).not.toMatch(/if \(s\.y - TRAIL > rows\)\s*s\.y = -Math\.random\(\) \* 4/)
    expect(src).toMatch(/s\.diedAt && deathT >= 1/)
  })

  it('lets the dying head fall past the grid instead of culling it', () => {
    // An unconditional `ry > rows` cull removes the head the instant it leaves the grid,
    // which is the whole thing the effect exists to avoid.
    expect(src).not.toMatch(/if \(ry < 0 \|\| ry > rows\) continue/)
    expect(src).toMatch(/if \(!s\.diedAt && ry > rows\) continue/)
  })

  it('clears shadowBlur in the same place it resets globalAlpha', () => {
    const body = frameBody()
    expect(body).toMatch(/ctx\.globalAlpha = 1/)
    expect(body).toMatch(/ctx\.shadowBlur = 0/)
  })

  it('still skips the whole hook under prefers-reduced-motion', () => {
    // The fade is motion. If this guard is moved or dropped, reduced-motion visitors get it.
    expect(src).toMatch(/prefers-reduced-motion/)
  })
})