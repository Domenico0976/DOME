// @vitest-environment node
// A canvas closed because the archives section left the viewport must not reopen on
// scroll-back. Re-deriving visibility from `sectionInView && hoveredRow` would reopen
// it, and the user explicitly rejected that: a fresh interaction is required, on every
// platform.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')
const hook = read('src/hooks/useArchiveCursor.js')
const archives = read('src/components/Archives.jsx')
const mobile = read('src/components/MobileCanvas.jsx')

describe('viewport latch', () => {
  it('the latch lives in the shared hook, not in either canvas', () => {
    // Archives and MobileCanvas live on opposite sides of a portal, so a ref held in
    // either component cannot be read by the other. The shared hook is the only seam.
    expect(hook).toMatch(/latchedClosed/)
    expect(hook).toMatch(/clearLatchedClosed/)
  })

  it('the latch is a ref, not state', () => {
    // Reading it inside rAF and gesture handlers must not force a re-render.
    expect(hook).toMatch(/latchedClosed\s*=\s*useRef\(false\)|useRef\(false\)[^\n]*latchedClosed/)
  })

  it('a fresh row interaction clears the latch, in exactly one place', () => {
    const clears = archives.match(/clearLatchedClosed\s*\(/g) || []
    expect(clears.length, 'latch must be cleared from exactly one call site').toBe(1)
    expect(archives).toMatch(/clearLatchedClosed\s*\(\s*\)/)
  })

  it('the clear is gated on a genuinely fresh interaction', () => {
    // The spec requires a row *different* from the one the latch closed on. A blanket
    // clear would wrongly reopen when the user scrolls away and re-enters the same row.
    expect(archives).toMatch(/if\s*\(\s*isFreshInteraction\([^)]*\)\s*\)\s*clearLatchedClosed\s*\(\s*\)/)
    expect(hook).toMatch(/isFreshInteraction/)
    // Desktop compares against the row the latch recorded; mobile accepts any tap.
    expect(hook).toMatch(/rowIndex\s*!==\s*latchedRowRef\.current/)
  })

  it('latch participates in the desktop visibility derivation', () => {
    expect(archives).toMatch(/!latchedClosed\.current/)
  })

  it('the mobile canvas honours the latch', () => {
    expect(mobile).toMatch(/latchedClosed/)
  })
})