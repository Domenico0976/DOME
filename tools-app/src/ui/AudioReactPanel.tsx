import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type { ChangeEvent } from 'react'
import {
  Play,
  Pause,
  Square,
  Repeat,
  Upload,
  Mic,
  Piano,
  Plus,
  Volume2,
  Download,
  Camera,
  Music2,
  Maximize2,
  RotateCcw,
} from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { useAudio } from '../audio/useAudio'
import { audioContextState, readBands } from '../audio/engine'
import { getAudioRuntime } from '../audio/runtime'
import { useToast } from './Toast'
import { connectMidi } from '../audio/midi'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'
import { Badge } from '../components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { resolveTool } from '../core/registry'
import { EFFECTS } from '../engine/effects'
import { useExportActions, computeRasterForced, computeGpuForced } from './exportActions'
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

function computeAudioDiag(): string {
  const ctxState = audioContextState()
  let fft = 'off'
  if (ctxState !== 'missing') {
    try {
      const b = readBands()
      fft = Math.max(b.bass, b.mid, b.treble, b.level) > 0.005 ? 'live' : 'silent'
    } catch {
      fft = 'err'
    }
  }
  const media = getAudioRuntime().media
  const el = !media ? 'none' : media.paused ? 'paused' : 'playing'
  const n = useProjectStore.getState().stack.reduce((k, i) => k + i.audio.length, 0)
  return `ctx:${ctxState} · fft:${fft} · el:${el} · bindings:${n}`
}

// Focus guard: don't hijack Space/L shortcuts on interactive or editable controls.
function isInteractiveOrEditable(el: HTMLElement | null): boolean {
  if (!el) return true
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return true
  const role = el.getAttribute('role')
  if (role && ['button', 'slider', 'menuitem', 'tab', 'switch', 'checkbox', 'option', 'link'].includes(role))
    return true
  return false
}

