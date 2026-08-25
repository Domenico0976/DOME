import type { ToolDef } from '../../core/types'
import { readSrc, makeOut, thermal } from './filterUtils'

export const thermalTool: ToolDef = {
  id: 'thermal',
  kind: 'filter',
  version: '1.0.0',
  label: 'Thermal',
  icon: '🌡',
  category: 'Filters',
  defaultParams: {},
  controls: [],
  render(ctx, _frame, _item, _audio, stack) {
    const w = stack.width
    const h = stack.height
    const src = readSrc(ctx, w, h)
    if (!src) return
    const out = makeOut(ctx, w, h)
    if (!out) return
    const d = src.data
    const o = out.data
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
      const [r, g, b] = thermal(l)
      o[i] = r
      o[i + 1] = g
      o[i + 2] = b
      o[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
  },
}
