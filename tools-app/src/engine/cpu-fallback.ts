import { mulberry32 } from './rd'

const clampByte = (v: number) => Math.min(255, Math.max(0, Math.round(v)))

// Color grading identical to the adjustments shader math (see engine/effects/adjustments.ts):
// additive brightness -> contrast scaled around 128 -> luminance-preserving saturation.
export function applyAdjustmentsCPU(img: ImageData, p: Record<string, number>): void {
  const brightness = p.brightness ?? 0
  const contrast = p.contrast ?? 0
  const saturation = p.saturation ?? 0
  const k = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] + brightness
    let g = d[i + 1] + brightness
    let b = d[i + 2] + brightness
    r = k * (r - 128) + 128
    g = k * (g - 128) + 128
    b = k * (b - 128) + 128
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = gray + (r - gray) * (1 + saturation)
    g = gray + (g - gray) * (1 + saturation)
    b = gray + (b - gray) * (1 + saturation)
    d[i] = clampByte(r)
    d[i + 1] = clampByte(g)
    d[i + 2] = clampByte(b)
  }
}

// Row-wise horizontal sine shift, wrapping at edges (CPU reference variant of the waves shader).
export function applyWavesCPU(img: ImageData, p: Record<string, number>, timeSec: number): void {
  const intensity = p.intensity ?? 0
  const quantity = p.quantity ?? 0.08
  const speed = p.speed ?? 1
  if (intensity === 0) return
  const { width, height, data } = img
  const src = new Uint8ClampedArray(data)
  for (let y = 0; y < height; y++) {
    const shift = Math.round(Math.sin(y * 6.2831 * quantity + timeSec * speed) * intensity)
    for (let x = 0; x < width; x++) {
      const sx = (((x - shift) % width) + width) % width
      const di = (y * width + x) * 4
      const si = (y * width + sx) * 4
      data[di] = src[si]
      data[di + 1] = src[si + 1]
      data[di + 2] = src[si + 2]
      data[di + 3] = src[si + 3]
    }
  }
}

// Per-pixel additive noise from a deterministic PRNG stream (motion handled by caller seed).
export function applyGrainCPU(img: ImageData, p: Record<string, number>, seed: number): void {
  const intensity = p.intensity ?? 0
  if (intensity === 0) return
  const rng = mulberry32(seed)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * intensity
    d[i] = clampByte(d[i] + n)
    d[i + 1] = clampByte(d[i + 1] + n)
    d[i + 2] = clampByte(d[i + 2] + n)
  }
}
