// @vitest-environment node
// The slide transition was dead code. main() composed prev/next into `col`, then
// immediately reassigned col.r/g/b by sampling `uImage` alone — so the outgoing image
// never reached the framebuffer and no mask could make a slide appear. The aberration
// was the only part of the transition that survived that assignment, which is why it
// was the only part ever visible.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx'), 'utf8')

describe('transition shader', () => {
  it('the slide is a UV function', () => {
    expect(src).toMatch(/vec3\s+sampleTransition\s*\(\s*vec2\s+\w+\s*\)/)
  })

  it('aberration reads from the composite, never from a bare image', () => {
    // The exact defect: channel assignment sampling uImage outside sampleTransition.
    const main = /void\s+main\s*\(\s*\)\s*\{[\s\S]*\n\}/.exec(src)
    expect(main, 'main() not found').not.toBeNull()
    const body = main[0]
    const reassign = body.match(/\bcol\.[rgb]\s*=\s*[^;]*texture2D\(\s*uImage\s*,/g) || []
    expect(reassign.length,
      'a channel is still sampled straight from uImage, discarding the composite').toBe(0)
  })

  it('the radial diamond mask is gone', () => {
    // 1.0 - abs(uv.y - 0.5) * 2.0 cross-dissolves at the horizontal midline; it can
    // never produce an edge travelling along the slide axis.
    expect(src).not.toMatch(/abs\(\s*\w+\.y\s*-\s*0\.5\s*\)\s*\*\s*2\.0/)
  })

  it('selection is a hard edge driven by uSlideDir', () => {
    expect(src).toMatch(/uSlideDir\s*>\s*0\.0/)
    expect(src).toMatch(/1\.0\s*-\s*ease/)
  })
})