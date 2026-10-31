// tools-app/src/tools/scopes/spectrum.ts
// Frequency-spectrum visualizer (bars, or scope polyline covering
// oscilloscope-style rendering) as a DOME generative ToolDef. Pure 2D canvas: groups AudioFrame.spectrum bins
// into `bands` buckets (linear or log spaced) and draws bars, or a scope polyline.
// Deterministic: no randomness, no-throw on empty spectrum.
import { ToolDef } from '../../core/types'

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Bucket boundaries for `bands` buckets over `bins` bins (linear or log). */
export function bucketRange(
  band: number,
  bands: number,
  bins: number,
  scale: string,
): { from: number; to: number } {
  if (scale === 'log') {
    const toBin = (t: number): number =>
      Math.floor((Math.exp(t * Math.log(bins + 1)) - 1))
    return { from: Math.min(bins, toBin(band / bands)), to: Math.min(bins, toBin((band + 1) / bands)) }
  }
  return {
    from: Math.floor((band / bands) * bins),
    to: Math.floor(((band + 1) / bands) * bins),
  }
}

export function bucketMean(spec: ArrayLike<number>, from: number, to: number): number {
  if (to <= from || spec.length === 0) return 0
  let s = 0
  const end = Math.min(to, spec.length)
  for (let i = from; i < end; i++) s += spec[i] ?? 0
  const count = Math.max(1, end - from)
  return s / count
}

export const spectrumTool: ToolDef = {
  id: 'spectrum',
  kind: 'generative',
  version: '1.0.0',
  label: 'Spectrum',
  icon: 'chart-column',
  category: 'Generative',
  defaultParams: {
    mode: 'bars',
    bands: 48,
    scale: 'log',
    amplitude: 1.0,
    color: '#a78bfa',
    bgColor: '#000000',
  },
  controls: [
    { param: 'mode', label: 'Mode', kind: 'select', options: ['bars', 'scope'] },
    { param: 'bands', label: 'Bands', kind: 'slider', min: 8, max: 128, step: 1 },
    { param: 'scale', label: 'Scale', kind: 'select', options: ['linear', 'log'] },
    { param: 'amplitude', label: 'Amplitude', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'color', label: 'Color', kind: 'color' },
    { param: 'bgColor', label: 'Background', kind: 'color' },
  ],
  render: (ctx, _frame, item, audio, _stack) => {
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    if (w <= 0 || h <= 0) return

    ctx.fillStyle = String(p.bgColor ?? '#000000')
    ctx.fillRect(0, 0, w, h)

    const mode = String(p.mode ?? 'bars')
    const scale = String(p.scale ?? 'log')
    const bands = Math.max(1, Math.floor(Number(p.bands ?? 48)))
    const gain = Number(p.amplitude ?? 1.0) * (1 + audio.level * 0.5)
    const spec = audio.spectrum

    ctx.fillStyle = String(p.color ?? '#a78bfa')
    ctx.strokeStyle = String(p.color ?? '#a78bfa')
    ctx.lineWidth = Math.max(1, w / 480)

    if (mode === 'scope') {
      const n = Math.max(2, Math.min(spec.length, 512))
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const v = spec.length > 0 ? (spec[Math.floor((i / n) * spec.length)] ?? 0) : 0
        const x = (i / (n - 1)) * w
        const y = h - clamp01(v * gain) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      return
    }

    const bw = w / bands
    for (let b = 0; b < bands; b++) {
      const { from, to } = bucketRange(b, bands, spec.length, scale)
      const v = clamp01(bucketMean(spec, from, to) * gain)
      const bh = v * h
      ctx.fillRect(b * bw, h - bh, Math.max(1, bw - 1), bh)
    }
  },
}
