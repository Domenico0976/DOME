import type { ToolDef } from '../../core/types'

export const ferrofluidTool: ToolDef = {
  id: 'ferrofluid',
  kind: 'generative',
  version: '1.0.0',
  label: 'Ferrofluid',
  icon: '🟣',
  category: 'Generative',
  defaultParams: { blobs: 5, intensity: 1, hue: 280 },
  controls: [
    { param: 'blobs', label: 'Blobs', kind: 'slider', min: 2, max: 10, step: 1 },
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0.2, max: 3, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, audio, stack) {
    const { width, height } = stack
    const blobs = Number(item.params.blobs ?? 5)
    const intensity = Number(item.params.intensity ?? 1)
    const hue = Number(item.params.hue ?? 280)
    const t = frame.timeSec
    const base = Math.min(width, height)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < blobs; i++) {
      const ph = (i / blobs) * Math.PI * 2
      const x = width / 2 + Math.cos(ph + t * 0.3) * width * 0.2
      const y = height / 2 + Math.sin(ph * 1.7 + t * 0.25) * height * 0.2
      const rad = base * 0.12 * (1 + audio.bass * 1.5) * intensity
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, `hsla(${hue}, 80%, 55%, 0.9)`)
      g.addColorStop(1, `hsla(${hue}, 80%, 55%, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  },
}
