import { useEffect, useMemo, useState } from 'react'
import { X, Search, Plus } from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { readBands } from '../audio/engine'
import { AUDIO_RECIPES, PRESET_CATEGORIES, type AudioRecipe } from '../audio/presets'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Slider } from '../components/ui/slider'
import { cn } from '../lib/utils'

const DRIVERS = ['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm'] as const

function useSelectedItem() {
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  return stack.find((i) => i.uid === selectedUid) ?? null
}

function applyRecipe(recipe: AudioRecipe, itemUid: string): { applied: number; effectsAdded: string[] } {
  const effectsAdded: string[] = []
  let applied = 0
  for (const b of recipe.bindings) {
    const st = useProjectStore.getState()
    const item = st.stack.find((i) => i.uid === itemUid)
    if (!item) continue
    let eff = item.effects?.find((e) => e.type === b.effectType)
    if (!eff) {
      st.addEffect(itemUid, b.effectType)
      const next = useProjectStore.getState().stack.find((i) => i.uid === itemUid)
      eff = next?.effects?.filter((e) => e.type === b.effectType).pop()
      if (eff) effectsAdded.push(b.effectType)
    }
    if (!eff) continue
    st.addAudioBinding(itemUid, { param: `${eff.uid}.${b.param}`, source: b.source, curve: 'linear', amount: b.amount })
    applied += 1
  }
  return { applied, effectsAdded }
}

function recipeActiveOn(recipe: AudioRecipe, itemUid: string): boolean {
  const item = useProjectStore.getState().stack.find((i) => i.uid === itemUid)
  if (!item) return false
  return recipe.bindings.every((b) =>
    (item.effects ?? []).some(
      (e) =>
        e.type === b.effectType &&
        item.audio.some((a) => a.param === `${e.uid}.${b.param}` && a.source === b.source),
    ),
  )
}

