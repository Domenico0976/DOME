import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { EFFECTS } from '../engine/effects'
import { useAudio } from '../audio/useAudio'
import { Button } from '../components/ui/button'
import { Plus } from 'lucide-react'
import { PresetWaveform } from './PresetWaveform'
import { ReactToPanel } from './ReactToPanel'
import { RowKebab } from './RowKebab'
import { cn } from '../lib/utils'
import type { AudioBinding, StackItem } from '../core/types'

const HISTORY_LEN = 56
const GRID = 'minmax(0,200fr) minmax(0,150fr) minmax(0,130fr) minmax(0,120fr) minmax(0,200fr)'

function sourceValue(
  frame: { bass: number; mid: number; treble: number; level: number; spectrum: Float32Array; bpm: number },
  source: AudioBinding['source'],
): number {
  switch (source) {
    case 'bass':
    case 'mid':
    case 'treble':
    case 'level':
      return Math.max(0, Math.min(1, frame[source] ?? 0))
    case 'spectrum': {
      const s = frame.spectrum
      if (!s || s.length === 0) return 0
      let sum = 0
      for (let i = 0; i < s.length; i++) sum += s[i]
      return Math.max(0, Math.min(1, sum / s.length))
    }
    case 'bpm':
      return Math.max(0, Math.min(1, frame.bpm / 300))
  }
}

function naturalRange(item: StackItem, param: string): { min: number; max: number } | null {
  if (param.includes('.')) {
    const [euid, p] = param.split('.')
    const eff = (item.effects ?? []).find((e) => e.uid === euid)
    if (!eff) return null
    const def = EFFECTS[eff.type]
    const c = def?.controls.find((c) => c.param === p)
    return c && c.min !== undefined && c.max !== undefined ? { min: c.min, max: c.max } : null
  }
  const tool = resolveTool(item.toolId, item.toolVersion)
  const c = tool?.controls.find((c) => c.param === param)
  return c && c.min !== undefined && c.max !== undefined ? { min: c.min, max: c.max } : null
}

const clamp2 = (v: number) => Math.max(0, Math.min(2, v))

interface PresetRow {
  id: string
  toolName: string
  param: string
  reactTo: AudioBinding['source']
  sensitivity: number
  itemUid: string
  range?: { min: number; max: number }
  natural: { min: number; max: number } | null
}

interface PresetTableProps {
  className?: string
  stack: StackItem[]
  megaOpen: boolean
  onOpenMegaMenu: (focus?: { hoveredLayerUid?: string; hoveredEffectUid?: string }) => void
  onFocusParam?: (focus: string) => void
}

