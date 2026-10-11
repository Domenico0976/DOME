import { useAudio } from '../audio/useAudio'
import { useProjectStore } from '../state/projectStore'
import { useToast } from './Toast'
import { evaluateStack } from '../core/stackEngine'
import { collectActiveEffects, resolvePassParams } from '../engine/effects'
import { createCompositor } from '../engine/compositor'
import { applyAdjustmentsCPU, applyGrainCPU, applyWavesCPU } from '../engine/cpu-fallback'
import { resumeIfSuspended } from '../audio/engine'
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

function download(canvas: HTMLCanvasElement, name: string): void {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export function computeRasterForced(stack: ReturnType<typeof useProjectStore.getState>['stack']): boolean {
  return stack.some((i) => i.effects?.some((e) => e.enabled))
}

export function computeGpuForced(stack: ReturnType<typeof useProjectStore.getState>['stack']): boolean {
  return (
    stack.some((i) => (i.effects ?? []).some((e) => e.enabled && !CPU_ONLY.has(e.type))) && !hasWebGL2Export()
  )
}

export function useExportActions() {
  const audio = useAudio()
  const { toast } = useToast()

  const exportAt = (w: number, h: number, name: string) => {
    toast('Export started', { kind: 'info' })
    try {
      void resumeIfSuspended()
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
      if (!bctx) throw new Error('2D context unavailable')
      evaluateStack(bctx, frame, af, state.stack, { muted: new Set(state.audio.disabledAudioBindings ?? []) })

      const passes = collectActiveEffects(state.stack, new Set(state.audio.disabledAudioBindings ?? []))
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
      if (!ctx) throw new Error('2D context unavailable')

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
            const resolved = resolvePassParams(p, frame, af)
          if (p.type === 'adjustments') applyAdjustmentsCPU(img, resolved)
          else if (p.type === 'waves') applyWavesCPU(img, resolved, frame.timeSec)
          else if (p.type === 'grain') applyGrainCPU(img, resolved, Math.floor(frame.timeSec * 60))
        }
        bctx.putImageData(img, 0, 0)
        ctx.drawImage(base, 0, 0, w, h)
      } else {
        ctx.drawImage(base, 0, 0, w, h)
      }

      download(c, name)
      toast('Export complete', { kind: 'success' })
    } catch (err) {
      toast('Export failed', {
        kind: 'error',
        actions: [{ label: 'Retry', onClick: () => exportAt(w, h, name) }],
      })
      void err
    }
  }

  return {
    png: () => exportAt(1080, 1080, 'dome-export.png'),
    instagram: () => exportAt(1080, 1080, 'dome-instagram.png'),
    spotify: () => exportAt(1080, 1080, 'dome-spotify-canvas.png'),
    fullscreen: () => {
      document.getElementById('stage-canvas')?.requestFullscreen?.()
    },
    resetView: () => useProjectStore.getState().reset(),
  }
}