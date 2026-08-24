import { describe, expect, it } from 'vitest'
import { averageRange, computeBandRanges, downsampleToBands, readBandsFrom } from './bands'

describe('computeBandRanges', () => {
  it('correct_band_indices_at_48khz', () => {
    const ranges = computeBandRanges(48000, 1024)

    expect(ranges.bass).toEqual({ start: 1, end: 11 })
    expect(ranges.mid).toEqual({ start: 11, end: 86 })
    expect(ranges.treble).toEqual({ start: 86, end: 683 })
  })

  it('at_44_1kHz_indices_shift_because_derived_from_sampleRate', () => {
    const ranges = computeBandRanges(44100, 1024)

    expect(ranges.bass).toEqual({ start: 1, end: 12 })
    expect(ranges.mid).toEqual({ start: 12, end: 93 })
    expect(ranges.treble).toEqual({ start: 93, end: 744 })
  })

  it('treble_clamped_to_bin_count_within_nyquist', () => {
    const ranges = computeBandRanges(8000, 1024)
    const nyquistHz = 4000

    expect(ranges.treble.end).toBeLessThanOrEqual(1024)
    expect(ranges.treble.start * (8000 / 2048)).toBeLessThanOrEqual(nyquistHz)
  })
})

describe('averageRange', () => {
  it('normalizes_bytes_0_255_into_0_1_range', () => {
    const bytes = new Uint8Array(1024).fill(128)

    expect(averageRange(bytes, { start: 0, end: 1024 })).toBeCloseTo(128 / 255, 6)
  })

  it('empty_range_returns_zero_without_dividing_by_zero', () => {
    const bytes = new Uint8Array(1024).fill(200)

    expect(averageRange(bytes, { start: 500, end: 500 })).toBe(0)
  })
})

describe('readBandsFrom', () => {
  it('full_255_band_reads_one_zero_elsewhere_consistent_level', () => {
    const bytes = new Uint8Array(1024)
    const ranges = computeBandRanges(48000, 1024)
    for (let i = ranges.bass.start; i < ranges.bass.end; i += 1) bytes[i] = 255

    const snapshot = readBandsFrom(bytes, ranges)

    expect(snapshot.bass).toBe(1)
    expect(snapshot.mid).toBe(0)
    expect(snapshot.treble).toBe(0)
    expect(snapshot.level).toBeCloseTo((ranges.bass.end - ranges.bass.start) / 1024, 6)
  })
})

describe('downsampleToBands', () => {
  it('even_split_averages_each_band_normalized', () => {
    const bytes = new Uint8Array([255, 255, 0, 0])
    const out = new Float32Array(2)

    const result = downsampleToBands(bytes, out)

    expect(result).toBe(out)
    expect(out[0]).toBeCloseTo(1, 6)
    expect(out[1]).toBeCloseTo(0, 6)
  })

  it('uniform_spectrum_fills_every_band_with_same_value', () => {
    const bytes = new Uint8Array(1024).fill(128)
    const out = new Float32Array(64)

    downsampleToBands(bytes, out)

    for (let i = 0; i < out.length; i += 1) expect(out[i]).toBeCloseTo(128 / 255, 6)
  })

  it('uneven_split_covers_every_source_byte_exactly_once', () => {
    const bytes = new Uint8Array([255, 0, 255])
    const out = new Float32Array(2)

    downsampleToBands(bytes, out)

    expect(out[0]).toBeCloseTo(1, 6)
    expect(out[1]).toBeCloseTo(0.5, 6)
  })
})
