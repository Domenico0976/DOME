import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type { ChangeEvent } from 'react'
import { Play, Pause, Square, Repeat, Upload, Mic, Piano, Plus } from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { useAudio } from '../audio/useAudio'
import { connectMidi } from '../audio/midi'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'
import { resolveTool } from '../core/registry'
import { cn } from '../lib/utils'

interface AudioReactPanelProps {
  className?: string
}

const METER_CONFIG = [
  { key: 'bass' as const, label: 'B', color: 'from-red-500 to-orange-400' },
  { key: 'mid' as const, label: 'M', color: 'from-yellow-400 to-green-400' },
  { key: 'treble' as const, label: 'T', color: 'from-cyan-400 to-blue-500' },
  { key: 'level' as const, label: 'L', color: 'from-purple-400 to-pink-500' },
]

type MeterKey = (typeof METER_CONFIG)[number]['key']

export function AudioReactPanel({ className }: AudioReactPanelProps) {
  const audio = useAudio()
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const metersRef = useRef<Record<MeterKey, HTMLDivElement | null>>({
    bass: null,
    mid: null,
    treble: null,
    level: null,
  })

  // Store state
  const source = useProjectStore((s) => s.audio.source)
  const fileName = useProjectStore((s) => s.audio.fileName)
  const midiEnabled = useProjectStore((s) => s.audio.midi.enabled)
  const enableMidi = useProjectStore((s) => s.enableMidi)
  const bpm = useProjectStore((s) => s.timeline.bpm)
  const setBpm = useProjectStore((s) => s.setBpm)
  const playing = useProjectStore((s) => s.timeline.playing)
  const setPlaying = useProjectStore((s) => s.setPlaying)
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const durationSec = useProjectStore((s) => s.timeline.durationSec)
  const setTime = useProjectStore((s) => s.setTime)
  const stack = useProjectStore((s) => s.stack)

  // Local state
  const [midiBusy, setMidiBusy] = useState(false)
  const [loop, setLoop] = useState(false)
  const [, setTapTimes] = useState<number[]>([])
  const [disabledBindings, setDisabledBindings] = useState<Set<string>>(new Set())

  // Refs for rAF loop to avoid effect restarts
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const timeSecRef = useRef(timeSec)
  timeSecRef.current = timeSec
  const durationSecRef = useRef(durationSec)
  durationSecRef.current = durationSec
  const sourceRef = useRef(source)
  sourceRef.current = source

  // Presets derived from stack audio bindings
  const presets = useMemo(() => {
    const result: Array<{
      id: string
      toolId: string
      toolName: string
      param: string
      reactTo: string
      sensitivity: number
      enabled: boolean
    }> = []
    for (const item of stack) {
      for (const binding of item.audio) {
        const tool = resolveTool(item.toolId, item.toolVersion)
        const key = `${item.uid}-${binding.param}`
        result.push({
          id: key,
          toolId: item.toolId,
          toolName: tool?.label ?? item.toolId,
          param: binding.param,
          reactTo: binding.source,
          sensitivity: binding.amount,
          enabled: !disabledBindings.has(key),
        })
      }
    }
    return result
  }, [stack, disabledBindings])

  const togglePreset = useCallback((id: string) => {
    setDisabledBindings((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const onFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) audio.enableFile(f)
    },
    [audio],
  )

  const onMidi = useCallback(async () => {
    setMidiBusy(true)
    const ok = await connectMidi()
    if (ok) enableMidi()
    setMidiBusy(false)
  }, [enableMidi])

  const onTapTempo = useCallback(() => {
    const now = Date.now()
    setTapTimes((prev) => {
      const recent = prev.filter((t) => now - t < 2000)
      const next = [...recent, now]
      if (next.length >= 2) {
        const intervals: number[] = []
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1])
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const newBpm = Math.round(60000 / avg)
        if (newBpm >= 20 && newBpm <= 300) {
          setBpm(newBpm)
        }
      }
      return next
    })
  }, [setBpm])

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || durationSecRef.current <= 0) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      const newTime = Math.max(0, Math.min(durationSecRef.current, ratio * durationSecRef.current))
      setTime(newTime)
    },
    [setTime],
  )

  const handleStop = useCallback(() => {
    setPlaying(false)
    setTime(0)
  }, [setPlaying, setTime])

  // Animation loop for waveform and meters
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
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const frame = audio.readFrame(bpmRef.current)

      // Update meters via refs (avoids React re-renders every frame)
      for (const meter of METER_CONFIG) {
        const el = metersRef.current[meter.key]
        if (el) {
          el.style.height = `${Math.min(100, frame[meter.key] * 100)}%`
        }
      }

      ctx.clearRect(0, 0, width, height)

      if (sourceRef.current === null) {
        ctx.fillStyle = '#888'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Load audio to see waveform', width / 2, height / 2)
      } else {
        const spectrum = frame.spectrum
        if (spectrum.length > 0) {
          const barWidth = width / spectrum.length
          for (let i = 0; i < spectrum.length; i++) {
            const value = spectrum[i]
            const barHeight = value * height
            const x = i * barWidth
            const y = height - barHeight

            const gradient = ctx.createLinearGradient(0, height, 0, 0)
            gradient.addColorStop(0, 'rgba(100, 149, 237, 0.3)')
            gradient.addColorStop(1, 'rgba(100, 149, 237, 0.8)')
            ctx.fillStyle = gradient
            ctx.fillRect(x, y, Math.max(barWidth - 0.5, 0.5), barHeight)
          }
        }
      }

      // Play position indicator line
      if (durationSecRef.current > 0) {
        const x = (timeSecRef.current / durationSecRef.current) * width
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [audio])

  return (
    <footer
      className={cn('flex items-stretch gap-3 border-t border-border bg-surface px-3 h-[120px]', className)}
      aria-label="Audio Reactivity Panel"
    >
      {/* Left column: Transport, Source, BPM */}
      <div className="flex flex-col justify-between py-2 w-[140px] shrink-0">
        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Play/Pause"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Stop"
            onClick={handleStop}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={loop ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            aria-label="Loop"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            <Repeat className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Source buttons */}
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            {source === 'file' ? (fileName ?? 'audio') : 'Load'}
          </Button>
          <Button
            variant={source === 'mic' ? 'default' : 'secondary'}
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => audio.enableMic()}
            aria-pressed={source === 'mic'}
          >
            <Mic className="h-3 w-3" />
          </Button>
          <Button
            variant={midiEnabled ? 'default' : 'secondary'}
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={midiBusy || midiEnabled}
            onClick={onMidi}
          >
            <Piano className="h-3 w-3" />
          </Button>
        </div>

        {/* BPM display with tap tempo */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">BPM</div>
            <input
              aria-label="BPM"
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-center font-mono text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="secondary" size="sm" className="h-7 px-2 text-[11px]" onClick={onTapTempo}>
            Tap
          </Button>
        </div>
      </div>

      {/* Center: Waveform visualization + Timeline */}
      <div className="flex-1 flex flex-col py-2 min-w-0">
        <div className="flex-1 relative rounded-md overflow-hidden bg-surface-2 border border-border">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-pointer"
            onClick={onCanvasClick}
          />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Slider
            min={0}
            max={durationSec}
            step={0.1}
            value={[timeSec]}
            onValueChange={(v) => setTime(v[0])}
            className="flex-1"
          />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-[60px] text-right shrink-0">
            {`${timeSec.toFixed(1)}s / ${durationSec.toFixed(1)}s`}
          </span>
        </div>
      </div>

      {/* Right: Presets list + Audio meters */}
      <div className="flex gap-3 py-2 w-[280px] shrink-0">
        {/* Presets */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Presets</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Add Preset">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto border border-border rounded-md bg-surface-2">
            {presets.length === 0 ? (
              <div className="p-2 text-[11px] text-muted-foreground text-center">No presets</div>
            ) : (
              <div className="divide-y divide-border">
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center gap-2 px-2 py-1 text-[11px]">
                    <button
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        preset.enabled ? 'bg-green-500' : 'bg-gray-500',
                      )}
                      onClick={() => togglePreset(preset.id)}
                      aria-label={preset.enabled ? 'Disable preset' : 'Enable preset'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{preset.toolName}</div>
                      <div className="truncate text-muted-foreground">
                        {preset.param} &rarr; {preset.reactTo} ({Math.round(preset.sensitivity * 100)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meters */}
        <div className="flex gap-1 w-[40px] shrink-0">
          {METER_CONFIG.map((meter) => (
            <div key={meter.key} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="flex-1 w-full relative bg-surface-2 rounded-sm overflow-hidden">
                <div
                  ref={(el) => {
                    metersRef.current[meter.key] = el
                  }}
                  className={cn('absolute bottom-0 left-0 right-0 bg-gradient-to-t', meter.color)}
                  style={{ height: '0%' }}
                />
              </div>
              <span className="text-[8px] text-muted-foreground uppercase">{meter.label}</span>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
