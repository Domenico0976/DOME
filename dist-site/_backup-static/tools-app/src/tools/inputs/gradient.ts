import type { ToolDef } from '../../core/types'

export const gradientTool: ToolDef = {
  id: 'gradient',
  kind: 'input',
  version: '1.0.0',
  label: 'Gradient',
  icon: 'palette',
  category: 'Inputs',
  defaultParams: { colorA: '#0b1026', colorB: '#6b21a8', angle: 45 },
  controls: [
    { param: 'colorA', label: 'From', kind: 'color' },
    { param: 'colorB', label: 'To', kind: 'color' },
    { param: 'angle', label: 'Angle', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, _frame, item, _audio, stack) {
    const { width, height } = stack
    const ang = (Number(item.params.angle ?? 45) * Math.PI) / 180
    const x = Math.cos(ang)
    const y = Math.sin(ang)
    const cx = width / 2
    const cy = height / 2
    const len = (Math.abs(x * width) + Math.abs(y * height)) / 2
    const g = ctx.createLinearGradient(cx - x * len, cy - y * len, cx + x * len, cy + y * len)
    g.addColorStop(0, String(item.params.colorA ?? '#0b1026'))
    g.addColorStop(1, String(item.params.colorB ?? '#6b21a8'))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  },
}
