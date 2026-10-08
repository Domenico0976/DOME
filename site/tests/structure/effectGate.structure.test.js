// @vitest-environment node
//
// The enforcement behind spec §6. A markdown rule was already violated three times
// in one session; this fails the suite instead, so an ungated effect cannot be
// landed as "done".
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(process.cwd(), 'src')

// Files that own a WebGL/canvas surface and deliberately take no cursor input.
// Derived from the real surface set (12 files) rather than assumed — an earlier
// draft of this plan listed a MatrixRain component that does not exist, which the
// third test below would have failed on immediately. Adding an entry is a
// deliberate act, and that test fails if an entry points at a file that is gone.
const EXEMPT = new Set([
  'webgl-water/HeroShaderStack.jsx',           // hero: exempt by user instruction
  'components/CursorGlow.jsx',                 // 2D canvas, decorative only
  'components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx',  // receives an already-gated cursorRef as a PROP
  'components/MobileSectionCanvas.jsx',        // same: prop-drilled cursor
  'hero-glass/engine.js',                      // engine internals; receives setPointer
  'preloader/scene.js',                        // preloader, owns no cursor
  'preloader/config.js',                       // config, matches the regex incidentally
  'utils/renderScale.js',                      // utility, matches the regex incidentally
])

// KNOWN LIMITATION, stated rather than hidden: ArchiveHoverCanvas and
// MobileSectionCanvas receive the cursor as a prop from a gated parent, so the leaf
// cannot gate it itself. They are exempted, which means a future edit that adds its
// OWN cursor read there would not be caught. Closing that hole needs the prop to be
// the only sanctioned way in — a follow-up, not this plan.

const SURFACE_RE = /new THREE\.WebGLRenderer|<canvas\b|<Shader\b/
// Reading any of these means the surface consumes pointer/cursor state and must
// therefore be gated.
const CURSOR_RE = /cursorRef|isCursorActive|isDragging|isCursorAwake|cursorParked|pointermove|mousemove|pointerenter|mouseenter/

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

const rel = (file) => path.relative(SRC, file).split(path.sep).join('/')

// Scan CODE, not prose. A comment that explains why a raw flag is banned used to
// be flagged as a violation of that ban, which is a false positive that trains
// people to ignore the test. Line comments and block comments are stripped first;
// the exemption lists below are matched against the code, not the commentary.
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')

const sources = walk(SRC)
const surfaces = sources.filter((f) => SURFACE_RE.test(fs.readFileSync(f, 'utf8')))

describe('effect gating', () => {
  // Guard the guard: a scan that matches nothing would make the whole suite pass
  // vacuously, which is the exact shape of failure this file exists to prevent.
  it('discovers the WebGL/canvas surfaces (the scan must find something)', () => {
    expect(surfaces.length).toBeGreaterThan(5)
  })

  it('no surface reads cursor state without going through useCursorGate', () => {
    const offenders = []
    for (const file of surfaces) {
      const src = stripComments(fs.readFileSync(file, 'utf8'))
      const r = rel(file)
      if (EXEMPT.has(r)) continue
      if (src.includes('useCursorGate')) continue
      if (!CURSOR_RE.test(src)) continue          // no cursor input at all
      offenders.push(r)
    }
    expect(offenders).toEqual([])
  })

  it('every exemption still points at a real file', () => {
    for (const e of EXEMPT) {
      expect(fs.existsSync(path.join(SRC, e)), `exempt path ${e} does not exist`).toBe(true)
    }
  })

  it('no effect site reaches for the raw drag flags', () => {
    // The specific failure that went unnoticed: a site reading isCursorActiveRef
    // directly. Correct-looking, ungated, and invisible in review.
    //
    // A verified offender list, taken by running this scan against the tree rather
    // than by reasoning about it, is: ArchiveCursor.jsx, Archives.jsx,
    // FeaturedGallery.jsx, FocusCalloutShader.jsx, SelectedProjects.jsx. Three are
    // converted by Tasks 6, 8 and 9. The other two are handled as follows, and the
    // reasons are load-bearing — do not widen these exemptions:
    //
    //   ArchiveCursor.jsx  EXEMPT: it *is* the cursor. It reads isDraggingRef to
    //     decide whether the dragged element follows the finger, so it is the
    //     implementer of the drag, not a consumer that could bypass it. Gating it
    //     would mean gating the cursor behind itself.
    //
    //   Archives.jsx  NOT exempt: its isCursorActiveRef guard at line 107 is the
    //     exact tap-vs-drag pattern this test exists to catch. Converted in Task 13.
    const LEGITIMATE = new Set([
      'hooks/useArchiveCursor.js',     // the provider
      'hooks/useCursorGate.js',        // the sanctioned reader
      'components/ArchiveCursor.jsx',  // the cursor's own drag implementation
    ])
    // TIGHTENED 2026-09-30. This test used to `continue` on any file that merely
    // MENTIONED useCursorGate, which made it vacuous: a probe that swapped one guard
    // back to a raw drag flag still passed, because the import line was enough to
    // skip the whole file. The exemption must be the file's ROLE, not whether it also
    // happens to call the gate.
    const offenders = []
    for (const file of sources) {
      const src = stripComments(fs.readFileSync(file, 'utf8'))
      if (LEGITIMATE.has(rel(file))) continue
      if (!/isCursorActiveRef|isDraggingRef|isDragging\b/.test(src)) continue
      offenders.push(rel(file))
    }
    expect(offenders).toEqual([])
  })
})
