import type { ToolDef } from '../../core/types'
import { readSrc, lumAt } from './filterUtils'

export const typeShapeTool: ToolDef = {
  id: 'typeShape',
  kind: 'filter',
  version: '1.0.0',
  label: 'Type Shape',
  icon: '🔤',
  category: 'Filters',
  defaultParams: { glyph: '#', size: 12, fg: '#ffffff', bg: '#0a0a0f' },
  controls: [
    { param: 'glyph', label: 'Glyph', kind: 'text' },
    { param: 'size', label: 'Glyph Size', kind: 'slider', min: 6, max: 48, step: 1 },
    { param: 'fg', label: 'Ink', kind: 'color' },
    { param: 'bg', label: 'Background', kind: 'color' },
  ],
  render(ctx, _frame, item, _audio, stack) {
    const w = stack.width
    const h = stack.height
    const src = readSrc(ctx, w, h)
    if (!src) return
    const glyph = String(item.params.glyph ?? '#')
    const size = Math.max(4, Number(item.params.size ?? 12))
    const fg = String(item.params.fg ?? '#ffffff')
    const bg = String(item.params.bg ?? '#0a0a0f')
    const d = src.data
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    ctx.font = `${size}px monospace`
    ctx.textBaseline = 'top'
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const lum = lumAt(d, (x + size / 2) | 0, (y + size / 2) | 0, w, h)
        if (lum < 0.25) continue
        ctx.globalAlpha = lum
        ctx.fillText(glyph, x, y)
      }
    }
    ctx.globalAlpha = 1
  },
}
