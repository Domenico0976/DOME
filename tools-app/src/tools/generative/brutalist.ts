import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { drawShapePath, strHash } from '../toolUtils'

// Brutalist: pure geometric B/W grid (Tool-Render.md §1.9).
// Per-cell interactive menu (Expand/Rotate/Swap/Shrink) arrives in Phase 3 per spec §11.
export const brutalistTool: ToolDef = {
  id: 'brutalist',
  kind: 'generative',
  version: '1.0.0',
  label: 'Brutalist',
  icon: 'grid3x3',
  category: 'Generative',
  defaultParams: { cols: 8, mix: 0.5 },
  controls: [
    { param: 'cols', label: 'Columns', kind: 'slider', min: 3, max: 20, step: 1 },
    { param: 'mix', label: 'Mix', kind: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const cols = Math.round(Number(item.params.cols ?? 8))
    const mix = Number(item.params.mix ?? 0.5)
    const cell = Math.min(stack.width, stack.height) / cols
    const rows = Math.ceil(stack.height / cell)
    // Fresh PRNG each frame replays the identical sequence -> stable grid layout.
    const rng = mulberry32(strHash(`${item.uid}:static`))
    const shapes = ['square', 'circle', 'triangle'] as const
    const t = frame.timeSec

    ctx.save()
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const pick = shapes[Math.floor(rng() * 3)]
        const rot = Math.floor(rng() * 4) * (Math.PI / 2)
        const white = rng() < mix
        const cx = c * cell + cell / 2
        const cy = r * cell + cell / 2
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot + (white ? 0 : Math.sin(t * 0.3 + r + c) * 0.05))
        const s = cell * 0.34
        if (white) {
          ctx.fillStyle = '#f5f5f5'
          drawShapePath(ctx, 0, 0, s, pick)
          ctx.fill()
        } else {
          ctx.strokeStyle = '#101012'
          ctx.lineWidth = Math.max(1, cell * 0.06)
          drawShapePath(ctx, 0, 0, s, pick)
          ctx.stroke()
        }
        ctx.restore()
      }
    ctx.restore()
  },
}
