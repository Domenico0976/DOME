import type { ToolDef } from '../../core/types'

export const audioFileTool: ToolDef = {
  id: 'audioFile',
  kind: 'input',
  version: '1.0.0',
  label: 'Audio File',
  icon: 'music',
  category: 'Inputs',
  defaultParams: { mode: 'bars' },
  controls: [{ param: 'mode', label: 'Style', kind: 'select', options: ['bars', 'level'] }],
  render(ctx, _frame, item, audio, stack) {
    const { width, height } = stack
    if (String(item.params.mode ?? 'bars') === 'level') {
      ctx.fillStyle = '#1f6feb'
      ctx.fillRect(0, height - height * audio.level, width, height * audio.level)
      return
    }
    const bars = 32
    const spec = audio.spectrum
    const bw = width / bars
    for (let i = 0; i < bars; i++) {
      const idx = spec.length ? Math.floor((i / bars) * spec.length) : 0
      const v = spec.length ? spec[idx] ?? 0 : 0
      const h = Math.max(2, v * height)
      ctx.fillStyle = `hsl(${(i / bars) * 280}, 80%, 55%)`
      ctx.fillRect(i * bw, height - h, bw - 2, h)
    }
  },
}