export function AudioReactPanel({ className }: AudioReactPanelProps) {
  const audio = useAudio()
  const { toast } = useToast()
  const { png, instagram, spotify, fullscreen, resetView } = useExportActions()
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const footerRef = useRef<HTMLElement>(null)
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
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const durationSec = useProjectStore((s) => s.timeline.durationSec)
  const setTime = useProjectStore((s) => s.setTime)
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const volume = useProjectStore((s) => s.audio.volume ?? 1)
  const setVolume = useProjectStore((s) => s.setVolume)

  // Badges computed from the current stack (moved from ExportMenu, byte-identical logic).
  const rasterForced = computeRasterForced(stack)
  const gpuForced = computeGpuForced(stack)

  // Local state
  const [midiBusy, setMidiBusy] = useState(false)
  const [loop, setLoop] = useState(false)
  const [, setTapTimes] = useState<number[]>([])
  const [disabledBindings, setDisabledBindings] = useState<Set<string>>(new Set())
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [driver, setDriver] = useState<'bass' | 'mid' | 'treble' | 'level' | 'spectrum' | 'bpm'>('bass')
  const [targetParam, setTargetParam] = useState('')
  const [amount, setAmount] = useState(1)

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
      itemUid: string
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
          itemUid: item.uid,
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

  const selected = stack.find((i) => i.uid === selectedUid) ?? null
  const targetOptions = useMemo(() => {
    if (!selected) return [] as Array<{ key: string; label: string }>
    const opts: Array<{ key: string; label: string }> = []
    const def = resolveTool(selected.toolId, selected.toolVersion)
    for (const c of def?.controls ?? []) {
      if (c.kind !== 'slider') continue
      opts.push({ key: c.param, label: `${def?.label ?? selected.toolId} · ${c.label}` })
    }
    for (const e of selected.effects ?? []) {
      const edef = EFFECTS[e.type]
      if (!edef) continue
      for (const c of edef.controls) {
        if (c.kind !== 'slider') continue
        opts.push({ key: `${e.uid}.${c.param}`, label: `${edef.label} · ${c.label}` })
      }
    }
    return opts
  }, [stack, selectedUid])

  const [diag, setDiag] = useState(() => computeAudioDiag())
  useEffect(() => {
    const id = window.setInterval(() => {
      setDiag((prev) => {
        const next = computeAudioDiag()
        return prev === next ? prev : next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const onFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) {
        audio.enableFile(f).catch((err) => {
          toast(err instanceof Error ? err.message : 'Could not load audio file', { kind: 'error' })
        })
      }
    },
    [audio, toast],
  )

  const onMidi = useCallback(async () => {
    setMidiBusy(true)
    try {
      const ok = await connectMidi()
      if (ok) enableMidi()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Microphone unavailable', { kind: 'error' })
    } finally {
      setMidiBusy(false)
    }
  }, [enableMidi, toast])

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
      audio.seek(newTime)
    },
    [audio],
  )

  const handleStop = useCallback(() => {
    audio.pause()
    audio.seek(0)
  }, [audio])

  // Footer-level keyboard shortcuts: Space = play/pause, L = loop toggle.
  // Focus guard: skip when the active element is an interactive/editable control.
  const onFooterKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (isInteractiveOrEditable(e.target as HTMLElement)) return
      if (e.key === ' ') {
        e.preventDefault()
        if (playing) {
          audio.pause()
        } else {
          void audio.play().catch((err) => {
            toast(err instanceof Error ? err.message : 'Audio playback failed', { kind: 'error' })
          })
        }
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setLoop((prev) => !prev)
      }
    },
    [audio, playing, toast],
  )

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
      ref={footerRef}
      className={cn('flex flex-col border-t border-border bg-surface px-3 h-[136px]', className)}
      aria-label="Audio Reactivity Panel"
      onKeyDown={onFooterKeyDown}
    >
      {/* Zone A — top row (44px): transport, source, BPM, volume, Download */}
      <div className="flex items-center gap-2 px-2 h-11 shrink-0">
        {/* Transport controls (32px) — Space=play/pause, L=loop */}
        <div className="flex items-center gap-1" role="group" aria-label="Transport">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Play/Pause"
            disabled={source === null}
            onClick={() => {
              if (playing) {
                audio.pause()
                return
              }
              void audio.play().catch((err) => {
                toast(err instanceof Error ? err.message : 'Audio playback failed', { kind: 'error' })
              })
            }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Stop" onClick={handleStop}>
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant={loop ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            aria-label="Loop"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>

        {/* Source buttons */}
        <div className="flex items-center gap-1" role="group" aria-label="Source">
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
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">BPM</span>
          <input
            aria-label="BPM"
            type="number"
            min={20}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="h-7 w-[72px] rounded-md border border-border bg-surface-2 px-2 text-center font-mono text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="secondary" size="sm" className="h-7 px-2 text-[11px]" onClick={onTapTempo}>
            Tap
          </Button>
        </div>

        {/* Volume (listen-only: never affects reactivity) */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Slider
            aria-label="Volume"
            min={0}
            max={100}
            step={1}
            value={[Math.round(volume * 100)]}
            onValueChange={([v]) => setVolume(v / 100)}
            className="flex-1 min-w-0"
          />
        </div>

        {/* Download — single dropdown with badges before the trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="h-8 px-3">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-[200px]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Export</DropdownMenuLabel>
                <DropdownMenuItem onSelect={png}>
                  <Download className="h-4 w-4" />
                  PNG
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={instagram}>
                  <Camera className="h-4 w-4" />
                  Instagram
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={spotify}>
                  <Music2 className="h-4 w-4" />
                  Spotify Canvas
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>View</DropdownMenuLabel>
                <DropdownMenuItem onSelect={fullscreen}>
                  <Maximize2 className="h-4 w-4" />
                  Fullscreen
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Project</DropdownMenuLabel>
                <DropdownMenuItem onSelect={resetView}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Zone B — unchanged: waveform/timeline/status + presets/creator/meters; 140px empty track-identity spacer */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[140px] shrink-0" />
        <div className="flex-1 flex flex-col py-2 min-w-0">
          <div className="flex-1 relative rounded-md overflow-hidden bg-surface-2 border border-border">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-pointer"
              onClick={onCanvasClick}
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span aria-label="Timeline" className="flex-1">
              {durationSec > 0 ? (
                <Slider
                  min={0}
                  max={durationSec}
                  step={0.1}
                  value={[timeSec]}
                  onValueChange={(v) => setTime(v[0])}
                  className="flex-1"
                  aria-valuetext={`${timeSec.toFixed(1)}s of ${durationSec.toFixed(1)}s`}
                />
              ) : (
                <div
                  className="h-8 rounded-md border border-border bg-surface-2"
                  aria-label="Timeline disabled, no audio loaded"
                />
              )}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-[60px] text-right shrink-0">
              {durationSec > 0 ? `${timeSec.toFixed(1)}s / ${durationSec.toFixed(1)}s` : `0.0s / 0.0s`}
            </span>
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" data-testid="audio-status">
            {diag}
          </div>
        </div>

        {/* Presets list + Audio meters */}
        <div className="flex gap-3 py-2 w-[280px] shrink-0">
          {/* Presets */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Presets</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Add Preset"
                aria-expanded={creatorOpen}
                onClick={() => setCreatorOpen((v) => !v)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {creatorOpen && (
              <div className="mb-1 space-y-2 rounded-md border border-border bg-surface p-2">
                {!selected || targetOptions.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">Select a layer to create an audio modulation.</div>
                ) : (
                  <>
                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Target parameter
                      <select
                        aria-label="Target parameter"
                        value={targetParam || targetOptions[0].key}
                        onChange={(e) => setTargetParam(e.target.value)}
                        className="mt-1 h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[12px] text-foreground"
                      >
                        {targetOptions.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Audio driver
                      <select
                        aria-label="Audio driver"
                        value={driver}
                        onChange={(e) => setDriver(e.target.value as typeof driver)}
                        className="mt-1 h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[12px] text-foreground"
                      >
                        {(['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm'] as const).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</span>
                        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                          {Math.round(amount * 100)}%
                        </span>
                      </div>
                      <Slider
                        aria-label="Amount"
                        min={0}
                        max={2}
                        step={0.05}
                        value={[amount]}
                        onValueChange={([v]) => setAmount(v)}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 w-full text-[11px]"
                      disabled={!selected}
                      onClick={() => {
                        const key = targetParam || targetOptions[0]?.key
                        if (!selected || !key) return
                        addAudioBinding(selected.uid, { param: key, source: driver, curve: 'linear', amount })
                      }}
                    >
                      Add modulation
                    </Button>
                  </>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto border border-border rounded-md bg-surface-2">
              {presets.length === 0 ? (
                <div className="p-2 text-[11px] text-muted-foreground text-center">No presets</div>
              ) : (
                <div className="divide-y divide-border">
                  {presets.map((preset) => {
                    const idx = stack.findIndex((i) => i.uid === preset.itemUid)
                    const label = idx >= 0 ? `#${idx} ${preset.toolName}` : preset.toolName
                    return (
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
                          <div className="truncate font-medium" title={label}>
                            {label}
                          </div>
                          <div
                            className="truncate text-muted-foreground"
                            title={`${preset.param} → ${preset.reactTo} (${Math.round(preset.sensitivity * 100)}%)`}
                          >
                            {preset.param} &rarr; {preset.reactTo} ({Math.round(preset.sensitivity * 100)}%)
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
      </div>
    </footer>
  )
}
