// Kaleidoscope: Canvas2D drawImage-based reflection engine.
// Captures the underlying canvas content and mirrors it into wedge clips
// producing stained-glass-like kaleidoscopic patterns.
import type { ToolDef } from '../../core/types'

export type MirrorMode = 'flip' | 'fold'
export type SymmetryType = 'radial' | 'linear'

export const kaleidoscopeTool: ToolDef = {
  id: 'kaleidoscope',
  kind: 'generative',
  version: '3.0.0',
  label: 'Kaleidoscope',
  icon: 'hexagon',
  category: 'Generative',
  defaultParams: {
    wedges: 6,
    hue: 0,
    speed: 1,
    color: '#ffffff',
    mirror: 'flip' as MirrorMode,
    symmetry: 'radial' as SymmetryType,
  },
  controls: [
    { param: 'wedges', label: 'Wedges', kind: 'slider', min: 2, max: 12, step: 1 },
    { param: 'hue', label: 'Hue Rotation', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'mirror', label: 'Mirror Mode', kind: 'select', options: ['flip', 'fold'] },
    { param: 'symmetry', label: 'Symmetry', kind: 'select', options: ['radial', 'linear'] },
    { param: 'color', label: 'Tint Color', kind: 'color' },
  ],
  render(ctx, frame, item, audio, stack) {
    const { width, height } = stack
    const wedges = Number(item.params.wedges ?? 6)
    const hueDeg = Number(item.params.hue ?? 0)
    const speed = Number(item.params.speed ?? 1)
    const mirror = String(item.params.mirror ?? 'flip') as MirrorMode
    const symmetry = String(item.params.symmetry ?? 'radial') as SymmetryType
    const color = String(item.params.color ?? '#ffffff')

    const audioBoost = audio.level * 0.4
    const t = frame.timeSec * speed * (1.0 + audioBoost)
    const hueShift = hueDeg + audio.level * 30

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = width
    sourceCanvas.height = height
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) return
    sourceCtx.drawImage(ctx.canvas, 0, 0)

    const wedgeAngle = (Math.PI * 2) / wedges
    const cx = width / 2
    const cy = height / 2
    const maxRadius = Math.sqrt(cx * cx + cy * cy)

    ctx.save()

    if (hueShift !== 0) {
      ctx.filter = `hue-rotate(${hueShift}deg)`
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    if (symmetry === 'radial') {
      ctx.translate(cx, cy)

      for (let w = 0; w < wedges; w++) {
        ctx.save()
        ctx.rotate(w * wedgeAngle + Math.sin(t * 0.15) * 0.05)

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, maxRadius, -wedgeAngle / 2, wedgeAngle / 2)
        ctx.closePath()
        ctx.clip()

        if (mirror === 'fold') {
          ctx.drawImage(sourceCanvas, -cx, -cy, cx, height, -cx, -height / 2, cx, height)
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(sourceCanvas, -cx, -cy, cx, height, -cx, -height / 2, cx, height)
          ctx.restore()
        } else {
          if (w % 2 === 1) {
            ctx.scale(1, -1)
          }
          ctx.drawImage(sourceCanvas, -cx, -cy)
        }

        ctx.restore()
      }
    } else {
      const wedgeWidth = width / wedges
      for (let w = 0; w < wedges; w++) {
        ctx.save()
        ctx.translate(w * wedgeWidth, 0)

        ctx.beginPath()
        ctx.rect(0, 0, wedgeWidth, height)
        ctx.clip()

        if (mirror === 'fold') {
          ctx.drawImage(sourceCanvas, 0, 0, wedgeWidth / 2, height, 0, 0, wedgeWidth / 2, height)
          ctx.save()
          ctx.translate(wedgeWidth, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(sourceCanvas, wedgeWidth / 2, 0, wedgeWidth / 2, height, 0, 0, wedgeWidth / 2, height)
          ctx.restore()
        } else {
          if (w % 2 === 1) {
            ctx.scale(-1, 1)
            ctx.drawImage(sourceCanvas, -width, 0)
          } else {
            ctx.drawImage(sourceCanvas, 0, 0)
          }
        }

        ctx.restore()
      }
    }

    ctx.restore()

    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = `rgba(${r},${g},${b},0.25)`
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}
