import { useState, useEffect, useRef } from 'react'
import { useProjectStore } from '../state/projectStore'
import { EFFECTS } from '../engine/effects'
import type { EffectType, EffectInstance, StackItem } from '../core/types'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Trash2, Plus, Sliders, RotateCcw, ChevronDown, ChevronUp, Droplets, Sparkles, Waves, Aperture, Hexagon } from 'lucide-react'

export function NodeOptionsEffects({ item, focusParam, onFocusParamClear }: { item: StackItem; focusParam?: string | null; onFocusParamClear?: () => void }) {
  const addEffect = useProjectStore((s) => s.addEffect)
  const removeEffect = useProjectStore((s) => s.removeEffect)
  const setEffectParam = useProjectStore((s) => s.setEffectParam)
  const toggleEffect = useProjectStore((s) => s.toggleEffect)
  const removeAudioBinding = useProjectStore((s) => s.removeAudioBinding)

  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set())
  const pendingFocusRef = useRef<string | null>(null)
  const matchedEffectUidRef = useRef<string | null>(null)

  const toggleCard = (uid: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  // Initialize first card open if none selected
  useEffect(() => {
    if (item.effects?.length && openCards.size === 0) {
      setOpenCards(new Set([item.effects[0].uid]))
    }
  }, [item.effects, openCards.size])

  useEffect(() => {
    if (!focusParam) return
    const effects = item.effects ?? []
    const matched = effects.find((e) => focusParam.startsWith(`${e.uid}.`))
    if (!matched) {
      console.warn(`NodeOptionsEffects: no effect matches focusParam "${focusParam}"`)
      matchedEffectUidRef.current = null
      onFocusParamClear?.()
      return
    }
    matchedEffectUidRef.current = matched.uid
    setOpenCards((prev) => {
      const next = new Set(prev)
      next.add(matched.uid)
      return next
    })
    pendingFocusRef.current = focusParam
  }, [focusParam, item.effects, onFocusParamClear])

  useEffect(() => {
    const key = pendingFocusRef.current
    if (!key) return
    const matched = matchedEffectUidRef.current
    if (!matched) return
    if (!openCards.has(matched)) return
    const row = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`) as HTMLElement | null
    const control = document.getElementById(key) as HTMLElement | null
    const target = row ?? control
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' })
    if (control) control.focus()
    pendingFocusRef.current = null
    matchedEffectUidRef.current = null
    onFocusParamClear?.()
  }, [openCards, onFocusParamClear, item.effects])

  const getEffectIcon = (type: EffectType) => {
    const iconMap: Record<EffectType, any> = {
      adjustments: Sliders,
      aberration: Droplets,
      glow: Sparkles,
      waves: Waves,
      edgeblur: Aperture,
      lens: Aperture,
      grain: Hexagon,
    }
    const Icon = iconMap[type] || Sliders
    return Icon
  }

  const getParamSummary = (e: EffectInstance) => {
    const def = EFFECTS[e.type]
    if (!def) return ''
    const sliders = def.controls.filter((c) => c.kind === 'slider')
    if (sliders.length === 0) return 'No parameters'
    const parts = sliders
      .map((c) => {
        const val = Number(e.params[c.param] ?? def.defaultParams[c.param])
        return `${c.label} ${val.toFixed(2)}`
      })
      .slice(0, 3)
    return parts.join(' · ')
  }

  return (
    <div className="space-y-3">
      <label htmlFor="add-effect-select" className="text-[12px] font-medium text-muted-foreground">
        Add effect
      </label>
      <Select value="" onValueChange={(v) => addEffect(item.uid, v as EffectType)}>
        <SelectTrigger id="add-effect-select" className="w-full" aria-label="Add effect">
          <Plus className="h-4 w-4" />
          <SelectValue placeholder="Add effect" />
        </SelectTrigger>
        <SelectContent>
          {(['adjustments', 'aberration', 'glow', 'waves', 'edgeblur', 'lens', 'grain'] as EffectType[]).map((t) => (
            <SelectItem key={t} value={t}>
              {EFFECTS[t]?.label ?? t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(item.effects ?? []).map((e) => {
        const def = EFFECTS[e.type]
        if (!def) return null
        const Icon = getEffectIcon(e.type)
        const isOpen = openCards.has(e.uid)
        const summary = getParamSummary(e)

        return (
          <div key={e.uid} data-enabled={e.enabled ? 'true' : 'false'} className="space-y-2 rounded-md border border-border bg-surface-2/50 p-3 data-[enabled=false]:opacity-55">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-medium">{def.label}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/80 truncate max-w-[200px]">{summary}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label="Reset effect"
                  onClick={() => {
                    for (const c of def.controls) {
                      setEffectParam(item.uid, e.uid, c.param, def.defaultParams[c.param])
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Switch
                  checked={e.enabled}
                  onCheckedChange={() => toggleEffect(item.uid, e.uid)}
                  aria-label={`Enable ${def.label}`}
                />
                <span className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
                  {e.enabled ? 'On' : 'Off'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger hover:text-danger"
                  aria-label="Remove effect"
                  onClick={() => removeEffect(item.uid, e.uid)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label="Collapse section"
                  onClick={() => toggleCard(e.uid)}
                >
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            {isOpen && (
              <div className="mt-3 space-y-2">
                {def.controls.map((c) => {
                  const key = `${e.uid}.${c.param}`
                  const binding = item.audio.find((b) => b.param === key)

                  return (
                    <div key={c.param} data-focus-key={key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={key} className="text-[12px] text-muted-foreground">
                          {c.label}
                        </label>
                        <div className="flex items-center gap-0.5">
                          {binding && (
                            <>
                              <span
                                className="flex items-center gap-1 text-[10px] text-primary/80"
                                title={`${binding.source} modulation`}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                Audio · {binding.source.charAt(0).toUpperCase() + binding.source.slice(1)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-danger hover:text-danger"
                                aria-label={`Disable modulation for ${c.label}`}
                                onClick={() => removeAudioBinding(item.uid, key)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {c.kind === 'slider' && (
                        <input
                          id={key}
                          type="range"
                          min={c.min}
                          max={c.max}
                          step={c.step}
                          value={Number(e.params[c.param] ?? def.defaultParams[c.param])}
                          onChange={(ev) => setEffectParam(item.uid, e.uid, c.param, Number(ev.target.value))}
                          className="w-full accent-[hsl(var(--primary))] cursor-pointer"
                          aria-valuetext={`${c.label}: ${Number(e.params[c.param] ?? def.defaultParams[c.param])}`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}