import type { ToolDef } from '../../core/types'

// Liquid Metal: metaball field with threshold + specular shading, cell-shaded raster (Tool-Render.md §1.4).
// Stylized grid sampling (GPU raytraced variant deferred) — see plan self-review deviations.
export const liquidMetalTool: ToolDef = {
  id: 'liquidmetal',
  kind: 'generative',
  version: '1.0.0',
  label: 'Liquid Metal',
  icon: 'gem',
  category: 'Generative',
  defaultParams: { blobs: 8, threshold: 1, lightAngle: 45, scale: 90 },
  controls: [
    { param: 'blobs', label: 'Blobs', kind: 'slider', min: 4, max: 14, step: 1 },
    { param: 'threshold', label: 'Threshold', kind: 'slider', min: 0.6, max: 1.6, step: 0.02 },
    { param: 'lightAngle', label: 'Light Angle', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'scale', label: 'Detail', kind: 'slider', min: 48, max: 160, step: 8 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const blobN = Math.round(Number(item.params.blobs ?? 8))
    const threshold = Number(item.params.threshold ?? 1)
    const lightRad = (Number(item.params.lightAngle ?? 45) * Math.PI) / 180
    const G = Math.max(48, Math.round(Number(item.params.scale ?? 90)))
    const t = frame.timeSec
    const cw = stack.width / G
    const ch = stack.height / G

    const blobs = Array.from({ length: blobN }, (_, i) => {
      const ph = (i / blobN) * Math.PI * 2
      return {
        x: 0.5 + Math.cos(ph + t * 0.35) * 0.28,
        y: 0.5 + Math.sin(ph * 1.6 + t * 0.27) * 0.28,
        r: 0.06 + 0.05 * ((i % 3) / 3),
      }
    })

    const field = (nx: number, ny: number) => {
      let sum = 0
      for (const b of blobs) {
        const dx = nx - b.x
        const dy = ny - b.y
        sum += (b.r * b.r) / (dx * dx + dy * dy + 0.0008)
      }
      return sum
    }

    const lx = Math.cos(lightRad)
    const ly = Math.sin(lightRad)
    const e = 1.5 / G

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const nx = gx / G
        const ny = gy / G
        const v = field(nx, ny)
        if (v <= threshold) continue
        const nxr = field(nx + e, ny) - v
        const nyr = field(nx, ny + e) - v
        const len = Math.hypot(nxr, nyr, 0.06)
        const dot = Math.max(0, (-nxr / len) * lx + (-nyr / len) * ly + 1 / len)
        const spec = Math.pow(dot, 20)
        const shade = 70 + dot * 130
        const r = Math.min(255, shade + spec * 255)
        const g = Math.min(255, shade * 0.98 + spec * 255)
        const bl = Math.min(255, shade * 0.95 + spec * 250)
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`
        ctx.fillRect(gx * cw, gy * ch, cw + 1, ch + 1)
      }
    }
  },
}
