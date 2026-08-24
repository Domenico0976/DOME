import { useRef } from 'react'
import { useEngineFrame } from '../hooks/useEngineFrame'
import { useToolStore } from '../state/store'
import { getBoundMediaElement } from '../audio/media-binding'
import { LFO_MODES, lfoValue } from '../nodes/math-helpers'
import { mapValue } from '../nodes/math-helpers'
import type { GraphEngine } from '../engine/engine'
import type { GraphModel } from '../engine/graph'
import type { Bands } from '../engine/types'

const PREVIEW_WIDTH = 200
const PREVIEW_HEIGHT = 120
const WAVE_POINTS = 100
const ACCENT = '#7aa2ff'
const FAINT = '#4a4a55'

interface NodePreviewProps {
  nodeId: string
  nodeType: string
}

function isBands(value: unknown): value is Bands {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    value.data instanceof Float32Array
  )
}

function prepareContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.round(PREVIEW_WIDTH * dpr)
  const height = Math.round(PREVIEW_HEIGHT * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function paintBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0d0d10'
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)
}

function drawWave(ctx: CanvasRenderingContext2D, samples: readonly number[], color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let index = 0; index < samples.length; index += 1) {
    const x = (index / (samples.length - 1)) * PREVIEW_WIDTH
    const y = PREVIEW_HEIGHT - samples[index] * (PREVIEW_HEIGHT - 8) - 4
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

function drawSpectrumBars(ctx: CanvasRenderingContext2D, data: Float32Array): void {
  const barCount = data.length
  if (barCount === 0) return
  const barWidth = PREVIEW_WIDTH / barCount
  ctx.fillStyle = ACCENT
  for (let index = 0; index < barCount; index += 1) {
    const value = Number.isFinite(data[index]) ? data[index] : 0
    const barHeight = Math.max(1, value * (PREVIEW_HEIGHT - 6))
    ctx.fillRect(index * barWidth, PREVIEW_HEIGHT - barHeight, Math.max(1, barWidth - 1), barHeight)
  }
}

// Read-only per-frame drawing: reads engine outputs and model params, never
// calls setState. The global engine.tick in App keeps outputs fresh.
function drawPreview(
  ctx: CanvasRenderingContext2D,
  engine: GraphEngine,
  model: GraphModel,
  nodeId: string,
  nodeType: string,
  timeSec: number,
): void {
  paintBackground(ctx)

  if (nodeType === 'source.lfo-noise') {
    const params = model.getNode(nodeId)?.params ?? {}
    const mode = typeof params['mode'] === 'number' ? params['mode'] : LFO_MODES.SINE
    const rateHz = typeof params['rateHz'] === 'number' ? params['rateHz'] : 1
    const phase = typeof params['phase'] === 'number' ? params['phase'] : 0

    const samples: number[] = []
    if (mode === LFO_MODES.NOISE) {
      let value = 0.5
      for (let index = 0; index < WAVE_POINTS; index += 1) {
        value = Math.min(1, Math.max(0, value + (Math.random() - 0.5) * 0.16))
        samples.push(value)
      }
    } else {
      // Sample the recent past so the wave scrolls right-to-left.
      for (let index = 0; index < WAVE_POINTS; index += 1) {
        samples.push(lfoValue(mode, rateHz, phase, timeSec - (index / WAVE_POINTS) * 2))
      }
    }
    drawWave(ctx, samples, ACCENT)
    return
  }

  if (nodeType === 'analyser.audio') {
    const spectrum = engine.outputOf(nodeId, 'spectrum')
    if (isBands(spectrum)) drawSpectrumBars(ctx, spectrum.data)
    return
  }

  if (nodeType === 'map.gain-offset') {
    const params = model.getNode(nodeId)?.params ?? {}
    const gain = typeof params['gain'] === 'number' ? params['gain'] : 1
    const offset = typeof params['offset'] === 'number' ? params['offset'] : 0

    const inputSamples: number[] = []
    const outputSamples: number[] = []
    for (let index = 0; index < WAVE_POINTS; index += 1) {
      const t = timeSec * 0.75 + (index / WAVE_POINTS) * 2
      const sine = Math.sin(2 * Math.PI * t)
      inputSamples.push((sine + 1) / 2)
      outputSamples.push(mapValue(sine, gain, offset))
    }
    drawWave(ctx, inputSamples, FAINT)
    drawWave(ctx, outputSamples, ACCENT)
    return
  }

  if (nodeType === 'render.canvas') {
    engine.getRuntime(nodeId)?.draw?.(ctx, { frame: 0, timeSec, dt: 0 })
  }
}

export function NodePreview({ nodeId, nodeType }: NodePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useToolStore((state) => state.engine)
  const model = useToolStore((state) => state.model)

  useEngineFrame((timeSec) => {
    if (nodeType === 'input.audio-file') return
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = prepareContext(canvas)
    if (ctx === null) return
    drawPreview(ctx, engine, model, nodeId, nodeType, timeSec)
  })

  if (nodeType === 'input.audio-file') {
    // bindMediaElement runs when a file is loaded in the transport bar, so a
    // bound element means audio is connected to the app.
    const element = getBoundMediaElement()
    return (
      <p className="preview-note">
        {element === null ? 'Connect audio to preview' : 'Audio connected — press Play in the transport bar'}
      </p>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="preview-canvas"
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      role="img"
      aria-label="Live preview of block output"
    />
  )
}
