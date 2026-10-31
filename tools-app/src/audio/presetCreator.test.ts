// src/audio/presetCreator.test.ts — T6: direct creation defaults + replace signal.
import { describe, expect, test } from 'vitest'
import { megaPickBinding } from './presetCreator'

describe('megaPickBinding', () => {
  test('creates a level/linear/full binding for a fresh param', () => {
    expect(megaPickBinding(undefined, 'speed')).toEqual({
      binding: { param: 'speed', source: 'level', curve: 'linear', amount: 1 },
      replaced: false,
    })
  })

  test('same-source re-pick is not a replacement', () => {
    const existing = { param: 'speed', source: 'level' as const, curve: 'linear' as const, amount: 0.5 }
    const { replaced } = megaPickBinding(existing, 'speed')
    expect(replaced).toBe(false)
  })

  test('driver change signals replacement for the warning toast', () => {
    const existing = { param: 'speed', source: 'bass' as const, curve: 'linear' as const, amount: 1 }
    const { binding, replaced } = megaPickBinding(existing, 'speed')
    expect(replaced).toBe(true)
    expect(binding.source).toBe('level')
  })
})
