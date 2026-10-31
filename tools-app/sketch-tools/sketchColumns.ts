// Sketch columns → DOME bindings.
// The editor grid row (Duration · Presets · ReactTo · Sensitivity · ValueRange ·
// Frequency · Timeline) is exactly one audio-reactive mapping. DOME's equivalent
// is AudioBinding {param, source, band, curve, amount, range} (+ mute via
// audio.disabledAudioBindings key "<itemUid>-<param>", AGENTS §10.4/§10.9).
// This module converts rows both ways with zero imports from src (standalone).

import type { ReactToSource, SketchRow } from './sketchTypes'

export type DomeCurve = 'linear' | 'invert'

/** Minimal structural mirror of DOME AudioBinding (no src import). */
export type DomeAudioBinding = {
  param: string
  source: 'bass' | 'mid' | 'treble' | 'level' | 'spectrum' | 'bpm'
  band?: number
  curve: DomeCurve
  amount: number
  range?: { min: number; max: number }
}

/** 'window' (whole mix) maps to DOME 'level'. */
export function reactToToSource(reactTo: ReactToSource): DomeAudioBinding['source'] {
  return reactTo === 'window' ? 'level' : reactTo
}

export function sketchRowToBinding(row: SketchRow): DomeAudioBinding {
  return {
    param: row.param,
    source: reactToToSource(row.reactTo),
    ...(row.reactTo === 'spectrum' ? { band: row.band ?? 0 } : {}),
    curve: 'linear',
    amount: row.sensitivity,
    range: { min: row.valueRange.min, max: row.valueRange.max },
  }
}

export function bindingToSketchRow(
  itemUid: string,
  binding: DomeAudioBinding,
  id: string,
): SketchRow {
  return {
    id,
    itemUid,
    param: binding.param,
    reactTo: binding.source === 'level' ? 'window' : binding.source,
    sensitivity: binding.amount,
    valueRange: { min: binding.range?.min ?? 0, max: binding.range?.max ?? 1 },
    ...(binding.source === 'spectrum' ? { band: binding.band ?? 0 } : {}),
    muted: false,
  }
}

/** Mute key, same convention as DOME: "<itemUid>-<param>". */
export function sketchMuteKey(itemUid: string, param: string): string {
  return `${itemUid}-${param}`
}

/** Sensitivity clamp (Sketch gear slider behaves like DOME amount, 0–2). */
export function clampSensitivity(v: number): number {
  return Math.max(0, Math.min(2, v))
}