export function PresetTable({
  className,
  stack,
  megaOpen,
  onOpenMegaMenu,
  onFocusParam,
}: PresetTableProps) {
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const selectTool = useProjectStore((s) => s.selectTool)
  const bpm = useProjectStore((s) => s.timeline.bpm)
  const audio = useAudio()

  const canvasEls = useRef(new Map<string, HTMLCanvasElement>())
  const history = useRef(new Map<string, number[]>())
  const lastValue = useRef(new Map<string, number>())
  const [openRowId, setOpenRowId] = useState<string | null>(null)

  const presets = useMemo<PresetRow[]>(() => {
    const result: PresetRow[] = []
    for (const item of stack) {
      for (const binding of item.audio) {
        const tool = resolveTool(item.toolId, item.toolVersion)
        result.push({
          id: `${item.uid}-${binding.param}`,
          toolName: tool?.label ?? item.toolId,
          param: binding.param,
          reactTo: binding.source,
          sensitivity: binding.amount,
          itemUid: item.uid,
          range: binding.range,
          natural: naturalRange(item, binding.param),
        })
      }
    }
    return result
  }, [stack])

  const registerCanvas = (id: string, el: HTMLCanvasElement | null) => {
    if (el) canvasEls.current.set(id, el)
    else {
      canvasEls.current.delete(id)
      history.current.delete(id)
      lastValue.current.delete(id)
    }
  }

  useEffect(() => {
    if (presets.length === 0) return
    let raf = 0
    const root = typeof document !== 'undefined' ? document.documentElement : null
    const played = root
      ? getComputedStyle(root).getPropertyValue('--soundbar-waveform-played').trim() || '#b8d94a'
      : '#b8d94a'
    const draw = () => {
      const frame = audio.readFrame(bpm)
      const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
      for (const p of presets) {
        const el = canvasEls.current.get(p.id)
        if (!el) continue
        const v = sourceValue(frame, p.reactTo)
        const last = lastValue.current.get(p.id)
        if (last !== undefined && Math.abs(v - last) <= 0.01) continue
        lastValue.current.set(p.id, v)
        const w = Math.max(1, el.clientWidth)
        const h = 16
        if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
          el.width = Math.round(w * dpr)
          el.height = Math.round(h * dpr)
        }
        const ctx = el.getContext('2d')
        if (!ctx) continue
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        const buf = history.current.get(p.id) ?? []
        buf.push(v)
        if (buf.length > HISTORY_LEN) buf.shift()
        history.current.set(p.id, buf)
        if (buf.length < 2) continue
        ctx.beginPath()
        buf.forEach((val, i) => {
          const x = (i / (HISTORY_LEN - 1)) * w
          const y = h - 2 - Math.max(0, Math.min(1, val)) * (h - 4)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.strokeStyle = played
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [presets, bpm, audio])

  const updateBinding = (itemUid: string, param: string, patch: Partial<AudioBinding>) => {
    const item = stack.find((i) => i.uid === itemUid)
    const current = item?.audio.find((b) => b.param === param)
    if (!item || !current) return
    addAudioBinding(itemUid, { ...current, ...patch })
  }

  return (
    <div className={cn('flex min-h-0 flex-col border border-border rounded-md bg-surface-2', className)}>
      {/* Header 40px with column titles */}
      <div
        className="grid h-[40px] shrink-0 items-center border-b border-border px-1 text-[11px] font-medium text-muted-foreground"
        style={{ gridTemplateColumns: GRID }}
      >
        <div>Presets</div>
        <div>React to</div>
        <div>Sensitivity</div>
        <div>Value range</div>
        <div>EQ</div>
      </div>

      {/* Rows 55px each */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="p-2 text-center text-[11px] text-muted-foreground">No presets</div>
        ) : (
          <div className="divide-y divide-border">
            {presets.map((preset) => {
              const idx = stack.findIndex((i) => i.uid === preset.itemUid)
              const pct = Math.round(preset.sensitivity * 100)
              return (
                <div
                  key={preset.id}
                  className="grid h-[55px] shrink-0 items-center text-[11px]"
                  style={{ gridTemplateColumns: GRID }}
                >
                  {/* Cell 1: #N identity + param→source + sparkline */}
                  <div className="flex min-w-0 flex-col gap-0.5 px-1 py-1">
                    <div className="flex min-w-0 items-center gap-1">
                      <button
                        type="button"
                        className="truncate rounded px-1 text-left text-[11px] font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={`${preset.toolName} — open in mega menu`}
                        onClick={() => {
                          selectTool(preset.itemUid)
                          onFocusParam?.(preset.param)
                          onOpenMegaMenu({ hoveredLayerUid: preset.itemUid })
                        }}
                      >
                        #{idx} {preset.toolName}
                      </button>
                      <div className="ml-auto shrink-0">
                        <RowKebab kind="preset" itemUid={preset.itemUid} param={preset.param} />
                      </div>
                    </div>
                    <div
                      className="truncate text-[10px] text-muted-foreground"
                      title={`${preset.param} → ${preset.reactTo} (${pct}%)`}
                    >
                      {preset.param} → {preset.reactTo} ({pct}%)
                    </div>
                    <PresetWaveform
                      presetId={preset.id}
                      param={preset.param}
                      source={preset.reactTo}
                      amount={preset.sensitivity}
                      registerCanvas={registerCanvas}
                      onAmountChange={(v) => updateBinding(preset.itemUid, preset.param, { amount: v })}
                      className="h-4 w-full"
                    />
                  </div>

                  {/* Cell 2: React to */}
                  <div className="flex items-center px-1">
                    <ReactToPanel
                      open={openRowId === preset.id}
                      onOpenChange={(o) => setOpenRowId(o ? preset.id : null)}
                      source={preset.reactTo}
                      amount={preset.sensitivity}
                      rangeMin={preset.range?.min ?? preset.natural?.min ?? 0}
                      rangeMax={preset.range?.max ?? preset.natural?.max ?? 1}
                      rangeExplicit={!!preset.range}
                      onChangeSource={(s) => updateBinding(preset.itemUid, preset.param, { source: s })}
                      onChangeAmount={(v) => updateBinding(preset.itemUid, preset.param, { amount: v })}
                      onChangeRange={(min, max) =>
                        updateBinding(preset.itemUid, preset.param, { range: { min, max } })
                      }
                      triggerLabel={preset.reactTo}
                      triggerClassName="w-full"
                      param={preset.param}
                    />
                  </div>

                  {/* Cell 3: Sensitivity slider */}
                  <div className="flex items-center px-1">
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label={`Sensitivity for ${preset.param}`}
                      aria-valuemin={0}
                      aria-valuemax={200}
                      aria-valuenow={pct}
                      aria-valuetext={`${pct} percent`}
                      className="flex h-6 w-full cursor-ew-resize items-center rounded bg-surface-2/60 px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onKeyDown={(e) => {
                        const step = e.shiftKey ? 0.25 : 0.05
                        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                          e.preventDefault()
                          updateBinding(preset.itemUid, preset.param, {
                            amount: clamp2(preset.sensitivity + step),
                          })
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          updateBinding(preset.itemUid, preset.param, {
                            amount: clamp2(preset.sensitivity - step),
                          })
                        }
                      }}
                    >
                      <span className="font-mono text-[11px] tabular-nums">{pct}%</span>
                    </div>
                  </div>

                  {/* Cell 4: Value range */}
                  <div className="flex flex-col gap-0.5 px-1">
                    <input
                      type="number"
                      aria-label={`Range min for ${preset.param}`}
                      placeholder={String(preset.natural?.min ?? '')}
                      value={preset.range?.min ?? ''}
                      step="any"
                      className="h-[18px] w-full rounded border border-border bg-surface-2 px-1 text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onChange={(e) => {
                        const min = Number(e.target.value)
                        if (!Number.isFinite(min)) return
                        const max = preset.range?.max ?? preset.natural?.max ?? 1
                        updateBinding(preset.itemUid, preset.param, { range: { min, max } })
                      }}
                    />
                    <input
                      type="number"
                      aria-label={`Range max for ${preset.param}`}
                      placeholder={String(preset.natural?.max ?? '')}
                      value={preset.range?.max ?? ''}
                      step="any"
                      className="h-[18px] w-full rounded border border-border bg-surface-2 px-1 text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onChange={(e) => {
                        const max = Number(e.target.value)
                        if (!Number.isFinite(max)) return
                        const min = preset.range?.min ?? preset.natural?.min ?? 0
                        updateBinding(preset.itemUid, preset.param, { range: { min, max } })
                      }}
                    />
                  </div>

                  {/* Cell 5: EQ placeholder */}
                  <div
                    className="flex h-full items-center justify-center text-[11px] text-muted-foreground"
                    title="EQ coming soon"
                    aria-hidden="true"
                  >
                    —
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer 60px with centered Add Preset button */}
      <div className="flex h-[60px] shrink-0 items-center justify-center border-t border-border">
        <Button
          variant="default"
          size="sm"
          className="h-9 w-[120px]"
          aria-label="Add Preset"
          aria-controls="preset-cascade"
          aria-expanded={megaOpen}
          disabled={stack.length === 0}
          title={stack.length === 0 ? 'Add a tool first' : 'Add Preset'}
          onClick={() => onOpenMegaMenu()}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Preset
        </Button>
      </div>
    </div>
  )
}
