import type { ToolDef } from '../../core/types'

export const flowfieldTool: ToolDef = {
  id: 'flowfield',
  kind: 'generative',
  version: '1.0.0',
  label: 'Flow Field',
  icon: '🌊',
  category: 'Generative',
  defaultParams: { hue: 180, density: 14 },
  controls: [
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'density', label: 'Density', kind: 'slider', min: 6, max: 30, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const { width, height } = stack
    const hue = Number(item.params.hue ?? 180)
    const density = Number(item.params.density ?? 14)
    const t = frame.timeSec
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineWidth = 1.5
    const cols = density
    const rows = Math.round((density * height) / width) || density
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const px = (x / cols) * width
        const py = (y / rows) * height
        const ang = Math.sin(px * 0.01 + t) * Math.cos(py * 0.01 + t * 0.7) * Math.PI
        ctx.strokeStyle = `hsla(${(hue + x * 20 + y * 10 + t * 20) % 360}, 70%, 60%, 0.5)`
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + Math.cos(ang) * 20, py + Math.sin(ang) * 20)
        ctx.stroke()
      }
    }
    ctx.restore()
  },
}
