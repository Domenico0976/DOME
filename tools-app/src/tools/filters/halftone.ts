import type { ToolDef } from '../../core/types'
import { readSrc, lumAt } from './filterUtils'

export const halftoneTool: ToolDef = {
  id: 'halftone',
  kind: 'filter',
  version: '1.0.0',
  label: 'Halftone',
  icon: '⠿',
  category: 'Filters',
  defaultParams: { dot: 6, bg: '#0a0a0f', fg: '#ffffff' },
  controls: [
    { param: 'dot', label: 'Dot Size', kind: 'slider', min: 2, max: 24, step: 1 },
    { param: 'bg', label: 'Background', kind: 'color' },
    { param: 'fg', label: 'Ink', kind: 'color' },
  ],
  render(ctx, _frame, item, _audio, stack) {
    const w = stack.width
    const h = stack.height
    const src = readSrc(ctx, w, h)
    if (!src) return
    const dot = Number(item.params.dot ?? 6)
    const bg = String(item.params.bg ?? '#0a0a0f')
    const fg = String(item.params.fg ?? '#ffffff')
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')
    if (!octx) return
    octx.fillStyle = bg
    octx.fillRect(0, 0, w, h)
    octx.fillStyle = fg
    const d = src.data
    for (let y = 0; y < h; y += dot) {
      for (let x = 0; x < w; x += dot) {
        const lum = lumAt(d, (x + dot / 2) | 0, (y + dot / 2) | 0, w, h)
        const r = (dot / 2) * Math.sqrt(lum)
        octx.beginPath()
        octx.arc(x + dot / 2, y + dot / 2, r, 0, Math.PI * 2)
        octx.fill()
      }
    }
    ctx.drawImage(off, 0, 0)
  },
}
