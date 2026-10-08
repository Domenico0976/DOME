// @vitest-environment node
// Three defects on .project-row, all of which came from the title's box not being owned by
// CSS. None of them is observable from a unit test — they need a hover, a real font and a
// layout — so what is pinned here is the shape of the fix, and each assertion below is
// there because reverting it silently reinstates a bug that shipped once already.
//
//   1. The box. buildDOM used to derive a height from canvas font metrics and pin it on the
//      h3 as inline style, applied on FIRST hover. With line-height 1.0 the natural box was
//      font-size while the ink needed ~1.3x that, so the row jumped ~25px the first time a
//      visitor touched it. The box is now CSS's job via --pr-title-leading.
//   2. The grid. The DOM tiles were a fixed 12x5 of CSS tracks while the pixel buffer
//      stepped in 7px cells: two grids at different resolutions, so the tiles never matched
//      what the buffer had sampled.
//   3. The stagger. GSAP's `each` is per tile, so a fixed 0.035 over a denser grid stretches
//      the same fade from ~2s to ~7s.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const jsx = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/SelectedProjects.jsx'), 'utf8')
const css = fs.readFileSync(
  path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8')

const section = (from, to) => {
  const a = jsx.indexOf(from)
  const b = jsx.indexOf(to)
  expect(a, `${from} not found`).toBeGreaterThan(-1)
  expect(b, `${to} not found`).toBeGreaterThan(a)
  return jsx.slice(a, b)
}

const buildDOM = () => section('const buildDOM = () => {', 'const initPixelCanvas')

describe('project title box is owned by CSS', () => {
  it('never pins an inline height on the h3', () => {
    // Both halves mattered. The h3 alone was not enough: .pr-name__wrapper is an
    // inline-block, so its own height is what sets the h3's line box. Both are gone.
    expect(buildDOM()).not.toMatch(/el\.style\.height/)
    expect(buildDOM()).not.toMatch(/wrapper[\s\S]*?height:\$\{/)
  })

  it('no longer derives the box from canvas font metrics', () => {
    // heightRef is still read, but it is now the measured CSS box. The max() against the
    // glyph height is the line that made the title grow.
    expect(buildDOM()).not.toMatch(/Math\.max\(baseHeight/)
    expect(buildDOM()).not.toMatch(/fullGlyphHeight/)
  })

  it('keeps a leading that can hold the glyphs', () => {
    // The load-bearing assertion. 1.35 with a 70px title gives ~94px against ~91px of ink.
    // Put line-height back to 1.0 and the box clips the ascenders and descenders instead.
    const m = /--pr-title-leading:\s*([\d.]+)/.exec(css)
    expect(m, '--pr-title-leading missing').not.toBeNull()
    expect(Number(m[1])).toBeGreaterThanOrEqual(1.2)
    expect(css).toMatch(/\.project-row \.pr-name \{[^}]*line-height: var\(--pr-title-leading\)/)
  })

  it('sizes the title from the variable at both breakpoints', () => {
    expect(css).toMatch(/--pr-title-size: clamp\(40px, 7vw, 70px\)/)
    // Tablet follows the layout breakpoint (TABLET_BREAKPOINT = 1024), not the 720px
    // typography one. Between 721 and 1024 the row IS a tablet row. Redefined on :root
    // rather than on .pr-name, so the custom property stays the single place the title
    // size lives and the two breakpoints cannot drift into competing declarations.
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?:root \{ --pr-title-size: clamp\(40px, 9vw, 64px\); \}/)
    // And no competing clamp is left behind on .pr-name itself.
    expect(css).not.toMatch(/\.project-row \.pr-name \{[^}]*font-size: clamp/)
  })
})

describe('tile grid and pixel buffer share one cell size', () => {
  it('writes the grid geometry from GRID_CELL', () => {
    expect(css).not.toMatch(/\.pr-name__grid \{[^}]*grid-template-/)
    expect(jsx).toMatch(/gridTemplateColumns = `repeat\(\$\{cols\}, \$\{GRID_CELL\}px\)`/)
    expect(jsx).toMatch(/gridTemplateRows = `repeat\(\$\{rows\}, \$\{GRID_CELL\}px\)`/)
  })

  it('steps the buffer in the same GRID_CELL', () => {
    // A literal 7 here is what silently re-decoupled the two grids.
    expect(jsx).not.toMatch(/const cell = \d/)
    expect(jsx).toMatch(/const cell = GRID_CELL/)
  })

  it('culls tiles to the cells that carry ink', () => {
    // Without this the tile count is the whole bounding box and it compounds across every
    // row the visitor has hovered, since the grid is built once and never rebuilt.
    expect(jsx).toMatch(/GRID_INK_ALPHA/)
    expect(jsx).toMatch(/if \(!inked\) continue/)
  })
})

describe('tile fade stays bounded as the grid densifies', () => {
  it('divides the stagger by the tile count', () => {
    expect(jsx).toMatch(/TILE_FADE_SPAN/)
    expect(jsx).toMatch(/each: tileStagger/)
    // A fixed per-tile `each` would spread a ~2s fade over ~7s with a few hundred tiles.
    expect(jsx).not.toMatch(/each: 0\.035/)
  })
})

// The glyph is drawn as a grid of blocks. Two separate defects showed up in it: cells whose
// ink fell between the coverage samples were never drawn at all, and widening the blocks to
// close the gaps made the text measurably bolder and dissolved the pixel structure. So the
// holes are closed by sampling every pixel, and the block keeps its own cell's size.
describe('the coverage mask catches every cell that has ink', () => {
  it('samples the whole cell rather than stepping over it', () => {
    // Stepping by 2 could step straight over a stroke thinner than the sample pitch, and the
    // cell was then never drawn — that is what broke the glyph into separate pieces. Step 1
    // makes `covered` exact, so nothing has to be drawn speculatively to patch a miss.
    expect(jsx).toMatch(/for \(let sy = 0; sy < cell && !hit; sy\+\+\)/)
    expect(jsx).toMatch(/for \(let sx = 0; sx < cell; sx\+\+\)/)
  })

  it('does not dilate the mask to fake coverage', () => {
    // Dilation was the first answer to the same problem and it cost more than it bought: it
    // triples the per-frame drawImage count and, at bleed 1, measured +17% ink against the
    // DOM text. Exact sampling replaced it, so dilation must not creep back in.
    expect(jsx).not.toMatch(/\bpaint\b/)
  })
})

describe('the block bleed stays symmetric', () => {
  it('spills the block past its own cell', () => {
    const m = /const CELL_BLEED = ([\d.]+)/.exec(jsx)
    expect(m, 'CELL_BLEED missing').not.toBeNull()
    // The VALUE is a design choice and is deliberately not pinned here: an earlier version
    // of this test asserted it, on the strength of ink measurements that later turned out to
    // be noise. What is not negotiable is the symmetry below, so that is what is asserted.
    expect(Number(m[1])).toBeGreaterThanOrEqual(0)
  })

  it('widens the source and the destination by the same amount, in whole device pixels', () => {
    // The load-bearing assertion. Widening only the destination scales the block up and
    // softens the glyph — the `cell + 0.5` bug, which shipped once and made the title read
    // 12% bolder than the DOM text. The ratio between source and destination is the scale,
    // and it has to stay 1:1.
    //
    // The bleed is rounded to whole DEVICE pixels and the CSS offset is derived back from
    // it. A fractional source rect makes drawImage round per frame and the edge shimmers.
    expect(jsx).toMatch(/const bpx = Math\.round\(CELL_BLEED \* dpr\)/)
    expect(jsx).toMatch(/const bcss = bpx \/ dpr/)
    expect(jsx).toMatch(/const sx = Math\.max\(0, Math\.round\(x \* dpr\) - bpx\)/)
    expect(jsx).toMatch(/sw \/ dpr, sh \/ dpr/)
  })
})

describe('the tile displacement loop does not read layout per frame', () => {
  it('reads each tile home position once, not every frame', () => {
    // 420 tiles times getBoundingClientRect per frame was the page-level cost of a hover.
    // It also folded in the loop's own transforms, so the force was computed from each
    // tile's already-displaced position and fed the displacement back into itself.
    const loop = section('const startDisplacement = () => {', 'const stopDisplacement')
    const readOnce = /const centres = tiles\.map[\s\S]*?offsetLeft[\s\S]*?offsetTop/
    expect(loop).toMatch(readOnce)
    const afterCentres = loop.slice(loop.indexOf('const centres'))
    expect(afterCentres).not.toMatch(/getBoundingClientRect/)
  })
})

// The mobile callout is deliberately oversized: clamp(140px, 7vw, 280px) resolves to a flat
// 140px on every phone, where "Generative" measures ~620px against a 375px screen.
describe('the mobile callout is oversized and its text breaks to fit', () => {
  // The body of the 720px query that governs the callout, found by brace matching rather
  // than by cutting at the next "\n}". global.css has several 720px queries, so indexOf
  // lands on whichever comes first — usually not this one — and the slice silently describes
  // the wrong block. Matching braces also survives the long explanatory comments inside.
  const mobile = (() => {
    const needle = '@media (max-width: 720px) {'
    let from = 0
    for (;;) {
      const a = css.indexOf(needle, from)
      if (a < 0) break
      let depth = 0
      let i = a + needle.length - 1
      for (; i < css.length; i++) {
        if (css[i] === '{') depth++
        else if (css[i] === '}') { depth--; if (depth === 0) break }
      }
      const body = css.slice(a, i + 1)
      if (body.includes('.focus-callout')) return body
      from = a + needle.length
    }
    return ''
  })()

  it('uses the requested clamp', () => {
    expect(mobile).toMatch(/\.focus-callout \{ font-size: clamp\(100px, 9vw, 230px\); \}/)
  })

  it('breaks on syllable boundaries, with a fallback that cannot overflow', () => {
    // `manual`, not `auto`. Measured on an iPhone 11 Pro: `auto` silently does nothing,
    // because there is no hyphenation dictionary for the locale, and the arbitrary-break
    // fallback then cuts 130px type wherever the arithmetic lands — Gener / rat / ive,
    // mid-syllable. `manual` ignores dictionaries and breaks only at the soft hyphens in
    // CALLOUT_LINES_*, which sit on real syllable boundaries; the browser still picks where.
    expect(mobile).toMatch(/hyphens: manual;/)
    expect(mobile).toMatch(/-webkit-hyphens: manual;/)
    // The floor under it: a word with no soft hyphen in it would otherwise overflow the
    // column and be cropped. Safety net, not the mechanism.
    expect(mobile).toMatch(/overflow-wrap: break-word;/)
    // `anywhere` also shrinks the min-content width, which collapses the grid the mask
    // measures its line boxes against.
    expect(mobile).not.toMatch(/overflow-wrap: anywhere;/)
  })

  it('carries soft hyphens on real syllable boundaries in the content', () => {
    // Without these, `hyphens: manual` has nothing to act on and every word over the column
    // width would rely on the arbitrary fallback. Asserted on the DATA, not the CSS: this
    // is the part that has to be right per language, and no amount of styling substitutes.
    expect(jsx).toMatch(/const CALLOUT_LINES_MOBILE = \[.*\\u00AD/)
    expect(jsx).toMatch(/const CALLOUT_LINES_DESKTOP = \[.*\\u00AD/)
  })

  it('caps the span so the oversized text can actually wrap', () => {
    // The load-bearing one. .focus-callout__text is an inline-block, and an inline-block
    // shrink-wraps to its content: without an explicit max-width it stays one 620px line
    // and overflows, so the wrap properties inside it would be dead CSS and the lockup
    // would clip.
    expect(mobile).toMatch(/\.focus-callout \.focus-callout__text \{[\s\S]*?max-width: 100%;/)
  })

  it('leaves the desktop size alone', () => {
    // The oversized lockup is mobile-scoped. Desktop keeps 12vw, so the media query must
    // not reach back past its own block.
    expect(mobile).not.toMatch(/\.focus-callout \{ font-size: clamp\(64px, 12vw/)
    expect(css).toMatch(/\.focus-callout \{[^}]*font-size: clamp\(64px, 12vw, 200px\)/)
  })
})