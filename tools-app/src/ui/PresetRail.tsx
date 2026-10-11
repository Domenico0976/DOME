import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { useAudio } from '../audio/useAudio'
import { Button } from '../components/ui/button'
import { Plus, Pencil, Trash2, LayoutGrid, ChevronDown } from 'lucide-react'
import { useToast } from './Toast'
import { PresetWaveform } from './PresetWaveform'
import { PresetSettingsFields } from './PresetSettingsFields'
import { cn } from '../lib/utils'
import type { AudioBinding, StackItem } from '../core/types'

const HISTORY_LEN = 56

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

export interface PresetTargetOption {
  key: string
  label: string
}

interface PresetRailProps {
  stack: StackItem[]
  selected: StackItem | null
  targetOptions: PresetTargetOption[]
  driver: AudioBinding['source']
  setDriver: (d: AudioBinding['source']) => void
  targetParam: string
  setTargetParam: (v: string) => void
  amount: number
  setAmount: (v: number) => void
  creatorOpen: boolean
  setCreatorOpen: React.Dispatch<React.SetStateAction<boolean>>
  onOpenMegaMenu: () => void
  className?: string
}

export function PresetRail({
  stack,
  selected,
  targetOptions,
  driver,
  setDriver,
  targetParam,
  setTargetParam,
  amount,
  setAmount,
  creatorOpen,
  setCreatorOpen,
  onOpenMegaMenu,
  className,
}: PresetRailProps) {
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const removeAudioBinding = useProjectStore((s) => s.removeAudioBinding)
  const selectTool = useProjectStore((s) => s.selectTool)
  const setBindingMuted = useProjectStore((s) => s.setBindingMuted)
  const mutedIds = useProjectStore((s) => s.audio.disabledAudioBindings ?? [])
  const bpm = useProjectStore((s) => s.timeline.bpm)
  const { toast } = useToast()
  const audio = useAudio()

  const canvasEls = useRef(new Map<string, HTMLCanvasElement>())
  const history = useRef(new Map<string, number[]>())

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
          enabled: !mutedIds.includes(key),
          itemUid: item.uid,
        })
      }
    }
    return result
  }, [stack, mutedIds])

  const registerCanvas = (id: string, el: HTMLCanvasElement | null) => {
    if (el) canvasEls.current.set(id, el)
    else {
      canvasEls.current.delete(id)
      history.current.delete(id)
    }
  }

  useEffect(() => {
    if (presets.length === 0) return
    let raf = 0
    const root = typeof document !== 'undefined' ? document.documentElement : null
    const played = root ? getComputedStyle(root).getPropertyValue('--soundbar-waveform-played').trim() || '#b8d94a' : '#b8d94a'
    const draw = () => {
      const frame = audio.readFrame(bpm)
      const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
      for (const p of presets) {
        const el = canvasEls.current.get(p.id)
        if (!el) continue
        const w = Math.max(1, el.clientWidth)
        const h = 28
        if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
          el.width = Math.round(w * dpr)
          el.height = Math.round(h * dpr)
        }
        const ctx = el.getContext('2d')
        if (!ctx) continue
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        const buf = history.current.get(p.id) ?? []
        buf.push(sourceValue(frame, p.reactTo as AudioBinding['source']))
        if (buf.length > HISTORY_LEN) buf.shift()
        history.current.set(p.id, buf)
        if (buf.length < 2) continue
        ctx.beginPath()
        buf.forEach((v, i) => {
          const x = (i / (HISTORY_LEN - 1)) * w
          const y = h - 2 - Math.max(0, Math.min(1, v)) * (h - 4)
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

  const togglePreset = (id: string) => {
    setBindingMuted(id, !mutedIds.includes(id))
  }

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateBinding = (itemUid: string, param: string, patch: Partial<AudioBinding>) => {
    const item = useProjectStore.getState().stack.find((i) => i.uid === itemUid)
    const current = item?.audio.find((b) => b.param === param)
    if (!item || !current) return
    addAudioBinding(itemUid, { ...current, ...patch })
  }

  const handleEdit = (itemUid: string, param: string, sourceKey: string, amountValue: number) => {
    selectTool(itemUid)
    setTargetParam(param)
    setDriver(sourceKey as AudioBinding['source'])
    setAmount(amountValue)
    setCreatorOpen(true)
  }

  return (
    <div className={cn('flex min-h-0 flex-col py-2', className)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Presets · {presets.length}</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            aria-label="Browse scene presets"
            title="Browse scene elements"
            onClick={onOpenMegaMenu}
          >
            <LayoutGrid className="h-3 w-3" />
          </Button>
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
              <PresetSettingsFields driver={driver} setDriver={setDriver} amount={amount} setAmount={setAmount} />
              {(() => {
                const key = targetParam || targetOptions[0]?.key
                const clash = key ? selected.audio.find((b) => b.param === key && b.source !== driver) : undefined
                return clash ? (
                  <p className="text-[11px] leading-tight text-warning" role="note">
                    Replaces existing {clash.source} → {key} modulation.
                  </p>
                ) : null
              })()}
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-full text-[11px]"
                disabled={!selected}
                onClick={() => {
                  const key = targetParam || targetOptions[0]?.key
                  if (!selected || !key) return
                  const existing = selected.audio.find((b) => b.param === key)
                  addAudioBinding(selected.uid, { param: key, source: driver, curve: 'linear', amount })
                  setCreatorOpen(false)
                  if (existing && existing.source !== driver) {
                    toast(`Updated ${key}: ${existing.source} → ${driver} (one modulation per parameter)`, {
                      kind: 'warning',
                    })
                  }
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
                <div key={preset.id} className="flex flex-col gap-1 px-2 py-1.5 text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      className="grid h-7 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleExpanded(preset.id)}
                      aria-expanded={expanded.has(preset.id)}
                      aria-label={expanded.has(preset.id) ? `Collapse ${preset.param} settings` : `Expand ${preset.param} settings`}
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${expanded.has(preset.id) ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => togglePreset(preset.id)}
                      aria-label={preset.enabled ? `Mute ${preset.param} modulation` : `Unmute ${preset.param} modulation`}
                      aria-pressed={preset.enabled}
                      title={preset.enabled ? 'Mute' : 'Unmute'}
                    >
                      <span
                        className={cn('h-2 w-2 rounded-full', preset.enabled ? 'bg-green-500' : 'bg-gray-500')}
                        aria-hidden="true"
                      />
                    </button>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit ${preset.param} binding`}
                      title="Edit in creator"
                      onClick={() => handleEdit(preset.itemUid, preset.param, preset.reactTo, preset.sensitivity)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-danger"
                      aria-label={`Remove ${preset.param} binding`}
                      title="Remove binding"
                      onClick={() => removeAudioBinding(preset.itemUid, preset.param)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <PresetWaveform
                    presetId={preset.id}
                    param={preset.param}
                    source={preset.reactTo as AudioBinding['source']}
                    amount={preset.sensitivity}
                    registerCanvas={registerCanvas}
                    onAmountChange={(v) => {
                      const st = useProjectStore.getState()
                      const item = st.stack.find((i) => i.uid === preset.itemUid)
                      const current = item?.audio.find((b) => b.param === preset.param)
                      if (!item || !current) return
                      addAudioBinding(preset.itemUid, { ...current, amount: v })
                    }}
                  />
                  {expanded.has(preset.id) && (
                    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                      <PresetSettingsFields
                        driver={preset.reactTo as AudioBinding['source']}
                        setDriver={(d) => updateBinding(preset.itemUid, preset.param, { source: d })}
                        amount={preset.sensitivity}
                        setAmount={(v) => updateBinding(preset.itemUid, preset.param, { amount: v })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
