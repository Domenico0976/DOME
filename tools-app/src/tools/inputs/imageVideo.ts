import type { ToolDef } from '../../core/types'

const images = new Map<string, HTMLImageElement>()

function getImage(src: string): HTMLImageElement {
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    images.set(src, img)
  }
  return img
}

export const imageVideoTool: ToolDef = {
  id: 'imageVideo',
  kind: 'input',
  version: '1.0.0',
  label: 'Image / Video',
  icon: 'image',
  category: 'Inputs',
  defaultParams: { src: '', mode: 'cover' },
  controls: [
    { param: 'src', label: 'Source URL', kind: 'text' },
    { param: 'mode', label: 'Fit', kind: 'select', options: ['cover', 'contain'] },
  ],
  render(ctx, _frame, item, _audio, stack) {
    const { width, height } = stack
    const src = String(item.params.src ?? '')
    if (!src) {
      ctx.fillStyle = '#15151a'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#7a7a86'
      ctx.font = '16px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Image / Video — drop a URL', width / 2, height / 2)
      return
    }
    const img = getImage(src)
    if (!img.complete || img.naturalWidth === 0) return
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const scale = String(item.params.mode ?? 'cover') === 'cover'
      ? Math.max(width / iw, height / ih)
      : Math.min(width / iw, height / ih)
    const dw = iw * scale
    const dh = ih * scale
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh)
  },
}
