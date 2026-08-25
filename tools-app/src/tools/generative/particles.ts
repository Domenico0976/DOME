import type { ToolDef } from '../../core/types'

export const particlesTool: ToolDef = {
  id: 'particles',
  kind: 'generative',
  version: '1.0.0',
  label: 'Particles',
  icon: '✸',
  category: 'Generative',
  defaultParams: { count: 120, size: 3, speed: 1, hue: 200 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 10, max: 400, step: 1 },
    { param: 'size', label: 'Size', kind: 'slider', min: 1, max: 12, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 4, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, audio, stack) {
    const { width, height } = stack
    const count = Number(item.params.count ?? 120)
    const size = Number(item.params.size ?? 3)
    const speed = Number(item.params.speed ?? 1)
    const hue = Number(item.params.hue ?? 200)
    const t = frame.timeSec * speed
    const base = Math.min(width, height)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < count; i++) {
      const ph = i * 2.39996
      const r = base * (0.1 + 0.35 * ((i % 7) / 7))
      const x = width / 2 + Math.cos(ph + t * (0.5 + (i % 5) / 5)) * r
      const y = height / 2 + Math.sin(ph * 1.3 + t * (0.5 + (i % 3) / 3)) * r
      const s = size * (1 + audio.level * 2)
      ctx.fillStyle = `hsla(${(hue + i) % 360}, 80%, 60%, 0.8)`
      ctx.beginPath()
      ctx.arc(x, y, s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  },
}
