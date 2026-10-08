// @vitest-environment node
// The canvas box is FIXED at 3:2 and never derived from the media's intrinsic size.
//
// The regression guarded here is subtle and was reported as a visible "jerk": the
// previous version sized width and height from the viewport INDEPENDENTLY, which on
// desktop produced 340x440 — portrait 0.77 — while the archive media is 3:2
// landscape. The canvas therefore mounted portrait and GSAP-tweened down to
// 340x226.7 on every open. Because every media the archive shows is 3:2 (verified
// with ffprobe: alfly-test.gif 1620x1080, alfly-test.mp4 992x662,
// Animaz-ubank.gif 1080x720, Animaz-ubank.mp4 992x662), one fixed box is correct
// and removes the mid-flight correction entirely.
//
// The viewport must still reach the box, so a module-scope literal — which reads
// the viewport once at import and is then permanently stale on any device that
// rotates or collapses its URL bar — stays a failure.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/ArchiveHoverCanvas/PendulumCanvas.jsx'), 'utf8')

describe('PendulumCanvas fixed 3:2 box', () => {
  it('has no module-scope literal canvas size', () => {
    // A top-level `const <NAME> = <number>` before the component declaration is the
    // frozen form and can never react to a resize. A derived `= Math.max(...)` inside
    // the component is the live one, so the assertion is on a literal at line start.
    const beforeComponent = src.slice(0, src.indexOf('function PendulumCanvas'))
    expect(beforeComponent, 'module-scope canvas size found — it can never react to a resize')
      .not.toMatch(/^\s*const (?:MAX_[WH]|CANVAS_MAX_W|CANVAS_MAX_H)\s*=\s*\d/m)
  })

  it('locks the box to exactly 3:2', () => {
    expect(src).toMatch(/const CANVAS_ASPECT\s*=\s*3\s*\/\s*2\b/)
    // Height is derived FROM the clamped width, so no clamp can break the ratio.
    expect(src).toMatch(/const boxH\s*=\s*boxW\s*\/\s*CANVAS_ASPECT/)
    // 420 / 1.5 === 280 exactly, and the media aspect is 1.5 exactly.
    const maxW = /const CANVAS_MAX_W\s*=\s*(\d+)/.exec(src)
    expect(maxW, 'CANVAS_MAX_W not found').not.toBeNull()
    expect(Number(maxW[1]) / (3 / 2)).toBe(280)
  })

  it('derives the width from the live visual viewport', () => {
    expect(src).toContain('useVisualViewport')
    expect(src).toMatch(/const boxW\s*=\s*isWide\s*\?[\s\S]{0,120}viewport\.width/)
  })

  it('never derives the box from the media intrinsic size', () => {
    // The bug's two ingredients: reading intrinsic dimensions, and tweening the box
    // to fit them. Both must be gone, or the jerk returns on any odd-aspect asset.
    expect(src, 'intrinsic media sizing reintroduced — this is the B2 jerk')
      .not.toMatch(/fitSize|naturalWidth|naturalHeight|videoWidth|videoHeight/)
  })

  it('does not re-run the sizing effect on project change', () => {
    // The effect that applies the box must depend on the box only. Re-arming on
    // image/videoPath/gifPath is what made every project change restart the tween.
    const applyBlock = /Apply the fixed box[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}, \[([^\]]*)\]\)/.exec(src)
    expect(applyBlock, 'fixed-box effect not found').not.toBeNull()
    const deps = applyBlock[1]
    expect(deps).toMatch(/boxW/)
    expect(deps).toMatch(/boxH/)
    expect(deps).not.toMatch(/image|videoPath|gifPath/)
  })

  it('re-seeds the size refs when the box moves', () => {
    // useRef only reads its argument on the first render, so a viewport-derived box
    // needs an explicit re-seed or these two keep the initial screen's size.
    expect(src).toMatch(/sizeRef\.current\s*=\s*size/)
    expect(src).toMatch(/committedSizeRef\.current\s*=\s*size/)
  })
})
