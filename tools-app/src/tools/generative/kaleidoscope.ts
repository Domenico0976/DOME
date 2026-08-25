import type { ToolDef } from '../../core/types'

export const kaleidoscopeTool: ToolDef = {
  id: 'kaleidoscope',
  kind: 'generative',
  version: '1.0.0',
  label: 'Kaleidoscope',
  icon: 'hexagon',
  category: 'Generative',
  defaultParams: { wedges: 6, hue: 320 },
  controls: [
    { param: 'wedges', label: 'Wedges', kind: 'slider', min: 2, max: 12, step: 1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const { width, height } = stack
    const wedges = Number(item.params.wedges ?? 6)
    const hue = Number(item.params.hue ?? 320)
    const t = frame.timeSec
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.globalCompositeOperation = 'lighter'
    for (let w = 0; w < wedges; w++) {
      ctx.save()
      ctx.rotate((w / wedges) * Math.PI * 2 + Math.sin(t * 0.2) * 0.1)
      ctx.scale(w % 2 ? -1 : 1, 1)
      for (let i = 0; i < 5; i++) {
        const r = 20 + i * 30 + Math.sin(t + i) * 10
        ctx.strokeStyle = `hsla(${(hue + i * 50 + t * 40) % 360}, 80%, 60%, 0.6)`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI / 3)
        ctx.stroke()
      }
      ctx.restore()
    }
    ctx.restore()
  },
}
