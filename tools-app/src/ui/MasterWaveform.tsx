import { useCallback, useEffect, useRef } from 'react'
import { useAudio } from '../audio/useAudio'
import { useProjectStore } from '../state/projectStore'

interface MasterWaveformProps {
  timeSec: number
  durationSec: number
  sourceLoaded: boolean
  onSeek: (t: number) => void
  className?: string
}

const RULER_H = 32
const WAVE_H = 80
const SCRUB_H = 24

function formatMmSs(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function cssVarHsl(name: string, fallback: string): string {
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v ? `hsl(${v})` : fallback
}

function cssVarRaw(name: string, fallback: string): string {
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function MasterWaveform({ timeSec, durationSec, sourceLoaded, onSeek, className }: MasterWaveformProps) {
  const audio = useAudio()
  const bpm = useProjectStore((s) => s.timeline.bpm)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const timeSecRef = useRef(timeSec)
  timeSecRef.current = timeSec
  const durationSecRef = useRef(durationSec)
  durationSecRef.current = durationSec
  const seekRef = useRef(onSeek)
  seekRef.current = onSeek

  const seekFromClientX = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas || durationSecRef.current <= 0) return
    const rect = canvas.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    const t = Math.max(0, Math.min(durationSecRef.current, ratio * durationSecRef.current))
    seekRef.current(t)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (durationSecRef.current <= 0) return
      seekFromClientX(e.clientX)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    },
    [seekFromClientX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return
      seekFromClientX(e.clientX)
    },
    [seekFromClientX],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, width * dpr)
      canvas.height = Math.max(1, height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const barColor = cssVarRaw('--soundbar-waveform-bar', 'rgba(184, 217, 74, 0.45)')
    const playedColor = cssVarRaw('--soundbar-waveform-played', '#b8d94a')
    const playheadColor = cssVarHsl('--foreground', '#fff')
    const emptyColor = cssVarHsl('--text-muted', '#888')
    const rulerText = cssVarHsl('--text-muted', '#888')
    const surface = cssVarHsl('--surface-2', '#1a1a1a')

    const draw = () => {
      const dur = durationSecRef.current
      const t = timeSecRef.current
      const progressX = dur > 0 ? (t / dur) * width : 0

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = surface
      ctx.fillRect(0, 0, width, height)

      if (!sourceLoaded) {
        ctx.fillStyle = emptyColor
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Load audio to see waveform', width / 2, height / 2)
      } else {
        const frame = audio.readFrame(bpmRef.current)
        const waveTop = RULER_H
        const waveMid = waveTop + WAVE_H / 2
        const scrubTop = waveTop + WAVE_H

        ctx.strokeStyle = rulerText
        ctx.fillStyle = rulerText
        ctx.lineWidth = 1
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        if (dur > 0) {
          for (let s = 0; s <= dur; s += 5) {
            const x = (s / dur) * width
            const isMajor = s % 30 === 0
            const tickH = isMajor ? 10 : 5
            ctx.beginPath()
            ctx.moveTo(x, RULER_H - tickH)
            ctx.lineTo(x, RULER_H)
            ctx.stroke()
            if (isMajor) {
              ctx.fillText(formatMmSs(s), x, 4)
            }
          }
          ctx.beginPath()
          ctx.arc(progressX, RULER_H - 6, 6, 0, Math.PI * 2)
          ctx.fillStyle = playheadColor
          ctx.fill()
          ctx.fillStyle = rulerText
          ctx.fillText(formatMmSs(t), progressX, 4)
        }

        const spectrum = frame.spectrum
        if (spectrum.length > 0 && width > 0) {
          const barW = 2
          const gap = 1
          const count = Math.floor(width / (barW + gap))
          for (let i = 0; i < count; i++) {
            const si = Math.floor((i / count) * spectrum.length)
            const v = spectrum[si] ?? 0
            const halfH = v * (WAVE_H / 2)
            const x = i * (barW + gap)
            ctx.fillStyle = x < progressX ? playedColor : barColor
            ctx.fillRect(x, waveMid - halfH, barW, halfH * 2)
          }
        }
        ctx.strokeStyle = rulerText
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.moveTo(0, waveMid)
        ctx.lineTo(width, waveMid)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.strokeStyle = playheadColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(progressX, waveTop)
        ctx.lineTo(progressX, scrubTop)
        ctx.stroke()

        const railY = scrubTop + SCRUB_H / 2
        ctx.fillStyle = rulerText
        ctx.globalAlpha = 0.35
        ctx.fillRect(0, railY - 2, width, 4)
        ctx.globalAlpha = 1
        ctx.fillStyle = playedColor
        ctx.fillRect(0, railY - 2, progressX, 4)
        ctx.beginPath()
        ctx.arc(progressX, railY, 7, 0, Math.PI * 2)
        ctx.fillStyle = playheadColor
        ctx.fill()

        ctx.fillStyle = rulerText
        ctx.font = '9px monospace'
        ctx.textBaseline = 'bottom'
        ctx.textAlign = 'left'
        ctx.fillText('00:00', 4, height - 1)
        ctx.textAlign = 'right'
        ctx.fillText(formatMmSs(dur), width - 4, height - 1)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [audio, sourceLoaded])

  return (
    <div
      className={['relative', className].filter(Boolean).join(' ')}
      style={{ height: RULER_H + WAVE_H + SCRUB_H }}
      role="img"
      aria-label="Master waveform"
      data-testid="master-waveform"
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      />
      {!sourceLoaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-muted-foreground">
          Load audio to see waveform
        </div>
      )}
    </div>
  )
}
