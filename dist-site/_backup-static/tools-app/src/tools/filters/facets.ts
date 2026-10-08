import type { ToolDef } from '../../core/types'
import { readSrc, makeOut } from './filterUtils'

export const facetsTool: ToolDef = {
  id: 'facets',
  kind: 'filter',
  version: '1.0.0',
  label: 'Facets',
  icon: 'triangle',
  category: 'Filters',
  defaultParams: { size: 16 },
  controls: [{ param: 'size', label: 'Facet Size', kind: 'slider', min: 4, max: 64, step: 1 }],
  render(ctx, _frame, item, _audio, stack) {
    const w = stack.width
    const h = stack.height
    const src = readSrc(ctx, w, h)
    if (!src) return
    const out = makeOut(ctx, w, h)
    if (!out) return
    const cell = Math.max(2, Number(item.params.size ?? 16))
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
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x += cell) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += cell) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
  },
}
