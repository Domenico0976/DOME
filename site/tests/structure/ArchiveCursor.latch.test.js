// @vitest-environment node
// Pins the root cause so it cannot be reintroduced: rafEnabledRef is written true
// ONLY in the morph branch's onComplete, and the shrink branch never restores it.
// A fast hover-then-exit kills the morph mid-flight, leaving it false forever, and
// the position RAF then matches neither branch and stops writing a transform.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/ArchiveCursor.jsx'), 'utf8')

const branch = (from, to) => {
  const a = src.indexOf(from)
  expect(a, `branch "${from}" not found`).toBeGreaterThan(-1)
  const b = src.indexOf(to, a)
  expect(b, `branch end "${to}" not found`).toBeGreaterThan(a)
  return src.slice(a, b)
}

describe('ArchiveCursor rafEnabledRef latch', () => {
  it('the shrink branch restores rafEnabledRef on entry', () => {
    const shrink = branch('if (!inRow) {', '} else {')
    expect(shrink).toMatch(/rafEnabledRef\.current\s*=\s*true/)
  })

  it('the shrink timeline restores it on completion too', () => {
    // Entry alone is not enough: the shrink path animates, and the latch has to be
    // true again once that animation lands, not only while it runs.
    const shrink = branch('if (!inRow) {', '} else {')
    const onComplete = shrink.slice(shrink.indexOf('onComplete'))
    expect(onComplete).toMatch(/rafEnabledRef\.current\s*=\s*true/)
  })

  it('the morph branch is what clears it, so the two are genuinely paired', () => {
    // Guards the diagnosis: if this ever stops being true the freeze has a different
    // cause and "fixing" the shrink branch would be treating a symptom.
    const morph = src.slice(src.indexOf('} else {'))
    expect(morph).toMatch(/rafEnabledRef\.current\s*=\s*false/)
  })
})
