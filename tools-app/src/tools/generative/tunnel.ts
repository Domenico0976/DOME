import type { ToolDef } from '../../core/types'
import { drawShapePath } from '../toolUtils'

// Tunnel: concentric perspective shapes cycling toward a vanishing point (Tool-Render.md §1.3).
export const tunnelTool: ToolDef = {
  id: 'tunnel',
  kind: 'generative',
  version: '2.0.0',
  label: 'Tunnel',
  icon: 'circle-dashed',
  category: 'Generative',
  defaultParams: { rings: 40, speed: 1, hue: 280, shape: 'circle' },
  controls: [
    { param: 'rings', label: 'Rings', kind: 'slider', min: 10, max: 80, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 4, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'shape', label: 'Shape', kind: 'select', options: ['circle', 'square', 'triangle'] },
  ],
  render(ctx, frame, item, audio, stack) {
    const rings = Math.round(Number(item.params.rings ?? 40))
    const speed = Number(item.params.speed ?? 1)
    const hue = Number(item.params.hue ?? 280)
    const shape = String(item.params.shape ?? 'circle') as 'circle' | 'square' | 'triangle'
    const cx = stack.width / 2
    const cy = stack.height / 2
    const maxR = Math.min(stack.width, stack.height) * 0.72

    ctx.save()
    for (let i = 0; i < rings; i++) {
      const z = (i / rings + frame.timeSec * speed * 0.02) % 1
      const radius = (1 - z) * maxR
      ctx.strokeStyle = `hsla(${hue}, 85%, ${55 + z * 15}%, ${Math.min(1, z * 1.2)})`
      ctx.lineWidth = 1 + z * 4 * (1 + audio.bass * 0.5)
      drawShapePath(ctx, cx, cy, Math.max(0.5, radius), shape)
      ctx.stroke()
    }
    ctx.restore()
  },
}
