import { mulberry32 } from './rd'

const clampByte = (v: number) => Math.min(255, Math.max(0, Math.round(v)))

// Color grading identical to the adjustments shader math (see effects/adjustments.ts):
// exposure multiplicative -> temperature/tint white-balance -> contrast around mid -> saturation.
export function applyAdjustmentsCPU(img: ImageData, p: Record<string, number>): void {
  const exposure = p.exposure ?? 50
  const contrast = p.contrast ?? 50
  const saturation = p.saturation ?? 50
  const temperature = p.temperature ?? 50
  const tint = p.tint ?? 50
  const emul = Math.pow(2, (exposure - 50) / 25)
  const cf = 1 + (contrast - 50) / 50
  const sf = Math.min(3, Math.max(0, 1 + (saturation - 50) / 50))
  const dTemp = (temperature - 50) * 0.0018
  const dTint = (50 - tint) * 0.0012
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255
    let g = d[i + 1] / 255
    let b = d[i + 2] / 255
    r *= emul
    g *= emul
    b *= emul
    r += dTemp
    b -= dTemp
    g += dTint
    const mid = 0.5
    r = (r - mid) * cf + mid
    g = (g - mid) * cf + mid
    b = (b - mid) * cf + mid
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = gray + (r - gray) * sf
    g = gray + (g - gray) * sf
    b = gray + (b - gray) * sf
    d[i] = clampByte(r * 255)
    d[i + 1] = clampByte(g * 255)
    d[i + 2] = clampByte(b * 255)
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
