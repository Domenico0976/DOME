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
  Volume2,
  VolumeX,
  Download,
  Camera,
  Music2,
  Maximize2,
  RotateCcw,
  MoreHorizontal,
  Trash2,
  ChevronUp,
  Info,
  BookOpen,
  Video,
  Users,
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
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { AudioReactivePanel } from './AudioReactivePanel'
import { PresetRail } from './PresetRail'
import { PresetMegaMenu } from './PresetMegaMenu'
import { MasterWaveform } from './MasterWaveform'
import { useExportActions, computeRasterForced, computeGpuForced } from './exportActions'
import { cn } from '../lib/utils'

const SOUNDBAR_COLLAPSED = 101
const SOUNDBAR_BODY_MIN = 160
const SOUNDBAR_BODY_MAX = 480
const SOUNDBAR_BODY_DEFAULT = 289

interface AudioReactPanelProps {
  className?: string
  onFocusParam?: (focus: string | null) => void
  creatorOpen?: boolean
}

const METER_CONFIG = [
  { key: 'bass' as const, label: 'Bass', short: 'B', token: '--audio-meter-fill-bass' },
  { key: 'mid' as const, label: 'Mid', short: 'M', token: '--audio-meter-fill-mid' },
  { key: 'treble' as const, label: 'Treble', short: 'T', token: '--audio-meter-fill-treble' },
  { key: 'level' as const, label: 'Level', short: 'L', token: '--audio-meter-fill-level' },
]

type MeterKey = (typeof METER_CONFIG)[number]['key']

const PILL = 'flex h-9 items-center gap-1.5 rounded-[8px] border border-border bg-surface-2 px-2 text-[13px]'

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
function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0:00'
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

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

