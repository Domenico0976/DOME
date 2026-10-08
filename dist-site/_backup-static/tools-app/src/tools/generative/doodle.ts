// Doodle: Interactive Canvas2D drawing tool.
// Users draw quadratic bezier strokes with the mouse, place shapes, erase.
// Strokes are stored in module-level refs (not React state) for performance across frames.
// Audio reactivity: treble modulates per-stroke glow brightness.
import type { ToolDef } from '../../core/types'

// ── Types ────────────────────────────────────────────────────────────────────

type Stroke = {
  points: Float32Array
  type: string
  width: number
  color: string
}

// ── Module-level ref-based storage (no React state) ──────────────────────────

const strokesByUid = new Map<string, Stroke[]>()
const pendingByUid = new Map<string, Stroke>()

// Global drawing UI state — synced from params each frame
let currentMode = 'freehand' as string
let currentShape = 'circle' as string
let cursorX = 0
let cursorY = 0
let isDrawing = false
let canvasEl: HTMLCanvasElement | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

function addPoint(pts: Float32Array, cx: number, cy: number, capacity: number): void {
  const len = pts.length
  if (len >= capacity * 2) return
  pts[len] = cx
  pts[len + 1] = cy
}

function buildCircle(cx: number, cy: number, radius: number, cap: number): Float32Array {
  const buf = new Float32Array(cap * 2)
  const steps = Math.max(8, Math.min(32, Math.round(radius * 0.15)))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    addPoint(buf, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cap)
  }
  return buf
}

function buildRect(cx: number, cy: number, w: number, h: number, cap: number): Float32Array {
  const buf = new Float32Array(cap * 2)
  const x0 = cx - w / 2, y0 = cy - h / 2
  const segs = 6
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    addPoint(buf, x0 + w * t, y0, cap)
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    addPoint(buf, x0 + w, y0 + h * t, cap)
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    addPoint(buf, x0 + w * (1 - t), y0 + h, cap)
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    addPoint(buf, x0, y0 + h * (1 - t), cap)
  }
  return buf
}

function buildLine(x0: number, y0: number, x1: number, y1: number, cap: number): Float32Array {
  const buf = new Float32Array(cap * 2)
  addPoint(buf, x0, y0, cap)
  addPoint(buf, x1, y1, cap)
  return buf
}

function buildStar(cx: number, cy: number, outerR: number, innerR: number, cap: number): Float32Array {
  const buf = new Float32Array(cap * 2)
  const points = 5
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    addPoint(buf, cx + Math.cos(a) * r, cy + Math.sin(a) * r, cap)
  }
  return buf
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function eraseNear(strokes: Stroke[], px: number, py: number, threshold: number): boolean {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i]
    const pts = s.points
    for (let j = 0; j < pts.length - 2; j += 2) {
      if (distToSegment(px, py, pts[j], pts[j + 1], pts[j + 2], pts[j + 3]) < threshold) {
        strokes.splice(i, 1)
        return true
      }
    }
    // Single-point shapes
    if (pts.length < 4) {
      for (let j = 0; j < pts.length; j += 2) {
        if (Math.hypot(px - pts[j], py - pts[j + 1]) < threshold) {
          strokes.splice(i, 1)
          return true
        }
      }
    }
  }
  return false
}

// ── Shape preview (exported for external overlay rendering) ──────────────────

export function getShapePreview(
  shapeType: string,
  cx: number,
  cy: number,
  prevX: number,
  prevY: number,
): Float32Array | null {
  const cap = 64
  if (shapeType === 'circle') {
    return buildCircle(cx, cy, Math.max(5, Math.hypot(cx - prevX, cy - prevY)), cap)
  } else if (shapeType === 'rect') {
    const w = Math.max(10, Math.abs(cx - prevX) * 2)
    const h = Math.max(10, Math.abs(cy - prevY) * 2)
    return buildRect(cx, cy, w, h, cap)
  } else if (shapeType === 'line') {
    return buildLine(prevX, prevY, cx, cy, cap)
  } else if (shapeType === 'star') {
    const r = Math.max(5, Math.hypot(cx - prevX, cy - prevY))
    return buildStar(cx, cy, r, r * 0.4, cap)
  }
  return null
}

