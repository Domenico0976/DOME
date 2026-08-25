import type { ToolDef } from '../../core/types'

export const solidColorTool: ToolDef = {
  id: 'solidColor',
  kind: 'input',
  version: '1.0.0',
  label: 'Solid Color',
  icon: '🟦',
  category: 'Inputs',
  defaultParams: { color: '#101018' },
  controls: [{ param: 'color', label: 'Color', kind: 'color' }],
  render(ctx, _frame, item, _audio, stack) {
    ctx.fillStyle = String(item.params.color ?? '#101018')
    ctx.fillRect(0, 0, stack.width, stack.height)
  },
}
