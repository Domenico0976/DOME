// src/audio/reactToOptions.test.ts — guarantees: exact option list,
// default, mapping table, round-trips, unsupported + unknown handling.
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_REACT_TO,
  REACT_TO_OPTIONS,
  fromDomeBinding,
  selectOptionsFor,
  selectedOptionValue,
  toDomeBinding,
} from './reactToOptions'

describe('react-to options', () => {
  test('lists the exact 12 options with db default', () => {
    expect(REACT_TO_OPTIONS.map((o) => o.id)).toEqual([
      'db', 'high-freq', 'low-freq', 'kick', 'snare', 'hihat', 'freq-band',
      'bpm', 'snap-hold', 'automation', 'stem', 'harmony',
    ])
    expect(DEFAULT_REACT_TO).toBe('db')
  })

  test('automation is present but disabled (no lane UI yet)', () => {
    const auto = REACT_TO_OPTIONS.find((o) => o.id === 'automation')
    expect(auto?.disabled).toBe(true)
    expect(toDomeBinding('automation')).toBeNull()
  })

  test('maps every enabled option onto a DOME source', () => {
    expect(toDomeBinding('db')).toEqual({ source: 'level' })
    expect(toDomeBinding('stem')).toEqual({ source: 'level' })
    expect(toDomeBinding('low-freq')).toEqual({ source: 'bass' })
    expect(toDomeBinding('kick')).toEqual({ source: 'bass' })
    expect(toDomeBinding('snare')).toEqual({ source: 'mid' })
    expect(toDomeBinding('high-freq')).toEqual({ source: 'treble' })
    expect(toDomeBinding('hihat')).toEqual({ source: 'treble' })
    expect(toDomeBinding('freq-band', 7)).toEqual({ source: 'spectrum', band: 7 })
    expect(toDomeBinding('harmony', 3)).toEqual({ source: 'spectrum', band: 3 })
    expect(toDomeBinding('bpm')).toEqual({ source: 'bpm' })
    expect(toDomeBinding('snap-hold')).toEqual({ source: 'beat' })
  })

  test('unknown ids map to null (fail-safe: caller ignores)', () => {
    expect(toDomeBinding('window')).toBeNull()
    expect(toDomeBinding('')).toBeNull()
  })

  test('reverse-maps canonical sources, null for mid', () => {
    expect(fromDomeBinding('level')).toBe('db')
    expect(fromDomeBinding('bass')).toBe('low-freq')
    expect(fromDomeBinding('treble')).toBe('high-freq')
    expect(fromDomeBinding('spectrum')).toBe('freq-band')
    expect(fromDomeBinding('bpm')).toBe('bpm')
    expect(fromDomeBinding('beat')).toBe('snap-hold')
    expect(fromDomeBinding('mid')).toBeNull()
  })

  test('select list carries a custom fallback only when unmapped', () => {
    const bassOpts = selectOptionsFor('bass')
    expect(bassOpts).toHaveLength(12)
    expect(selectedOptionValue('bass')).toBe('low-freq')
    const midOpts = selectOptionsFor('mid')
    expect(midOpts).toHaveLength(13)
    expect(midOpts[12]).toMatchObject({ value: 'raw:mid' })
    expect(selectedOptionValue('mid')).toBe('raw:mid')
  })
})
