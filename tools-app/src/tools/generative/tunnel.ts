import type { ToolDef } from '../../core/types'

export const tunnelTool: ToolDef = {
  id: 'tunnel',
  kind: 'generative',
  version: '1.0.0',
  label: 'Tunnel',
  icon: '🕳',
  category: 'Generative',
  defaultParams: { speed: 1, hue: 280 },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 4, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const { width, height } = stack
    const speed = Number(item.params.speed ?? 1)
    const hue = Number(item.params.hue ?? 280)
    const t = frame.timeSec * speed
    const base = Math.min(width, height)
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.globalCompositeOperation = 'lighter'
    const n = 24
    for (let i = 0; i < n; i++) {
      const z = ((i + (t * 2) % n) % n) / n
      const s = Math.max(2, base * z)
      ctx.strokeStyle = `hsla(${(hue + i * 8) % 360}, 80%, ${30 + z * 40}%, ${1 - z})`
      ctx.lineWidth = 2
      ctx.rotate(0.02)
      ctx.strokeRect(-s / 2, -s / 2, s, s)
    }
    ctx.restore()
  },
}
