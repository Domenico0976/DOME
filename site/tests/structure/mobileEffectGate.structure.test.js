// @vitest-environment node
// On a touch device every canvas effect must be driven by the deliberate cursor
// grab, never by a clean tap. Two independent paths used to violate that:
//
//  1. The rAF wind loop. A tap moves the cursor within one frame while prevCursor
//     still holds the pre-tap position, so the velocity delta saturates rawStr and
//     the shader's caBase reaches its 0.09 cap — a visible RGB split per tap.
//  2. The slide-transition timeline, which explicitly animates uCAOffsetR/G/B.
//
// The gate must be read at the point of use: isAwake is a ref that changes without
// a re-render, so capturing it in a dependency array would freeze a stale value.
// The slide itself is content rather than an effect and must stay ungated.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')
const canvas = read('src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx')
const archives = read('src/components/Archives.jsx')

describe('mobile effect gate (B1)', () => {
  it('threads the gate from the section down to the canvas', () => {
    expect(archives).toMatch(/gateIsTouch=\{gateIsTouch\}/)
    expect(archives).toMatch(/gateIsAwake=\{isAwake\}/)
    expect(canvas).toMatch(/gateIsTouch\s*=\s*false/)
    expect(canvas).toMatch(/gateIsAwake\s*=\s*null/)
  })

  it('reads the awake ref at the point of use, not in a dependency array', () => {
    expect(canvas).toMatch(/const effectsGated\s*=\s*\(\)\s*=>/)
    // The gate must dereference the ref, not read it once.
    expect(canvas).toMatch(/!gateIsAwake\.current/)
    // A dep array would capture a value that never updates.
    expect(canvas).not.toMatch(/gateIsAwake\.current[\s\S]{0,400}?^\s*\}, \[/m)
  })

  it('snaps wind to zero while gated instead of decaying it', () => {
    const loopBody = /if \(effectsGated\(\)\) \{([\s\S]*?)\n      \}/.exec(canvas)
    expect(loopBody, 'gated branch not found in the rAF loop').not.toBeNull()
    const branch = loopBody[1]
    expect(branch).toMatch(/smoothStr\s*=\s*0/)
    expect(branch).toMatch(/rawStr\s*=\s*0/)
    // An EMA tail would keep the aberration on screen after the gate closed.
    expect(branch).not.toMatch(/smoothStr\s*\*=/)
  })

  it('gates the aberration phases but leaves the slide ungated', () => {
    expect(canvas).toMatch(/const allowCA\s*=\s*!effectsGated\(\)/)
    expect((canvas.match(/if \(allowCA\) \{/g) || []).length,
      'expected both CA phases to be gated').toBe(2)

    // A regex cannot answer this: the two gated blocks straddle the slide, so any
    // non-greedy match happily spans from the first one into the slide. Count braces.
    const slideAt = canvas.indexOf('tl.to(st.uniforms.uTransition, {')
    expect(slideAt, 'slide tween not found').toBeGreaterThan(-1)

    const ranges = []
    let from = 0
    for (;;) {
      const open = canvas.indexOf('if (allowCA) {', from)
      if (open === -1) break
      let depth = 0
      let end = open
      for (; end < canvas.length; end += 1) {
        if (canvas[end] === '{') depth += 1
        else if (canvas[end] === '}') {
          depth -= 1
          if (depth === 0) { end += 1; break }
        }
      }
      ranges.push([open, end])
      from = end
    }
    expect(ranges.length).toBe(2)
    for (const [start, end] of ranges) {
      expect(slideAt > start && slideAt < end,
        'slide must sit outside every allowCA block, not nested in one').toBe(false)
    }
  })

  it('leaves desktop inert', () => {
    // The default keeps the gate closed on non-touch devices, so hover-driven wind
    // and aberration on desktop are unchanged.
    expect(canvas).toMatch(/gateIsTouch\s*=\s*false/)
    expect(canvas).toMatch(/gateIsTouch\s*&&\s*gateIsAwake\s*&&\s*!gateIsAwake\.current/)
  })
})
