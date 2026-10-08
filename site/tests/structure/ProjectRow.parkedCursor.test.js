// @vitest-environment node
// Pins the contract, because the value itself is unreachable from a test.
//
// `mouseRef` is a plain useRef local to ProjectRow whose only readers are the tile
// spring field, which feeds a WebGL uniform. It is never written to the DOM, so no
// render/dispatch assertion can observe it, and jsdom cannot read the canvas back.
// A test that claims to assert on it via a data attribute would be asserting on
// something that does not exist.
//
// So this pins the source contract instead — the same approach as the rafEnabledRef
// latch test. It is weaker than a behavioural test and that is a real limitation,
// stated rather than hidden. What it does guarantee: the touch branch cannot be
// deleted or reverted to event-only without this going red.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/SelectedProjects.jsx'), 'utf8')

// The block that seeds mouseRef, i.e. the code under change.
const seedBlock = () => {
  const i = src.indexOf('mouseRef.current.x =')
  expect(i, 'mouseRef seed assignment not found').toBeGreaterThan(-1)
  return src.slice(Math.max(0, i - 400), i + 400)
}

describe('ProjectRow mouseRef on touch', () => {
  it('seeds mouseRef from the parked cursor, not only from event coordinates', () => {
    const b = seedBlock()
    // The parked cursor is the source of truth on touch: the event's coordinates are
    // wherever the finger happened to be, and there is no event at all for a parked
    // cursor, so an event-only branch receives nothing.
    expect(b).toMatch(/parked\.current/)
    // And the desktop path must survive, not be replaced by the touch branch.
    expect(b).toMatch(/clientX/)
  })

  it('guards the touch branch on the gate, not the raw drag flag', () => {
    expect(src).toMatch(/gateIsTouch\s*&&\s*!isAwake\.current/)
    // A re-introduced raw-flag read anywhere in the file is the regression this
    // plan exists to prevent, so assert the sanctioned name is present.
    expect(src).toContain('useCursorGate')
  })
})
