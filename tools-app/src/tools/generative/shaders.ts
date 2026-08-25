import type { ToolDef } from '../../core/types'

// Shaders: GPU fbm nebula rendered by the compositor pre-pass (spec §6).
// CPU/no-GL fallback paints an intentional dark speckle field so the layer still composites.
export const shadersTool: ToolDef = {
  id: 'shaders',
  kind: 'generative',
  version: '1.0.0',
  label: 'Shaders',
  icon: 'aperture',
  category: 'Generative',
  defaultParams: { palette: 'magma', scale: 4, speed: 1 },
  controls: [
    { param: 'palette', label: 'Palette', kind: 'select', options: ['magma', 'ice', 'toxic'] },
    { param: 'scale', label: 'Scale', kind: 'slider', min: 1, max: 12, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 3, step: 0.1 },
  ],
  render(ctx, frame, _item, _audio, stack) {
    let seed = Math.floor(frame.timeSec * 2) & 0x7fffffff
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    ctx.save()
    ctx.fillStyle = '#07070a'
    ctx.fillRect(0, 0, stack.width, stack.height)
    for (let i = 0; i < 140; i++) {
      const x = rand() * stack.width
      const y = rand() * stack.height
      const s = 1 + rand() * 2
      const r = 120 + ((rand() * 100) | 0)
      const g = 80 + ((rand() * 60) | 0)
      const b = 180 + ((rand() * 70) | 0)
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.25 + rand() * 0.4).toFixed(2)})`
      ctx.fillRect(x, y, s, s)
    }
    ctx.restore()
  },
}
