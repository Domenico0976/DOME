// src/audio/reactToOptions.ts — the 12-option "React to" dropdown
// (option catalog with `db` default), mapped onto DOME AudioBinding sources.
// Pure module: the panel stays dumb, everything testable.
// Mapping: db→level, low-freq/kick→bass, snare→mid,
// high-freq/hihat→treble, freq-band/harmony→spectrum (keep band),
// bpm→bpm, snap-hold→beat, stem→level, automation→unsupported (no lane UI yet).
import type { AudioBinding } from '../core/types'

export type ReactToId =
  | 'db'
  | 'high-freq'
  | 'low-freq'
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'freq-band'
  | 'bpm'
  | 'snap-hold'
  | 'automation'
  | 'stem'
  | 'harmony'

export type ReactToOption = {
  readonly id: ReactToId
  readonly label: string
  readonly description: string
  readonly disabled?: boolean
}

export const REACT_TO_OPTIONS: readonly ReactToOption[] = [
  { id: 'db', label: 'dB', description: 'Overall loudness' },
  { id: 'high-freq', label: 'High freq', description: 'Above 500 Hz – treble, presence' },
  { id: 'low-freq', label: 'Low freq', description: 'Below 500 Hz – bass, kick, sub' },
  { id: 'kick', label: 'Kick', description: 'Onset detection – 60–100 Hz transients' },
  { id: 'snare', label: 'Snare', description: 'Onset detection – 200 Hz + 3 kHz transients' },
  { id: 'hihat', label: 'Hi-hats', description: 'Onset detection – 10–16 kHz transients' },
  { id: 'freq-band', label: 'Frequency', description: 'Custom Hz range' },
  { id: 'bpm', label: 'BPM', description: 'Pulses to the track tempo' },
  { id: 'snap-hold', label: 'Snap & Hold', description: 'Random jump on trigger, holds until the next' },
  { id: 'automation', label: 'Automation', description: 'Draw your own automation curve', disabled: true },
  { id: 'stem', label: 'Stem', description: 'Reacts to one stem, split from the track or uploaded' },
  { id: 'harmony', label: 'Harmony', description: 'Different notes move different elements' },
] as const

export const DEFAULT_REACT_TO: ReactToId = 'db'

export type DomeDriver = {
  source: AudioBinding['source']
  band?: number
}

/** Catalog option → DOME binding fragment. Null = unsupported (automation, unknown). */
export function toDomeBinding(optionId: string, keepBand = 0): DomeDriver | null {
  switch (optionId) {
    case 'db':
    case 'stem':
      return { source: 'level' }
    case 'low-freq':
    case 'kick':
      return { source: 'bass' }
    case 'snare':
      return { source: 'mid' }
    case 'high-freq':
    case 'hihat':
      return { source: 'treble' }
    case 'freq-band':
    case 'harmony':
      return { source: 'spectrum', band: keepBand }
    case 'bpm':
      return { source: 'bpm' }
    case 'snap-hold':
      return { source: 'beat' }
    default:
      return null
  }
}

/** DOME source → canonical catalog option. Null when no counterpart (mid). */
export function fromDomeBinding(source: AudioBinding['source']): ReactToId | null {
  switch (source) {
    case 'level':
      return 'db'
    case 'bass':
      return 'low-freq'
    case 'treble':
      return 'high-freq'
    case 'spectrum':
      return 'freq-band'
    case 'bpm':
      return 'bpm'
    case 'beat':
      return 'snap-hold'
    default:
      return null
  }
}

export type SelectOption = {
  readonly value: string
  readonly label: string
  readonly title: string
  readonly disabled?: boolean
}

/** Full select list: 12 catalog options + a `(custom)` fallback for unmapped sources. */
export function selectOptionsFor(source: AudioBinding['source']): SelectOption[] {
  const options: SelectOption[] = REACT_TO_OPTIONS.map((o) => ({
    value: o.id,
    label: o.label,
    title: o.description,
    disabled: o.disabled,
  }))
  if (fromDomeBinding(source) === null) {
  options.push({
    value: `raw:${source}`,
    label: `${source} (custom)`,
    title: 'Kept from the existing binding; pick a react-to source to remap',
  })
  }
  return options
}

/** Selected value for the current binding (option id or custom fallback). */
export function selectedOptionValue(source: AudioBinding['source']): string {
  return fromDomeBinding(source) ?? `raw:${source}`
}