// ── Color parsing ─────────────────────────────────────────────────────────────

function parseColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ]
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const doodleTool: ToolDef = {
  id: 'doodle',
  kind: 'generative',
  version: '3.1.0',
  label: 'Doodle',
  icon: 'brush',
  category: 'Generative',
  defaultParams: {
    strokes: 24,
    jitter: 2,
    width: 3,
    color: '#ffffff',
    mode: 'freehand',
    shape: 'circle',
    eraseThreshold: 12,
  },
  controls: [
    { param: 'strokes', label: 'Max Strokes', kind: 'slider', min: 4, max: 200, step: 1 },
    { param: 'jitter', label: 'Jitter', kind: 'slider', min: 0.5, max: 6, step: 0.5 },
    { param: 'width', label: 'Width', kind: 'slider', min: 1, max: 20, step: 0.5 },
    { param: 'color', label: 'Stroke Color', kind: 'color' },
    {
      param: 'mode',
      label: 'Mode',
      kind: 'select',
      options: ['freehand', 'circle', 'rect', 'line', 'star', 'erase'],
    },
    { param: 'shape', label: 'Shape', kind: 'select', options: ['circle', 'rect', 'line', 'star'] },
    { param: 'eraseThreshold', label: 'Eraser Size', kind: 'slider', min: 4, max: 40, step: 1 },
  ],
  render(ctx, frame, item, audio, stack) {
    const W = stack.width
    const H = stack.height
    const jitter = Number(item.params.jitter ?? 2)
    const baseWidth = Number(item.params.width ?? 3)
    const color = String(item.params.color ?? '#ffffff')
    const maxStrokes = Math.round(Number(item.params.strokes ?? 24))
    const eraseThreshold = Number(item.params.eraseThreshold ?? 12)
    const mode = String(item.params.mode ?? currentMode)
    const shapeType = String(item.params.shape ?? currentShape)

    // Sync global UI state from params
    currentMode = mode
    currentShape = shapeType

    const uid = item.uid
    let strokes = strokesByUid.get(uid)
    if (!strokes) {
      strokes = []
      strokesByUid.set(uid, strokes)
    }

    // ── Set up canvas event listeners (first frame only) ─────────────────
    const canvasElLocal = ctx.canvas
    if (canvasElLocal != null && typeof (canvasElLocal as unknown as Record<string, unknown>).addEventListener === 'function' && canvasElLocal !== canvasEl) {
      canvasEl = canvasElLocal as HTMLCanvasElement

      const getCanvasPos = (e: MouseEvent): [number, number] => {
        const rect = canvasEl!.getBoundingClientRect()
        const scaleX = W / rect.width
        const scaleY = H / rect.height
        return [
          (e.clientX - rect.left) * scaleX,
          (e.clientY - rect.top) * scaleY,
        ]
      }

      const onMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0) return
        const [x, y] = getCanvasPos(e)
        isDrawing = true
        cursorX = x
        cursorY = y

        if (mode === 'erase') {
          eraseNear(strokes, x, y, eraseThreshold)
          isDrawing = false
          return
        }

        strokes.push({
          points: mode === 'circle' ? buildCircle(x, y, 40, 128)
            : mode === 'rect' ? buildRect(x, y, 80, 60, 128)
            : mode === 'line' ? buildLine(x - 40, y, x + 40, y, 128)
            : mode === 'star' ? buildStar(x, y, 40, 16, 128)
            : new Float32Array(0),
          type: mode,
          width: baseWidth,
          color,
        })
        if (strokes.length > maxStrokes) strokes.shift()
        isDrawing = false
      }

      const onMouseMove = (e: MouseEvent): void => {
        const [x, y] = getCanvasPos(e)
        cursorX = x
        cursorY = y
        if (!isDrawing) return
        if (mode === 'erase') {
          eraseNear(strokes, x, y, eraseThreshold)
          return
        }
        // Freehand: append point to pending stroke
        let pending = pendingByUid.get(uid)
        if (!pending) {
          const cap = 512
          const buf = new Float32Array(cap * 2)
          addPoint(buf, x, y, cap)
          pending = { points: buf, type: 'freehand', width: baseWidth, color }
          pendingByUid.set(uid, pending)
        } else {
          addPoint(pending.points, x, y, pending.points.length / 2)
        }
      }

      const onMouseUp = (): void => {
        if (!isDrawing) return
        isDrawing = false
        const pending = pendingByUid.get(uid)
        if (pending && pending.points.length >= 4) {
          strokes.push(pending)
          if (strokes.length > maxStrokes) strokes.shift()
        }
        pendingByUid.delete(uid)
      }

      canvasEl.addEventListener('mousedown', onMouseDown)
      canvasEl.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    // ── Render strokes ───────────────────────────────────────────────────
    ctx.save()
    const glowAmount = audio.treble * 0.35
    const hex = color.replace('#', '')
    const [r, g, b] = parseColor(hex)
    const baseAlpha = 0.82 + glowAmount
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const wobble = Math.sin(frame.timeSec * 0.8) * 0.4

    // Draw stored strokes
    for (const s of strokes) {
      const pts = s.points
      if (pts.length < 4) continue
      const sw = (s.width ?? baseWidth) + wobble
      const alpha = Math.min(1, baseAlpha + (s.color === color ? 0 : 0.1))
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.lineWidth = sw
      if ('filter' in ctx && glowAmount > 0.05) {
        ctx.filter = `blur(${glowAmount * 2.5}px)`
      } else if ('filter' in ctx) {
        ctx.filter = 'blur(0.6px)'
      }
      ctx.beginPath()
      ctx.moveTo(pts[0], pts[1])
      for (let p = 1; p < pts.length / 2 - 2; p++) {
        const jx = (Math.random() - 0.5) * jitter
        const jy = (Math.random() - 0.5) * jitter
        ctx.quadraticCurveTo(
          pts[p * 2] + jx,
          pts[p * 2 + 1] + jy,
          pts[(p + 1) * 2],
          pts[(p + 1) * 2 + 1],
        )
      }
      ctx.stroke()
    }

    // Draw live pending stroke (being drawn this frame)
    const pending = pendingByUid.get(uid)
    if (pending && pending.points.length >= 4) {
      const pts = pending.points
      ctx.strokeStyle = `rgba(${r},${g},${b},${baseAlpha})`
      ctx.lineWidth = (pending.width ?? baseWidth) + wobble
      if ('filter' in ctx && glowAmount > 0.05) {
        ctx.filter = `blur(${glowAmount * 2.5}px)`
      }
      ctx.beginPath()
      ctx.moveTo(pts[0], pts[1])
      for (let p = 1; p < pts.length / 2 - 2; p++) {
        const jx = (Math.random() - 0.5) * jitter
        const jy = (Math.random() - 0.5) * jitter
        ctx.quadraticCurveTo(
          pts[p * 2] + jx,
          pts[p * 2 + 1] + jy,
          pts[(p + 1) * 2],
          pts[(p + 1) * 2 + 1],
        )
      }
      ctx.stroke()
    }

    // Draw shape preview (dashed outline at cursor)
    if (!isDrawing && (mode === 'circle' || mode === 'rect' || mode === 'line' || mode === 'star')) {
      let buf: Float32Array
      if (mode === 'circle') {
        buf = buildCircle(cursorX, cursorY, 40, 128)
      } else if (mode === 'rect') {
        buf = buildRect(cursorX, cursorY, 80, 60, 128)
      } else if (mode === 'line') {
        buf = buildLine(cursorX - 40, cursorY, cursorX + 40, cursorY, 128)
      } else {
        buf = buildStar(cursorX, cursorY, 40, 16, 128)
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`
      ctx.lineWidth = (baseWidth ?? 3) * 0.7
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(buf[0], buf[1])
      for (let p = 1; p < buf.length / 2 - 2; p++) {
        ctx.lineTo(buf[p * 2], buf[p * 2 + 1])
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()
  },
}
