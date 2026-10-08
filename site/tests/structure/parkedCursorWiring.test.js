// @vitest-environment node
// Pins the WIRING, not the API.
//
// parkCursor/sleepCursor shipped with passing unit tests that proved they work in
// isolation — and nothing called them. `cursorParkedRef` therefore stayed at {0,0}
// in production while the suite was green, and every effect that reads the parked
// position was reading the top-left corner. A dead export looks exactly like a
// working one from inside the hook's own test, so this asserts on the CALLERS.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')

const cursor = stripComments(read('src/components/ArchiveCursor.jsx'))

// Grab the touch-drag effect body: from the `if (!isTouch) return` guard to its
// closing dep array, so desktop code cannot satisfy the assertion.
const touchEffect = (() => {
  const a = cursor.indexOf('if (!isTouch) return')
  expect(a, 'touch effect not found').toBeGreaterThan(-1)
  const b = cursor.indexOf('}, [', a)
  expect(b, 'dep array not found').toBeGreaterThan(a)
  return cursor.slice(a, b)
})()

describe('parked cursor is actually driven', () => {
  it('a real drag parks the cursor', () => {
    // Must be inside the touch effect and reachable only past the drag threshold,
    // so this also fails if someone hoists it above the `isDraggingRef` guard and
    // reintroduces "a passive scroll wakes the cursor".
    expect(touchEffect).toMatch(/parkCursor\(e\.clientX,\s*e\.clientY\)/)
  })

  it('releasing the grab sleeps the cursor', () => {
    expect(touchEffect).toMatch(/sleepCursor\(\)/)
  })

  it('a touch that misses the cursor sleeps it too', () => {
    // The else branch of handlePointerDown: a scroll or a content tap must put the
    // cursor to sleep, or a parked cursor keeps driving effects during unrelated use.
    expect(touchEffect).toMatch(/\}\s*else\s*\{[^}]*sleepCursor\(\)/)
  })

  it('no other component is expected to drive it', () => {
    // If someone wires a second driver that is legitimate, but it should be a
    // deliberate decision recorded here rather than a silent duplicate.
    const others = ['src/components/Archives.jsx', 'src/components/FeaturedGallery.jsx',
      'src/components/SelectedProjects.jsx', 'src/components/TextEntryGlass.jsx']
    for (const f of others) {
      expect(stripComments(read(f)), `${f} drives parkCursor too — update this test`)
        .not.toMatch(/\bparkCursor\s*\(/)
    }
  })
})
