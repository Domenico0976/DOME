import type { AudioBinding, StackItem } from './types'

function sampleSpectrum(spectrum: Float32Array, band?: number): number {
  if (!spectrum || spectrum.length === 0) return 0
  if (band === undefined) {
    let sum = 0
    for (let i = 0; i < spectrum.length; i++) sum += spectrum[i]
    return sum / spectrum.length
  }
  const idx = Math.max(0, Math.min(spectrum.length - 1, Math.round(band)))
  return spectrum[idx]
}

function applyCurve(value: number, curve: 'linear' | 'invert', amount: number): number {
  const scaled = curve === 'invert' ? 1 - value : value
  return value + (scaled - value) * amount
}

function evalKeyframes(keys: { timeSec: number; value: number; easing: 'linear' | 'ease' }[], timeSec: number): number {
  if (keys.length === 0) return 0
  if (timeSec <= keys[0].timeSec) return keys[0].value
  if (timeSec >= keys[keys.length - 1].timeSec) return keys[keys.length - 1].value
  for (let i = 1; i < keys.length; i++) {
    if (timeSec <= keys[i].timeSec) {
      const a = keys[i - 1]
      const b = keys[i]
      const t = (timeSec - a.timeSec) / (b.timeSec - a.timeSec || 1)
      const e = b.easing === 'ease' ? t * t * (3 - 2 * t) : t
      return a.value + (b.value - a.value) * e
    }
  }
  return keys[keys.length - 1].value
}

/**
 * resolveParam: priority = keyframe automation > audio/BPM binding > static param.
 * Returns a number or string (strings pass through untouched).
 */
export function resolveParam(
  item: StackItem,
  param: string,
  audio: { bass: number; mid: number; treble: number; level: number; spectrum: Float32Array; bpm: number },
  timeSec: number,
): number | string {
  const base = item.params[param]
  const auto = item.automations.find((a) => a.param === param)
  if (auto) return evalKeyframes(auto.keyframes, timeSec)

  const bind = item.audio.find((b) => b.param === param) as AudioBinding | undefined
  if (bind) {
    const raw =
      bind.source === 'bpm'
        ? audio.bpm / 200
        : bind.source === 'spectrum'
          ? sampleSpectrum(audio.spectrum, bind.band)
          : bind.source === 'bass'
            ? audio.bass
            : bind.source === 'mid'
              ? audio.mid
              : bind.source === 'treble'
                ? audio.treble
                : audio.level
    const mod = applyCurve(raw, bind.curve, bind.amount)
    return typeof base === 'number' ? base * (1 + mod * 2 - 1) : mod
  }

  return base ?? 0
}
