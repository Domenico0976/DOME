export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Gray-Scott reaction-diffusion (Turing pattern), toroidal grid, ping-pong buffers.
// Feed supplies A, kill removes B; reaction A+B^2 converts A into B (Tool-Render.md §1.1).
export class ReactionDiffusion {
  readonly size: number
  private a: Float32Array
  private b: Float32Array
  private a2: Float32Array
  private b2: Float32Array

  constructor(size = 160) {
    this.size = size
    this.a = new Float32Array(size * size).fill(1)
    this.b = new Float32Array(size * size)
    this.a2 = new Float32Array(size * size)
    this.b2 = new Float32Array(size * size)
  }

  seed(attractors: number, rng: () => number): void {
    this.a.fill(1)
    this.b.fill(0)
    for (let k = 0; k < attractors; k++) {
      const cx = rng() * this.size
      const cy = rng() * this.size
      const r = this.size * 0.02 + rng() * this.size * 0.03
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue
          const xi = Math.round(cx + x)
          const yi = Math.round(cy + y)
          this.b[((yi + this.size) % this.size) * this.size + ((xi + this.size) % this.size)] = 1
        }
    }
    for (let i = 0; i < this.b.length; i++) if (rng() < 0.002) this.b[i] = 1
  }

  step(feed: number, kill: number): void {
    const Da = 1.0
    const Db = 0.5
    const n = this.size
    const { a, b, a2, b2 } = this
    for (let y = 0; y < n; y++) {
      const yUp = ((y - 1 + n) % n) * n
      const yDn = ((y + 1) % n) * n
      const yC = y * n
      for (let x = 0; x < n; x++) {
        const xL = (x - 1 + n) % n
        const xR = (x + 1) % n
        const i = yC + x
        const lapA = a[yC + xL] + a[yC + xR] + a[yUp + x] + a[yDn + x] - 4 * a[i]
        const lapB = b[yC + xL] + b[yC + xR] + b[yUp + x] + b[yDn + x] - 4 * b[i]
        const reaction = a[i] * b[i] * b[i]
        a2[i] = Math.min(1, Math.max(0, a[i] + (Da * lapA - reaction + feed * (1 - a[i]))))
        b2[i] = Math.min(1, Math.max(0, b[i] + (Db * lapB + reaction - (kill + feed) * b[i])))
      }
    }
    this.a = a2
    this.b = b2
    this.a2 = a
    this.b2 = b
  }

  averageB(): number {
    let s = 0
    for (let i = 0; i < this.b.length; i++) s += this.b[i]
    return s / this.b.length
  }

  // Pixel color mixes black toward the accent color by the B channel concentration.
  toImageData(accent: [number, number, number]): ImageData {
    const n = this.size
    const img = new ImageData(n, n)
    const d = img.data
    for (let i = 0; i < n * n; i++) {
      const v = Math.min(1, this.b[i] * 1.4)
      d[i * 4] = Math.round(accent[0] * v)
      d[i * 4 + 1] = Math.round(accent[1] * v)
      d[i * 4 + 2] = Math.round(accent[2] * v)
      d[i * 4 + 3] = 255
    }
    return img
  }
}
