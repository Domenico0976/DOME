import type { ToolDef } from '../../core/types'

export const starfieldTool: ToolDef = {
  id: 'starfield',
  kind: 'generative',
  version: '1.0.0',
  label: 'Starfield',
  icon: '🌟',
  category: 'Generative',
  defaultParams: { count: 120, hue: 200 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 30, max: 400, step: 1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const { width, height } = stack
    const count = Number(item.params.count ?? 120)
    const hue = Number(item.params.hue ?? 200)
    const t = frame.timeSec
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996
      const seed = ((i * 97) % 100) / 100
      const z = (seed + t * 0.3) % 1
      const r = z * Math.max(width, height) * 0.6
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      const s = (1 - z) * 3 + 0.5
      ctx.fillStyle = `hsla(${hue}, 80%, ${70 - z * 40}%, ${1 - z})`
      ctx.fillRect(x, y, s, s)
    }
    ctx.restore()
  },
}
