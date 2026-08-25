import type { ToolDef } from '../../core/types'
import { readSrc, makeOut } from './filterUtils'

export const pixelatorTool: ToolDef = {
  id: 'pixelator',
  kind: 'filter',
  version: '1.0.0',
  label: 'Pixelator',
  icon: '🔲',
  category: 'Filters',
  defaultParams: { size: 12 },
  controls: [{ param: 'size', label: 'Block Size', kind: 'slider', min: 2, max: 48, step: 1 }],
  render(ctx, _frame, item, _audio, stack) {
    const w = stack.width
    const h = stack.height
    const src = readSrc(ctx, w, h)
    if (!src) return
    const out = makeOut(ctx, w, h)
    if (!out) return
    const cell = Math.max(1, Number(item.params.size ?? 12))
    const d = src.data
    const o = out.data
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        const ye = Math.min(h, y + cell)
        const xe = Math.min(w, x + cell)
        for (let yy = y; yy < ye; yy++) {
          for (let xx = x; xx < xe; xx++) {
            const i = (yy * w + xx) * 4
            r += d[i]
            g += d[i + 1]
            b += d[i + 2]
            n++
          }
        }
        r /= n
        g /= n
        b /= n
        for (let yy = y; yy < ye; yy++) {
          for (let xx = x; xx < xe; xx++) {
            const i = (yy * w + xx) * 4
            o[i] = r
            o[i + 1] = g
            o[i + 2] = b
            o[i + 3] = 255
          }
        }
      }
    }
    ctx.putImageData(out, 0, 0)
  },
}
