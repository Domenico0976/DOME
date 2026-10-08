import { describe, it, expect } from 'vitest'
import { normalizeRows, TEXT_ROWS } from '../../src/hero-glass/textRows'

describe('normalizeRows', () => {
  it('keeps behind as a real boolean and never coerces truthy', () => {
    const rows = normalizeRows([{ text: 'a', behind: 1 }])
    expect(rows[0].behind).toBe(false)
  })

  it('treats the string "true" as false, not as truthy', () => {
    const rows = normalizeRows([{ text: 'a', behind: 'true' }])
    expect(rows[0].behind).toBe(false)
  })

  it('preserves an explicit true', () => {
    const rows = normalizeRows([{ text: 'a', behind: true }])
    expect(rows[0].behind).toBe(true)
  })

  it('defaults behind to false when the key is absent', () => {
    const rows = normalizeRows([{ text: 'a' }])
    expect(rows[0].behind).toBe(false)
  })

  it('drops rows whose text is missing, empty or whitespace', () => {
    const rows = normalizeRows([
      { text: 'kept', behind: true },
      { text: '' },
      { text: '   ' },
      { text: 42 },
      {},
      null,
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('kept')
  })

  it('trims surrounding whitespace so measurement is not skewed', () => {
    const rows = normalizeRows([{ text: '  spaced  ', behind: true }])
    expect(rows[0].text).toBe('spaced')
  })

  it('returns an empty array for non-array input instead of throwing', () => {
    expect(normalizeRows(null)).toEqual([])
    expect(normalizeRows(undefined)).toEqual([])
    expect(normalizeRows('nope')).toEqual([])
  })

  it('is the single source for row count, so N rows in means N rows out', () => {
    for (const count of [1, 2, 4, 9]) {
      const input = Array.from({ length: count }, (_, i) => ({
        text: `row ${i}`,
        behind: i % 2 === 0,
      }))
      expect(normalizeRows(input)).toHaveLength(count)
    }
  })
})

describe('TEXT_ROWS', () => {
  it('survives its own normaliser unchanged in length', () => {
    expect(normalizeRows(TEXT_ROWS)).toHaveLength(TEXT_ROWS.length)
  })

  it('exercises both sides of the flag, so the effect is always observable', () => {
    const rows = normalizeRows(TEXT_ROWS)
    expect(rows.some((row) => row.behind)).toBe(true)
    expect(rows.some((row) => !row.behind)).toBe(true)
  })
})
