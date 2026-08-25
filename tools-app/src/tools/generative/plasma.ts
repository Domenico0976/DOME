import type { ToolDef } from '../../core/types'

export const plasmaTool: ToolDef = {
  id: 'plasma',
  kind: 'generative',
  version: '1.0.0',
  label: 'Plasma',
  icon: '🌐',
  category: 'Generative',
  defaultParams: { scale: 1, hue: 260 },
  controls: [
    { param: 'scale', label: 'Scale', kind: 'slider', min: 0.3, max: 3, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const { width, height } = stack
    const scale = Number(item.params.scale ?? 1)
    const hue = Number(item.params.hue ?? 260)
    const t = frame.timeSec
    const step = 14
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const v =
          Math.sin(x * 0.02 * scale + t) +
          Math.sin(y * 0.02 * scale + t * 1.3) +
          Math.sin((x + y) * 0.015 * scale + t * 0.7)
        const h = (v * 40 + t * 30 + hue) % 360
        ctx.fillStyle = `hsla(${h}, 80%, 55%, 0.25)`
        ctx.fillRect(x, y, step, step)
      }
    }
    ctx.restore()
  },
}
