// Kaleidoscope: Canvas2D only — the core rendering is drawImage-based image
// transformation (reflection/mirror into wedge clips), not per-pixel shader work.
// GPU migration would require readback of the source canvas into a texture each
// frame plus a custom quad-rendering pipeline for zero net performance gain.
import type { ToolDef } from '../../core/types'

export const kaleidoscopeTool: ToolDef = {
  id: 'kaleidoscope',
  kind: 'generative',
  version: '3.0.0',
  label: 'Kaleidoscope',
  icon: 'hexagon',
  category: 'Generative',
  defaultParams: { wedges: 6, hue: 320, speed: 1 },
  controls: [
    { param: 'wedges', label: 'Wedges', kind: 'slider', min: 2, max: 12, step: 1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
  ],
  render(ctx, frame, item, audio, stack) {
    const { width, height } = stack
    const wedges = Number(item.params.wedges ?? 6)
    const speed = Number(item.params.speed ?? 1)
    const t = frame.timeSec * speed * (1.0 + audio.level * 0.3)

    // Capture the current canvas content as the source for reflection
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = width
    sourceCanvas.height = height
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) return
    sourceCtx.drawImage(ctx.canvas, 0, 0)

    const wedgeAngle = (Math.PI * 2) / wedges
    const maxRadius = Math.sqrt(width * width + height * height) / 2

    ctx.save()
    ctx.translate(width / 2, height / 2)

    for (let w = 0; w < wedges; w++) {
      ctx.save()
      ctx.rotate(w * wedgeAngle + Math.sin(t * 0.2) * 0.1)

      // Create wedge-shaped clip region centered on the rotated x-axis
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, maxRadius, -wedgeAngle / 2, wedgeAngle / 2)
      ctx.closePath()
      ctx.clip()

      // Mirror alternating wedges across the wedge centerline
      if (w % 2 === 1) {
        ctx.scale(1, -1)
      }

      // Draw the source content reflected into this wedge
      ctx.drawImage(sourceCanvas, -width / 2, -height / 2)

      ctx.restore()
    }

    ctx.restore()
  },
}
