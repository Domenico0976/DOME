export function readSrc(ctx: CanvasRenderingContext2D, w: number, h: number): ImageData | null {
  try {
    const d = ctx.getImageData(0, 0, w, h)
    return d && d.data ? d : null
  } catch {
    return null
  }
}

export function makeOut(ctx: CanvasRenderingContext2D, w: number, h: number): ImageData | null {
  try {
    const o = ctx.createImageData(w, h)
    return o && o.data ? o : null
  } catch {
    return null
  }
}

export function lumAt(d: Uint8ClampedArray, x: number, y: number, w: number, h: number): number {
  const cx = Math.max(0, Math.min(w - 1, x | 0))
  const cy = Math.max(0, Math.min(h - 1, y | 0))
  const i = (cy * w + cx) * 4
  return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
}

export function thermal(l: number): [number, number, number] {
  const r = Math.max(0, Math.min(255, 255 * (l * 1.6 - 0.4)))
  const g = Math.max(0, Math.min(255, 255 * (l * 1.6 - 0.9)))
  const b = Math.max(0, Math.min(255, 255 * (1.2 - l * 1.6)))
  return [r, g, b]
}
