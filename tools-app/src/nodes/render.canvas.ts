import { BANDS_LENGTH } from '../engine/types'
import type { NodeDef } from '../engine/types'
import type { FrameInfo, NodeRuntimeLike, RegistryEntry } from '../engine/engine'

export const RENDER_MODES = { BARS: 0, MIRROR: 1 } as const

interface RenderCanvasRuntime extends NodeRuntimeLike {
  draw(ctx: CanvasRenderingContext2D, frame: FrameInfo): void
}

const DEF: NodeDef = {
  type: 'render.canvas',
  label: 'Canvas',
  inputs: [
    { name: 'level', type: 'number', defaultValue: 0 },
    { name: 'bass', type: 'number', defaultValue: 0 },
    { name: 'mid', type: 'number', defaultValue: 0 },
    { name: 'treble', type: 'number', defaultValue: 0 },
    { name: 'spectrum', type: 'bands', defaultValue: { data: new Float32Array(BANDS_LENGTH) } },
  ],
  outputs: [],
}

const BACKGROUND = '#0d0d10'
const ACCENT = '#7aa2ff'

function drawScalarFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  inputs: Record<string, unknown>,
): void {
  const keys = ['level', 'bass', 'mid', 'treble']
  ctx.fillStyle = ACCENT
  keys.forEach((key, index) => {
    const raw = inputs[key]
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    const slotWidth = width / keys.length
    const barHeight = Math.max(1, value * height * 0.9)
    ctx.fillRect(index * slotWidth + slotWidth * 0.25, height - barHeight, slotWidth * 0.5, barHeight)
  })
}

export const entry: RegistryEntry = (() => {
  let lastInputs: Record<string, unknown> = {}
  let lastParams: Record<string, number> = {}

  const runtime: RenderCanvasRuntime = {
    ready: () => true,

    compute: (inputs, params) => {
      lastInputs = inputs
      lastParams = params
      return {}
    },

    draw: (ctx) => {
      const width = ctx.canvas.width
      const height = ctx.canvas.height
      ctx.fillStyle = BACKGROUND
      ctx.fillRect(0, 0, width, height)

      const spectrumCandidate = lastInputs['spectrum']
      const spectrum =
        typeof spectrumCandidate === 'object' &&
        spectrumCandidate !== null &&
        'data' in spectrumCandidate
          ? ((spectrumCandidate as { data: Float32Array }).data satisfies Float32Array)
          : null

      if (spectrum === null) {
        drawScalarFallback(ctx, width, height, lastInputs)
        return
      }

      const mode = typeof lastParams['mode'] === 'number' ? lastParams['mode'] : RENDER_MODES.BARS
      const barCount = spectrum.length
      const barWidth = width / barCount
      ctx.fillStyle = ACCENT

      for (let index = 0; index < barCount; index += 1) {
        const value = Number.isFinite(spectrum[index]) ? spectrum[index] : 0
        const barHeight = Math.max(1, value * height * (mode === RENDER_MODES.MIRROR ? 0.45 : 0.92))
        const x = index * barWidth
        const barThickness = Math.max(1, barWidth - 1)
        if (mode === RENDER_MODES.MIRROR) {
          ctx.fillRect(x, height / 2 - barHeight, barThickness, barHeight)
          ctx.fillRect(x, height / 2, barThickness, barHeight)
        } else {
          ctx.fillRect(x, height - barHeight, barThickness, barHeight)
        }
      }
    },
  }

  return { def: DEF, create: () => runtime }
})()
