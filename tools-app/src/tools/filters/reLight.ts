import type { ToolDef } from '../../core/types'
import { readSrc, makeOut } from './filterUtils'

export const reLightTool: ToolDef = {
  id: 'reLight',
  kind: 'filter',
  version: '1.0.0',
  label: 'Re-Light',
  icon: '💡',
  category: 'Filters',
  defaultParams: { brightness: 0, contrast: 0 },
  controls: [
    { param: 'brightness', label: 'Brightness', kind: 'slider', min: -100, max: 100, step: 1 },
    { param: 'contrast', label: 'Contrast', kind: 'slider', min: -100, max: 100, step: 1 },
  ],
  render(ctx, _frame, item, _audio, stack) {
    const w = stack.width
    const h = stack.height
    const src = readSrc(ctx, w, h)
    if (!src) return
    const out = makeOut(ctx, w, h)
    if (!out) return
    const brightness = Number(item.params.brightness ?? 0)
    const contrast = Number(item.params.contrast ?? 0)
    const c = (259 * (contrast + 255)) / (255 * (259 - contrast))
    const d = src.data
    const o = out.data
    for (let i = 0; i < d.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        const v = c * (d[i + k] - 128) + 128 + brightness
        o[i + k] = Math.max(0, Math.min(255, v))
      }
      o[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
  },
}
