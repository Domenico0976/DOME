import type { ToolDef } from '../../core/types'

export const ringsTool: ToolDef = {
  id: 'rings',
  kind: 'generative',
  version: '1.0.0',
  label: 'Rings',
  icon: '💠',
  category: 'Generative',
  defaultParams: { count: 8, hue: 200 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 2, max: 16, step: 1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const { width, height } = stack
    const count = Number(item.params.count ?? 8)
    const hue = Number(item.params.hue ?? 200)
    const t = frame.timeSec
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < count; i++) {
      const phase = (t * 0.6 + i / count) % 1
      const r = phase * Math.min(width, height) * 0.5
      ctx.strokeStyle = `hsla(${(hue + i * 40 + t * 30) % 360}, 80%, 60%, ${1 - phase})`
      ctx.lineWidth = 3 * (1 - phase) + 1
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  },
}