export function AudioReactPanel({ className, onFocusParam, creatorOpen: creatorOpenProp }: AudioReactPanelProps) {
  const audio = useAudio()
  const { toast } = useToast()
  const { png, instagram, spotify, fullscreen, resetView } = useExportActions()
  const fileRef = useRef<HTMLInputElement>(null)
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
  const quarantined = useProjectStore((s) => s.quarantined ?? [])
  const midiEnabled = useProjectStore((s) => s.audio.midi.enabled)
  const enableMidi = useProjectStore((s) => s.enableMidi)
  const bpm = useProjectStore((s) => s.timeline.bpm)
  const setBpm = useProjectStore((s) => s.setBpm)
  const playing = useProjectStore((s) => s.timeline.playing)
  const setPlaying = useProjectStore((s) => s.setPlaying)
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const durationSec = useProjectStore((s) => s.timeline.durationSec)
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const selectTool = useProjectStore((s) => s.selectTool)
  const setAudioSource = useProjectStore((s) => s.setAudioSource)
  const setAudioFileName = useProjectStore((s) => s.setAudioFileName)
  const volume = useProjectStore((s) => s.audio.volume ?? 1)
  const setVolume = useProjectStore((s) => s.setVolume)

  // Badges computed from the current stack (moved from ExportMenu, byte-identical logic).
  const rasterForced = computeRasterForced(stack)
  const gpuForced = computeGpuForced(stack)

  // Local state
  const [midiBusy, setMidiBusy] = useState(false)
  const [loop, setLoop] = useState(false)
  const [, setTapTimes] = useState<number[]>([])
  const [creatorOpen, setCreatorOpen] = useState(creatorOpenProp ?? false)
  const [megaOpen, setMegaOpen] = useState(false)
  const megaRestoreRef = useRef<{
    hoveredLayerUid?: string | null
    hoveredEffectUid?: string | null
    scrollTops?: { [key: string]: number }
  }>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [slotOpen, setSlotOpen] = useState(false)
  const [bodyHeight, setBodyHeight] = useState(SOUNDBAR_BODY_DEFAULT)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const [prevVolume, setPrevVolume] = useState(1)
  const [driver, setDriver] = useState<'bass' | 'mid' | 'treble' | 'level' | 'spectrum' | 'bpm'>('bass')
  const [targetParam, setTargetParam] = useState('')
  const [amount, setAmount] = useState(1)

  // Refs for rAF loop to avoid effect restarts
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  // Live binding count for the Audio Reactive badge (row list lives in PresetRail)
  const bindingCount = stack.reduce((k, i) => k + i.audio.length, 0)

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

  const onSeek = useCallback(
    (t: number) => {
      audio.seek(t)
    },
    [audio],
  )

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startHeight: bodyHeight }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }, [bodyHeight])

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const next = d.startHeight + (d.startY - e.clientY)
    setBodyHeight(Math.max(SOUNDBAR_BODY_MIN, Math.min(SOUNDBAR_BODY_MAX, next)))
  }, [])

  const onResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }, [])

  const handleStop = useCallback(() => {
    audio.pause()
    audio.seek(0)
  }, [audio])

  const handleRemoveAudio = useCallback(() => {
    audio.pause()
    setPlaying(false)
    setAudioSource(null)
    setAudioFileName(undefined)
    toast('Audio removed — bindings are kept but silent', { kind: 'warning' })
  }, [audio, setPlaying, setAudioSource, setAudioFileName, toast])

  const handlePickMegaMenu = useCallback(
    (itemUid: string, param: string) => {
      selectTool(itemUid)
      setTargetParam(param)
      setCreatorOpen(true)
      setMegaOpen(false)
      onFocusParam?.(param)
    },
    [selectTool, onFocusParam],
  )

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

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const frame = audio.readFrame(bpmRef.current)
      for (const meter of METER_CONFIG) {
        const el = metersRef.current[meter.key]
        if (el) {
          el.style.height = `${Math.min(100, frame[meter.key] * 100)}%`
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [audio])

  useEffect(() => {
    const value = slotOpen ? `${SOUNDBAR_COLLAPSED + bodyHeight}px` : `${SOUNDBAR_COLLAPSED}px`
    document.documentElement.style.setProperty('--soundbar-height', value)
    return () => {
      document.documentElement.style.removeProperty('--soundbar-height')
    }
  }, [slotOpen, bodyHeight])

  return (
    <footer
      ref={footerRef}
      className={cn('relative flex shrink-0 flex-col border-t border-border bg-surface-panel', className)}
      style={{ '--soundbar-height': slotOpen ? `${SOUNDBAR_COLLAPSED + bodyHeight}px` : `${SOUNDBAR_COLLAPSED}px` } as React.CSSProperties}
      aria-label="Audio Reactivity Panel"
      onKeyDown={onFooterKeyDown}
    >
      {/* Tips row — 44px */}
      <div className="flex h-11 shrink-0 items-center justify-between px-4">
        <span className="text-[13px] text-muted-foreground">Tips &amp; tricks</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 w-[100px] rounded-[8px] text-[13px]" aria-label="Get support">
              <Info className="h-[18px] w-[18px]" />
              Support
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Help &amp; resources</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <BookOpen className="h-4 w-4" />
              Guides
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Video className="h-4 w-4" />
              Video tutorials
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Users className="h-4 w-4" />
              Community
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main bar — 57px */}
      <div className="relative flex h-[57px] shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
        {/* LEFT — reactive access + overflow */}
        <div className="flex shrink-0 items-center gap-1">
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
          <Button
            variant={slotOpen ? 'audio' : 'secondary'}
            size="sm"
            className="h-8 rounded-[8px] px-3 text-[13px]"
            aria-label={bindingCount > 0 ? `Audio Reactive, ${bindingCount} bindings` : 'Audio Reactive, no bindings'}
            aria-pressed={slotOpen}
            onClick={() => setSlotOpen((v) => !v)}
          >
            <Music2 className="h-3.5 w-3.5" />
            Audio Reactive{bindingCount > 0 ? ` · ${bindingCount}` : ''}
            {quarantined.length > 0 && (
              <Badge variant="warning" className="h-4 min-w-4 px-1 text-[10px]">
                {quarantined.length}
              </Badge>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-[8px]" aria-label="Audio options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-[200px]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Audio</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Replace audio
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleRemoveAudio}>
                    <Trash2 className="h-4 w-4" />
                    Remove audio
                  </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* CENTER — transport + source + time + bpm */}
        <div className="flex flex-1 items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-[8px] border border-border bg-surface-2"
            aria-label="Stop"
            onClick={handleStop}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
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

          <div className="min-w-0 max-w-[150px]">
            {source === null ? (
              <Button
                variant="secondary"
                size="sm"
                className={cn(PILL, 'max-w-full text-[13px]')}
                aria-label="Add audio"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">Add audio</span>
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={`Replace audio track ${fileName ?? 'audio'}`}
                title={`${fileName ?? 'audio'} · ${formatDuration(durationSec)}`}
                className={cn(PILL, 'w-full justify-start')}
              >
                {source === 'mic' ? <Mic className="h-4 w-4 shrink-0" /> : <Music2 className="h-4 w-4 shrink-0" />}
                <span className="truncate text-[13px] font-medium">{source === 'mic' ? 'Microphone' : (fileName ?? 'audio')}</span>
              </button>
            )}
          </div>

          <div className={cn(PILL, 'shrink-0 gap-2 font-mono tabular-nums')}>
            <span className="text-[14px] font-semibold text-foreground">{formatDuration(timeSec)}</span>
            <span className="text-[10px] font-semibold text-muted-foreground">{formatDuration(durationSec)}</span>
          </div>

          <div className={cn(PILL, 'shrink-0 gap-1')}>
            <input
              aria-label="BPM"
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-[52px] bg-transparent font-mono text-[14px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[10px] font-semibold text-muted-foreground">BPM</span>
          </div>

          <Button
            variant={source === 'mic' ? 'default' : 'secondary'}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-[8px]"
            aria-label="Microphone"
            aria-pressed={source === 'mic'}
            onClick={() => audio.enableMic()}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" className="h-9 shrink-0 rounded-[8px] text-[13px]" aria-label="Tap tempo" onClick={onTapTempo}>
            Tap
          </Button>
        </div>

        {/* RIGHT — loop + export + slot toggle */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant={loop ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 shrink-0 rounded-[8px]"
            aria-label="Loop"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            <Repeat className="h-4 w-4" />
          </Button>

          <Button
            variant={midiEnabled ? 'audio' : 'outline'}
            size="sm"
            className="h-8 shrink-0 rounded-[8px] text-[13px]"
            aria-label="MIDI"
            aria-pressed={midiEnabled}
            disabled={midiBusy || midiEnabled}
            onClick={onMidi}
          >
            <Piano className="h-4 w-4" />
            MIDI
          </Button>

          <div className="flex shrink-0 items-center gap-1.5">
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
                <Button size="sm" className="h-8 shrink-0 rounded-[8px] px-3">
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

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-label={slotOpen ? 'Collapse panel' : 'Expand panel'}
            aria-expanded={slotOpen}
            onClick={() => setSlotOpen((v) => !v)}
          >
            <ChevronUp className={cn('h-4 w-4 transition-transform', slotOpen && 'rotate-180')} />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'shrink-0 overflow-hidden border-t border-border transition-[height] duration-200',
          slotOpen ? '' : 'h-0 border-t-0',
        )}
        style={slotOpen ? { height: bodyHeight } : undefined}
      >
        <div className="flex flex-col" style={{ height: slotOpen ? bodyHeight : SOUNDBAR_BODY_DEFAULT }}>
          {slotOpen && (
            <div
              data-testid="soundbar-resize"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize soundbar"
              className="flex h-[10px] w-full shrink-0 cursor-row-resize items-center justify-center border-b border-border bg-surface-2"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
            >
              <div className="h-[2px] w-8 rounded-full bg-border" />
            </div>
          )}
          <div className="flex min-h-0 flex-1 gap-3 px-3 pb-2">
            <div className="flex-[6] min-w-0">
              <PresetRail
                stack={stack}
                selected={selected}
                targetOptions={targetOptions}
                driver={driver}
                setDriver={setDriver}
                targetParam={targetParam}
                setTargetParam={setTargetParam}
                amount={amount}
                setAmount={setAmount}
                creatorOpen={creatorOpen}
                setCreatorOpen={setCreatorOpen}
                megaOpen={megaOpen}
                onOpenMegaMenu={(focus?: { hoveredLayerUid?: string; hoveredEffectUid?: string }) => {
                  if (focus) megaRestoreRef.current = { ...megaRestoreRef.current, ...focus }
                  setMegaOpen((v) => !v)
                }}
                onFocusParam={onFocusParam}
                className="h-full"
              />
            </div>

            <div className="flex min-w-0 flex-[4] flex-col py-2">
              <div className="mb-1 flex items-center">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Waveform
                </span>
              </div>
              <MasterWaveform
                timeSec={timeSec}
                durationSec={durationSec}
                sourceLoaded={source !== null}
                onSeek={onSeek}
                className="min-h-0 shrink-0 overflow-hidden rounded-[8px] border border-border"
              />
              <div className="mt-1 flex items-center gap-2">
                <div className="flex w-full items-center gap-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Volume settings">
                        {volume === 0 ? (
                          <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" sideOffset={6} className="w-56">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium">Volume</span>
                        <span className="font-mono text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2 h-7 w-full text-[11px]"
                        onClick={() => {
                          if (volume === 0) setVolume(prevVolume || 1)
                          else {
                            setPrevVolume(volume)
                            setVolume(0)
                          }
                        }}
                      >
                        {volume === 0 ? 'Unmute' : 'Mute'}
                      </Button>
                      <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
                        Listen-only: volume never affects audio reactivity.
                      </p>
                    </PopoverContent>
                  </Popover>
                  <Slider
                    aria-label="Volume"
                    min={0}
                    max={100}
                    step={1}
                    value={[Math.round(volume * 100)]}
                    onValueChange={([v]) => setVolume(v / 100)}
                    className="min-w-0 flex-1"
                  />
                  <span className="w-[34px] shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" data-testid="audio-status">
                {diag}
              </div>
            </div>

            <div className="flex w-[40px] shrink-0 gap-1 py-2" role="img" aria-label="Live audio levels: bass, mid, treble, level">
              {METER_CONFIG.map((meter) => (
                <div key={meter.key} className="flex flex-1 flex-col items-center gap-0.5" title={meter.label}>
                  <div className="relative w-full flex-1 overflow-hidden rounded-sm bg-surface-2">
                    <div
                      ref={(el) => {
                        metersRef.current[meter.key] = el
                      }}
                      className="absolute inset-x-0 bottom-0"
                      style={{ height: '0%', background: `hsl(var(${meter.token}))` }}
                    />
                  </div>
                  <span className="text-[8px] uppercase text-muted-foreground" aria-hidden="true">{meter.short}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {megaOpen && (
        <PresetMegaMenu
          onPick={handlePickMegaMenu}
          onClose={() => setMegaOpen(false)}
          initialState={megaRestoreRef.current}
          onHoverChange={(s) => {
            megaRestoreRef.current = { ...megaRestoreRef.current, ...s }
          }}
          onSaveScroll={(scrollTops) => {
            megaRestoreRef.current = { ...megaRestoreRef.current, scrollTops }
          }}
        />
      )}
      {panelOpen && <AudioReactivePanel onClose={() => setPanelOpen(false)} />}
    </footer>
  )
}
