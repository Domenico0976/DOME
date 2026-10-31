// tools-app/src/tools/scopes/waveform.ts
// Time-domain audio visualizer as a DOME generative ToolDef.
// Pure 2D canvas over AudioFrame: bars | line | mirror of the normalized spectrum,
// gained by `amplitude` (bindable via item.audio) and pulsed by audio.level.
// Deterministic: no randomness, no-throw on empty spectrum (flat mid line).
import { ToolDef } from '../../core/types'

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export const waveformTool: ToolDef = {
  id: 'waveform',
  kind: 'generative',
  version: '1.0.0',
  label: 'Waveform',
  icon: 'audio-waveform',
  category: 'Generative',
  defaultParams: {
    mode: 'bars',
    bars: 64,
    amplitude: 1.0,
    color: '#22d3ee',
    bgColor: '#000000',
  },
  controls: [
    { param: 'mode', label: 'Mode', kind: 'select', options: ['bars', 'line', 'mirror'] },
    { param: 'bars', label: 'Bars', kind: 'slider', min: 8, max: 256, step: 1 },
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
    const bars = Math.max(1, Math.floor(Number(p.bars ?? 64)))
    const gain = Number(p.amplitude ?? 1.0) * (1 + audio.level * 0.5)
    const spec = audio.spectrum
    const n = Math.min(bars, spec.length > 0 ? spec.length : bars)
    const midY = h / 2

    ctx.fillStyle = String(p.color ?? '#22d3ee')
    ctx.strokeStyle = String(p.color ?? '#22d3ee')
    ctx.lineWidth = Math.max(1, w / 480)

    const valueAt = (i: number): number => {
      const v = spec.length > 0 ? spec[Math.floor((i / n) * spec.length)] ?? 0 : 0
      return clamp01(v * gain)
    }

    if (mode === 'line') {
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = (i / Math.max(1, n - 1)) * w
        const y = midY - (valueAt(i) - 0.15) * h * 0.9
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      return
    }

    const bw = w / n
    for (let i = 0; i < n; i++) {
      const v = valueAt(i)
      if (mode === 'mirror') {
        const bh = v * midY
        ctx.fillRect(i * bw, midY - bh, Math.max(1, bw - 1), bh * 2)
      } else {
        const bh = v * h
        ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 1), bh)
      }
    }
  },
}
