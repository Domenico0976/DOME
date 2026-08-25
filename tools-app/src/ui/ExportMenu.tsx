import { useAudio } from '../audio/useAudio'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
import { collectActiveEffects } from '../engine/effects'
import { createCompositor } from '../engine/compositor'
import { applyAdjustmentsCPU, applyGrainCPU, applyWavesCPU } from '../engine/cpu-fallback'
import { RATIO, CPU_ONLY } from './Canvas'

let webgl2Supported: boolean | null = null
function hasWebGL2Export(): boolean {
  if (webgl2Supported === null) {
    try {
      webgl2Supported = !!document.createElement('canvas').getContext('webgl2')
    } catch {
      webgl2Supported = false
    }
  }
  return webgl2Supported
}
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Download, Camera, Music2, Maximize2, RotateCcw } from 'lucide-react'

function download(canvas: HTMLCanvasElement, name: string): void {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export function ExportMenu() {
  const audio = useAudio()
  const rasterForced = useProjectStore((s) => s.stack.some((i) => i.effects?.some((e) => e.enabled)))
  const gpuForced = useProjectStore((s) =>
    s.stack.some((i) => (i.effects ?? []).some((e) => e.enabled && !CPU_ONLY.has(e.type))),
  ) && !hasWebGL2Export()

  const exportAt = (w: number, h: number, name: string) => {
    const state = useProjectStore.getState()
    const bpm = state.timeline.bpm
    const frame = { timeSec: state.timeline.timeSec, dt: 1 / 60, bpm }
    const af = audio.readFrame(bpm)

    const aspect = state.canvas.aspect
    const W = 720
    const H = Math.round(W / RATIO[aspect])

    const base = document.createElement('canvas')
    base.width = W
    base.height = H
    const bctx = base.getContext('2d')
    if (!bctx) return
    evaluateStack(bctx, frame, af, state.stack)

    const passes = collectActiveEffects(state.stack)
    const genItem = state.stack.find((i) => i.toolId === 'shaders' && !i.hidden)
    const shaderGen = genItem
      ? {
          scale: Number(genItem.params.scale ?? 4),
          speed: Number(genItem.params.speed ?? 1),
          palette: Math.max(0, ['magma', 'ice', 'toxic'].indexOf(String(genItem.params.palette ?? 'magma'))),
          timeSec: frame.timeSec,
        }
      : undefined

    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return

    const glc = document.createElement('canvas')
    glc.width = W
    glc.height = H
    const comp = createCompositor(glc)

    if (comp && (passes.length > 0 || shaderGen)) {
      comp.apply(base, passes, frame, af, { shaderGen })
      ctx.drawImage(glc, 0, 0, w, h)
    } else if (passes.length > 0) {
      const img = bctx.getImageData(0, 0, W, H)
      for (const p of passes) {
        if (p.type === 'adjustments') applyAdjustmentsCPU(img, p.params)
        else if (p.type === 'waves') applyWavesCPU(img, p.params, frame.timeSec)
        else if (p.type === 'grain') applyGrainCPU(img, p.params, Math.floor(frame.timeSec * 60))
      }
      bctx.putImageData(img, 0, 0)
      ctx.drawImage(base, 0, 0, w, h)
    } else {
      ctx.drawImage(base, 0, 0, w, h)
    }

    download(c, name)
  }

  const png = () => exportAt(1080, 1080, 'dome-export.png')
  const instagram = () => exportAt(1080, 1080, 'dome-instagram.png')
  const spotify = () => exportAt(1080, 1080, 'dome-spotify-canvas.png')
  const fullscreen = () => {
    document.getElementById('stage-canvas')?.requestFullscreen?.()
  }
  const resetView = () => useProjectStore.getState().reset()

  return (
    <div className="flex items-center gap-1.5" aria-label="Export menu">
      {rasterForced && (
        <Badge variant="warning" data-testid="raster-badge">
          Raster output
        </Badge>
      )}
      {gpuForced && (
        <Badge variant="warning" data-testid="gpu-required-badge">
          GPU required for effects
        </Badge>
      )}
      <Button variant="default" size="sm" onClick={png}>
        <Download className="h-3.5 w-3.5" />
        Export PNG
      </Button>
      <Button variant="secondary" size="sm" onClick={instagram}>
        <Camera className="h-3.5 w-3.5" />
        Instagram
      </Button>
      <Button variant="secondary" size="sm" onClick={spotify}>
        <Music2 className="h-3.5 w-3.5" />
        Spotify Canvas
      </Button>
      <Button variant="ghost" size="sm" onClick={fullscreen}>
        <Maximize2 className="h-3.5 w-3.5" />
        Fullscreen
      </Button>
      <Button variant="ghost" size="sm" onClick={resetView}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  )
}
