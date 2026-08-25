import { useEffect, useRef } from 'react'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
import { useAudio } from '../audio/useAudio'
import { collectActiveEffects } from '../engine/effects'
import { createCompositor, hasWebGL2 } from '../engine/compositor'
import type { Compositor } from '../engine/compositor'
import { applyAdjustmentsCPU, applyGrainCPU, applyWavesCPU } from '../engine/cpu-fallback'

const RATIO = { '1:1': 1, '3:4': 3 / 4, '9:16': 9 / 16, '4:3': 4 / 3, '16:9': 16 / 9 } as const
const CPU_ONLY = new Set(['adjustments', 'waves', 'grain'])
const reduceMotion =
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

export function Canvas() {
  const flatRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const compRef = useRef<Compositor | null>(null)
  const aspect = useProjectStore((s) => s.canvas.aspect)
  const quality = useProjectStore((s) => s.canvas.quality)
  const stackLen = useProjectStore((s) => s.stack.length)
  const effectCount = useProjectStore(
    (s) => s.stack.reduce((n, i) => n + (i.effects?.filter((e) => e.enabled).length ?? 0), 0),
  )
  const audio = useAudio()
  const W = 720
  const H = Math.round(W / RATIO[aspect])

  useEffect(() => {
    const flat = flatRef.current
    const glc = glRef.current
    if (!flat || !glc) return
    flat.width = W
    flat.height = H
    glc.width = W
    glc.height = H
    if (!baseRef.current) baseRef.current = document.createElement('canvas')
    const base = baseRef.current
    base.width = W
    base.height = H
    const bctx = base.getContext('2d')
    if (!bctx) return
    let raf = 0
    let t = 0
    const scale = quality === 'low' ? 0.5 : quality === 'med' ? 0.75 : 1
    const loop = () => {
      t += 1 / 60
      const st = useProjectStore.getState()
      const bpm = st.timeline.bpm
      const effFrame = reduceMotion ? { timeSec: 0, dt: 1 / 60, bpm } : { timeSec: t, dt: 1 / 60, bpm }
      const a = audio.readFrame(bpm)
      bctx.setTransform(1, 0, 0, 1, 0, 0)
      bctx.clearRect(0, 0, base.width, base.height)
      bctx.save()
      bctx.scale(scale, scale)
      evaluateStack(bctx, effFrame, a, st.stack)
      bctx.restore()

      const passes = collectActiveEffects(st.stack)
      const genItem = st.stack.find((i) => i.toolId === 'shaders' && !i.hidden)
      const shaderGen = genItem
        ? {
            scale: Number(genItem.params.scale ?? 4),
            speed: Number(genItem.params.speed ?? 1),
            palette: Math.max(0, ['magma', 'ice', 'toxic'].indexOf(String(genItem.params.palette ?? 'magma'))),
            timeSec: effFrame.timeSec,
          }
        : undefined
      if (passes.length > 0 && !compRef.current && hasWebGL2(glc)) compRef.current = createCompositor(glc)
      const comp = compRef.current
      const fctx = flat.getContext('2d')

      if (comp && (passes.length > 0 || shaderGen)) {
        flat.style.visibility = 'hidden'
        glc.style.visibility = 'visible'
        comp.resize(W, H)
        comp.apply(base, passes, effFrame, a, { shaderGen })
      } else if (passes.length > 0 && fctx) {
        flat.style.visibility = 'visible'
        glc.style.visibility = 'hidden'
        if (passes.every((p) => CPU_ONLY.has(p.type))) {
          fctx.drawImage(base, 0, 0)
          const img = fctx.getImageData(0, 0, W, H)
          for (const p of passes) {
            if (p.type === 'adjustments') applyAdjustmentsCPU(img, p.params)
            else if (p.type === 'waves') applyWavesCPU(img, p.params, effFrame.timeSec)
            else if (p.type === 'grain') applyGrainCPU(img, p.params, Math.floor(effFrame.timeSec * 60))
          }
          fctx.putImageData(img, 0, 0)
        } else {
          fctx.drawImage(base, 0, 0)
        }
      } else if (fctx) {
        flat.style.visibility = 'visible'
        glc.style.visibility = 'hidden'
        fctx.drawImage(base, 0, 0)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [aspect, quality, stackLen, effectCount])

  return (
    <div id="stage-canvas" data-testid="stage-canvas" className="relative inline-block">
      <canvas
        ref={flatRef}
        width={W}
        height={H}
        className="max-h-full max-w-full rounded-lg border border-border bg-black shadow-2xl"
      />
      <canvas
        ref={glRef}
        width={W}
        height={H}
        aria-hidden
        style={{ visibility: 'hidden' }}
        className="absolute inset-0 max-h-full max-w-full rounded-lg border border-border bg-black shadow-2xl"
      />
    </div>
  )
}