function PresetsTab() {
  const selected = useSelectedItem()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof PRESET_CATEGORIES)[number]['id']>('all')

  const visible = AUDIO_RECIPES.filter(
    (r) =>
      (category === 'all' || r.category === category) &&
      (!query.trim() ||
        `${r.name} ${r.description} ${r.affects.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())),
  )

  if (!selected) {
    return <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">Select a layer to apply presets.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search presets</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search presets…"
          aria-label="Search presets"
          className="h-7 w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter presets by category">
        {PRESET_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              category === c.id ? 'bg-surface-2 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="py-4 text-center text-[12px] text-muted-foreground">No presets match.</p>}
      {visible.map((r) => (
        <PresetCard key={r.id} recipe={r} itemUid={selected.uid} />
      ))}
    </div>
  )
}

function PresetCard({ recipe, itemUid }: { recipe: AudioRecipe; itemUid: string }) {
  // Re-render on store change so Active state stays live
  useProjectStore((s) => s.stack)
  const active = recipeActiveOn(recipe, itemUid)

  const setAllAmounts = (v: number) => {
    const st = useProjectStore.getState()
    const item = st.stack.find((i) => i.uid === itemUid)
    if (!item) return
    for (const b of recipe.bindings) {
      const eff = item.effects?.find((e) => e.type === b.effectType)
      if (!eff) continue
      const existing = item.audio.find((a) => a.param === `${eff.uid}.${b.param}`)
      st.addAudioBinding(itemUid, {
        param: `${eff.uid}.${b.param}`,
        source: existing?.source ?? b.source,
        curve: existing?.curve ?? 'linear',
        amount: v,
      })
    }
  }

  const currentAmount = (() => {
    const item = useProjectStore.getState().stack.find((i) => i.uid === itemUid)
    const first = recipe.bindings[0]
    const eff = item?.effects?.find((e) => e.type === first.effectType)
    return item?.audio.find((a) => a.param === `${eff?.uid}.${first.param}`)?.amount ?? first.amount
  })()

  const removeAll = () => {
    const st = useProjectStore.getState()
    const item = st.stack.find((i) => i.uid === itemUid)
    if (!item) return
    for (const b of recipe.bindings) {
      const eff = item.effects?.find((e) => e.type === b.effectType)
      if (eff) st.removeAudioBinding(itemUid, `${eff.uid}.${b.param}`)
    }
  }

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-3.5"
      style={{ background: 'var(--preset-card-bg)', borderColor: 'var(--preset-card-border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">♪ {recipe.name}</span>
        {active && <Badge variant="audio">Active</Badge>}
      </div>
      <p className="text-[12px] leading-snug text-muted-foreground">{recipe.description}</p>
      <p className="text-[11px] text-muted-foreground">Affects: {recipe.affects.join(', ')}</p>
      {active ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Amount</span>
            <span className="font-mono text-[12px] tabular-nums" aria-live="polite">
              {Math.round(currentAmount * 100)}%
            </span>
          </div>
          <Slider
            aria-label={`${recipe.name} amount`}
            min={0}
            max={2}
            step={0.05}
            value={[currentAmount]}
            onValueChange={([v]) => setAllAmounts(v)}
          />
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" className="h-7 flex-1 text-[11px]" onClick={removeAll}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 flex-1 text-[11px]"
            onClick={() => applyRecipe(recipe, itemUid)}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  )
}

function BindingsTab() {
  const stack = useProjectStore((s) => s.stack)
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const removeAudioBinding = useProjectStore((s) => s.removeAudioBinding)

  const items = stack.filter((i) => i.audio.length > 0)
  if (items.length === 0) {
    return <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">No bindings yet — apply a preset or add one from the sound bar.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const def = resolveTool(item.toolId, item.toolVersion)
        const idx = stack.findIndex((i) => i.uid === item.uid)
        return (
          <div key={item.uid} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              #{idx} {def?.label ?? item.toolId}
            </span>
            {item.audio.map((b) => (
              <div key={b.param} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2/50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium" title={b.param}>
                    ♪ {b.param} → {b.source}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-danger"
                    aria-label={`Remove ${b.param} binding`}
                    onClick={() => removeAudioBinding(item.uid, b.param)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Amount</span>
                  <Slider
                    aria-label={`${b.param} amount`}
                    min={0}
                    max={2}
                    step={0.05}
                    value={[b.amount]}
                    onValueChange={([v]) => addAudioBinding(item.uid, { ...b, amount: v })}
                    className="flex-1"
                  />
                  <span className="w-[38px] text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {Math.round(b.amount * 100)}%
                  </span>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Driver
                  <select
                    aria-label={`${b.param} driver`}
                    value={b.source}
                    onChange={(e) =>
                      addAudioBinding(item.uid, { ...b, source: e.target.value as typeof b.source })
                    }
                    className="h-7 flex-1 rounded-md border border-border bg-surface-2 px-2 text-[12px] text-foreground"
                  >
                    {DRIVERS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function AnalyzerTab() {
  const source = useProjectStore((s) => s.audio.source)
  const [bands, setBands] = useState<{ bass: number; mid: number; treble: number; level: number } | null>(null)

  useEffect(() => {
    if (source === null) {
      setBands(null)
      return
    }
    const id = window.setInterval(() => {
      try {
        const b = readBands()
        setBands({ bass: b.bass, mid: b.mid, treble: b.treble, level: b.level })
      } catch {
        setBands(null)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [source])

  const bpm = useProjectStore((s) => s.timeline.bpm)

  const rows = useMemo(() => {
    if (!bands) return []
    return [
      { label: 'Bass', value: bands.bass },
      { label: 'Mid', value: bands.mid },
      { label: 'Treble', value: bands.treble },
      { label: 'Level', value: bands.level },
    ]
  }, [bands])

  if (!bands) {
    return <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">Load audio to observe live levels.</p>
  }

  return (
    <div className="flex flex-col gap-2" aria-live="off">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground">{r.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, Math.round(r.value * 100))}%`, background: 'var(--soundbar-reactive-text)' }}
            />
          </div>
          <span className="w-[38px] text-right font-mono text-[11px] tabular-nums text-muted-foreground">
            {Math.round(r.value * 100)}%
          </span>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Tempo <span className="font-mono tabular-nums text-foreground">{bpm}</span> BPM · observational only, never
        modifies the visual.
      </p>
    </div>
  )
}

export function AudioReactivePanel({ onClose }: { onClose: () => void }) {
  const stack = useProjectStore((s) => s.stack)
  const bindingCount = stack.reduce((k, i) => k + i.audio.length, 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-label="Audio Reactive"
      aria-modal="false"
      className="fixed bottom-[148px] right-4 z-50 flex max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-[14px] border shadow-2xl"
      style={{ background: 'var(--audio-panel-bg)', borderColor: 'var(--audio-panel-border)' }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold">Audio Reactive</span>
          {bindingCount > 0 && <Badge variant="audio">{bindingCount}</Badge>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close Audio Reactive" autoFocus onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Tabs defaultValue="presets" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="presets" className="flex-1">
              Presets
            </TabsTrigger>
            <TabsTrigger value="bindings" className="flex-1">
              Bindings{bindingCount > 0 ? ` (${bindingCount})` : ''}
            </TabsTrigger>
            <TabsTrigger value="analyzer" className="flex-1">
              Analyzer
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <TabsContent value="presets" className="mt-0">
            <PresetsTab />
          </TabsContent>
          <TabsContent value="bindings" className="mt-0">
            <BindingsTab />
          </TabsContent>
          <TabsContent value="analyzer" className="mt-0">
            <AnalyzerTab />
          </TabsContent>
        </div>
      </Tabs>
      <div className="shrink-0 border-t border-border px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start text-[11px] text-muted-foreground"
          onClick={onClose}
        >
          <Plus className="h-3 w-3" />
          Add audio modulation from the sound bar
        </Button>
      </div>
    </div>
  )
}
