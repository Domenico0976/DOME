// src/audio/presetCreator.ts — T6: mega-menu pick creates a binding directly
// (grid-first: the grid IS the interface, no creation form).
// Defaults: reactive source dB→level, linear curve, full amount.
// One modulation per parameter (store replaces on same param); a driver change
// is reported so the caller can warn.
import type { AudioBinding } from '../core/types'

export type MegaPick = {
  binding: AudioBinding
  /** True when an existing binding with a different source was replaced. */
  replaced: boolean
}

export function megaPickBinding(
  existing: AudioBinding | undefined,
  param: string,
): MegaPick {
  return {
    binding: { param, source: 'level', curve: 'linear', amount: 1 },
    replaced: !!existing && existing.source !== 'level',
  }
}
