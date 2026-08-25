import type { ToolDef } from '../../core/types'

const FONTS: Record<string, string> = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
}

export const textTool: ToolDef = {
  id: 'text',
  kind: 'input',
  version: '1.0.0',
  label: 'Text',
  icon: '🆃',
  category: 'Inputs',
  defaultParams: { text: 'DOME', font: 'sans', size: 64, color: '#ffffff', align: 'center' },
  controls: [
    { param: 'text', label: 'Text', kind: 'text' },
    { param: 'font', label: 'Font', kind: 'select', options: ['sans', 'serif', 'mono'] },
    { param: 'size', label: 'Size', kind: 'slider', min: 8, max: 200, step: 1 },
    { param: 'color', label: 'Color', kind: 'color' },
    { param: 'align', label: 'Align', kind: 'select', options: ['left', 'center', 'right'] },
  ],
  render(ctx, _frame, item, _audio, stack) {
    const { width, height } = stack
    const text = String(item.params.text ?? '')
    const size = Number(item.params.size ?? 64)
    const color = String(item.params.color ?? '#ffffff')
    const align = String(item.params.align ?? 'center')
    const font = FONTS[String(item.params.font ?? 'sans')] ?? FONTS.sans
    ctx.fillStyle = color
    ctx.font = `${size}px ${font}`
    ctx.textAlign = align as CanvasTextAlign
    ctx.textBaseline = 'middle'
    const x = align === 'left' ? 0 : align === 'right' ? width : width / 2
    ctx.fillText(text, x, height / 2)
  },
}
