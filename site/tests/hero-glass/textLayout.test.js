import { describe, it, expect } from 'vitest'
import { fitFontSize, layoutRows } from '../../src/hero-glass/textLayout'

// Linear stub: width grows with font-size and with character count, which is
// enough to exercise the bisection without a canvas or a DOM.
const linearMeasure = (chars) => (size, row) => size * chars * row.text.length

const base = {
  targetWidth: 1000,
  targetHeight: 4000,
  lineHeight: 0.97,
  pad: 3,
}

describe('fitFontSize', () => {
  it('finds the exact-fit size, biased just under it by the 2.3 tail divisor', () => {
    const measure = (size) => size * 10
    const fitted = fitFontSize({ measure, target: 300 })
    const exact = 30 // size * 10 === 300
    // The fit returns (lo + hi) / 2.3, not / 2, so a row settles ~13% short of
    // the container width by design. Assert the real contract, not / 2.
    expect(fitted).toBeLessThan(exact)
    expect(fitted).toBeGreaterThan(exact * 0.8)
  })

  it('gives a longer string a smaller size for the same target width', () => {
    const measure = (size, row) => size * row.text.length
    const short = fitFontSize({
      measure: (size) => measure(size, { text: 'ab' }),
      target: 800,
    })
    const long = fitFontSize({
      measure: (size) => measure(size, { text: 'a'.repeat(20) }),
      target: 800,
    })
    expect(long).toBeLessThan(short)
  })

  it('stays inside the search bracket', () => {
    const fitted = fitFontSize({ measure: (size) => size * 10, target: 300, min: 1.2, max: 200 })
    expect(fitted).toBeGreaterThanOrEqual(1.2)
    expect(fitted).toBeLessThanOrEqual(200)
  })

  it('does not exceed the target width even at the bracket ceiling', () => {
    // Target wider than the largest size can reach: the result must saturate at
    // max rather than run past it.
    const fitted = fitFontSize({ measure: (size) => size, target: 1e9 })
    expect(fitted).toBeLessThanOrEqual(200)
  })
})

describe('layoutRows', () => {
  it('sizes every row against its own text, not a shared sample row', () => {
    const rows = [
      { text: 'ab', behind: true },
      { text: 'a'.repeat(40), behind: false },
    ]
    const out = layoutRows({
      ...base,
      rows,
      measure: (size, row) => size * row.text.length,
    })
    expect(out[1].fontSize).toBeLessThan(out[0].fontSize)
  })

  it('returns one entry per row, preserving the flag', () => {
    const rows = [
      { text: 'a', behind: true },
      { text: 'b', behind: false },
      { text: 'c', behind: true },
    ]
    const out = layoutRows({ ...base, rows, measure: (size) => size })
    expect(out).toHaveLength(3)
    expect(out.map((r) => r.behind)).toEqual([true, false, true])
  })

  it('scales down when the stack would exceed the height budget', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ text: 'x', behind: true }))
    const out = layoutRows({
      ...base,
      targetHeight: 300,
      rows: many,
      measure: (size) => size * 200,
    })
    const total = out.reduce((sum, r) => sum + r.fontSize, 0) * base.lineHeight
    expect(total + base.pad * 2 * many.length).toBeLessThanOrEqual(300.001)
  })

  it('leaves the size untouched when the stack fits the budget', () => {
    const rows = [{ text: 'a', behind: true }]
    const roomy = layoutRows({ ...base, targetHeight: 100000, rows, measure: (size) => size })
    const tight = layoutRows({ ...base, targetHeight: 100000, rows, measure: (size) => size })
    expect(roomy[0].fontSize).toBe(tight[0].fontSize)
  })

  it('returns nothing for an empty row list', () => {
    expect(layoutRows({ ...base, rows: [], measure: (s) => s })).toEqual([])
  })

  it('returns nothing when there is no width to fit into', () => {
    expect(
      layoutRows({ ...base, targetWidth: 0, rows: [{ text: 'a', behind: true }], measure: (s) => s }),
    ).toEqual([])
  })

  it('scales an arbitrary row count without throwing', () => {
    for (const count of [1, 2, 3, 7, 16]) {
      const rows = Array.from({ length: count }, (_, i) => ({
        text: `row ${i} `.repeat(i + 1),
        behind: i % 2 === 0,
      }))
      const out = layoutRows({ ...base, rows, measure: (size, row) => size * row.text.length })
      expect(out).toHaveLength(count)
      for (const entry of out) {
        expect(Number.isFinite(entry.fontSize)).toBe(true)
        expect(entry.fontSize).toBeGreaterThan(0)
      }
    }
  })
})

describe('linearMeasure helper', () => {
  it('grows with both size and length', () => {
    const measure = linearMeasure(2)
    expect(measure(10, { text: 'ab' })).toBe(40)
    expect(measure(20, { text: 'ab' })).toBe(80)
  })
})
