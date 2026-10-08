import { useState } from 'react'
import { AudioLines, ChevronDown, ChevronUp, KeyRound, MousePointerClick, Trash2, Loader2, Palette } from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { learnNextCc } from '../audio/midi'
import { ToolIcon } from './toolIcon'
import { ScrollArea } from '../components/ui/scroll-area'
import { Separator } from '../components/ui/separator'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { ControlDef, StackItem } from '../core/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { NodeOptionsEffects } from './NodeOptionsEffects'

const AUDIO_SOURCES = ['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm'] as const

function ColorsPanel({ item, updateParam }: { item: StackItem; updateParam: (uid: string, param: string, value: number | string | string[]) => void }) {
  const currentColors = (item.params.colors as string[] | undefined) ?? ['#000000']
  const [colorsExpanded, setColorsExpanded] = useState(currentColors.length > 1)
  const setColors = (next: string[]) => updateParam(item.uid, 'colors', next)

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setColorsExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Colors
          </span>
          {colorsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {colorsExpanded && (
          <div className="space-y-2 pt-1">
            {currentColors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const next = [...currentColors]
                    next[i] = e.target.value
                    setColors(next)
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-surface-2 p-0.5"
                />
                <span className="text-[11px] font-mono text-muted-foreground uppercase flex-1 truncate">
                  {c}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-danger"
                  disabled={currentColors.length <= 1}
                  aria-label={`Remove color ${i + 1}`}
                  onClick={() => setColors(currentColors.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[11px] gap-1 border-dashed"
              disabled={currentColors.length >= 4}
              onClick={() => setColors([...currentColors, '#000000'])}
              aria-label={`Add Color (${currentColors.length}/4)`}
            >
              <Palette className="h-3 w-3" />
              Add Color ({currentColors.length}/4)
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

const BLEND_MODES = [
  { label: 'Normal', value: 'source-over' },
  { label: 'Darken', value: 'darken' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Plus darker', value: 'source-over' },
  { label: 'Color burn', value: 'color-burn' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Screen', value: 'screen' },
  { label: 'Plus lighter', value: 'lighter' },
  { label: 'Color dodge', value: 'color-dodge' },
  { label: 'Overlay', value: 'overlay' },
  { label: 'Soft light', value: 'soft-light' },
  { label: 'Hard light', value: 'hard-light' },
  { label: 'Difference', value: 'difference' },
  { label: 'Exclusion', value: 'exclusion' },
  { label: 'Hue', value: 'hue' },
  { label: 'Saturation', value: 'saturation' },
  { label: 'Color', value: 'color' },
  { label: 'Luminosity', value: 'luminosity' },
] as const

export function NodeOptions({ item }: { item: StackItem }) {
  const updateParam = useProjectStore((s) => s.updateParam)
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const removeAudioBinding = useProjectStore((s) => s.removeAudioBinding)
  const addAutomation = useProjectStore((s) => s.addAutomation)
  const removeAutomation = useProjectStore((s) => s.removeAutomation)
  const bindMidi = useProjectStore((s) => s.bindMidi)
  const removeMidi = useProjectStore((s) => s.removeMidi)
  const midiEnabled = useProjectStore((s) => s.audio.midi.enabled)
  const midiBindings = useProjectStore((s) => s.audio.midi.bindings)
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const def = resolveTool(item.toolId, item.toolVersion)
  const [learning, setLearning] = useState<string | null>(null)

  if (!def) return <div className="node-options">Unknown tool</div>

  const learn = (param: string) => {
    setLearning(param)
    void learnNextCc().then((cc) => {
      bindMidi(item.uid, param, cc)
      setLearning(null)
    })
  }

  const myMidi = midiBindings.filter((b) => b.uid === item.uid)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
      {/* Sticky header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
        <div className="grid h-7 w-7 place-items-center rounded-sm bg-surface-2">
          <ToolIcon name={String(def.icon)} className="h-4 w-4" />
        </div>
        <h3 className="text-[15px] font-semibold">{def.label}</h3>
        {item.hidden && <Badge variant="warning">Hidden</Badge>}
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-2 shrink-0">
        <label htmlFor="blend-mode" className="text-[11px] font-medium text-muted-foreground">
          Blend mode
        </label>
        <select
          id="blend-mode"
          value={item.blendMode ?? 'source-over'}
          onChange={(e) => updateParam(item.uid, '_blendMode', e.target.value)}
          className="h-7 rounded-md border border-border bg-surface-2 px-2 text-[11px]"
        >
          {BLEND_MODES.map((m) => (
            <option key={m.label} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <label htmlFor="opacity" className="text-[11px] font-medium text-muted-foreground">
          Opacity
        </label>
        <input
          id="opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={item.opacity ?? 1}
          onChange={(e) => updateParam(item.uid, '_opacity', Number(e.target.value))}
          className="w-20 accent-[hsl(var(--primary))] cursor-pointer h-1 appearance-auto"
        />
      </div>

      <Tabs defaultValue="controls" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 shrink-0 self-start">
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="effects">Effects</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
        <div className="space-y-5 p-4">
          {def.controls
            .filter((c: ControlDef) => !c.modes || c.modes.includes(String(item.params.mode ?? '')))
            .map((c: ControlDef) => (
            <div key={c.param} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={c.param} className="text-[12px] font-medium text-muted-foreground">
                  {c.label}
                </label>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Bind audio for ${c.param}`}
                    onClick={() =>
                      addAudioBinding(item.uid, { param: c.param, source: 'bass', curve: 'linear', amount: 1 })
                    }
                  >
                    <AudioLines className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Learn MIDI for ${c.param}`}
                    disabled={!midiEnabled}
                    onClick={() => learn(c.param)}
                  >
                    {learning === c.param ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <MousePointerClick className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Add keyframe for ${c.param}`}
                    onClick={() =>
                      addAutomation(item.uid, {
                        param: c.param,
                        keyframes: [{ timeSec, value: Number(item.params[c.param] ?? 0), easing: 'linear' }],
                      })
                    }
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Native control */}
              {c.kind === 'slider' && (
                <input
                  id={c.param}
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={Number(item.params[c.param] ?? 0)}
                  onChange={(e) => updateParam(item.uid, c.param, Number(e.target.value))}
                  className="w-full accent-[hsl(var(--primary))] cursor-pointer h-1 appearance-auto"
                />
              )}
              {c.kind === 'select' && (
                <select
                  id={c.param}
                  value={String(item.params[c.param] ?? '')}
                  onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(c.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {c.kind === 'color' && (
                <input
                  id={c.param}
                  type="color"
                  value={String(item.params[c.param] ?? '#000000')}
                  onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
                  className="h-9 w-full cursor-pointer p-1"
                />
              )}
              {c.kind === 'text' && (
                <input
                  id={c.param}
                  type="text"
                  value={String(item.params[c.param] ?? '')}
                  onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}

          {/* Colors panel */}
          {def.category === 'Generative' && (
            <ColorsPanel key={JSON.stringify(item.params.colors)} item={item} updateParam={updateParam} />
          )}

          {/* Audio Reactivity section */}
          {item.audio.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Audio Reactivity
                </h4>
                {item.audio.map((b) => (
                  <div key={b.param} className="flex items-center gap-2">
                    <span className="w-20 truncate text-[12px]">{b.param}</span>
                    <select
                      value={b.source}
                      onChange={(e) =>
                        addAudioBinding(item.uid, { ...b, source: e.target.value as typeof b.source })
                      }
                      className="h-8 flex-1 rounded-md border border-border bg-surface-2 px-2 text-[12px]"
                    >
                      {AUDIO_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={b.amount}
                      onChange={(e) => addAudioBinding(item.uid, { ...b, amount: Number(e.target.value) })}
                      className="w-24 accent-primary cursor-pointer h-1 appearance-auto"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger hover:text-danger"
                      aria-label={`Remove audio binding ${b.param}`}
                      onClick={() => removeAudioBinding(item.uid, b.param)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* MIDI section */}
          {midiEnabled && myMidi.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  MIDI
                </h4>
                {myMidi.map((b) => (
                  <div key={b.param} className="flex items-center gap-2">
                    <span className="text-[12px]">{b.param}</span>
                    <Badge variant="secondary">CC {b.cc}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger hover:text-danger"
                      aria-label={`Remove MIDI ${b.param}`}
                      onClick={() => removeMidi(item.uid, b.param)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Automations section */}
          {item.automations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Automations
                </h4>
                {item.automations.map((a) => (
                  <div key={a.param} className="flex items-center gap-2">
                    <span className="text-[12px]">{a.param}</span>
                    <Badge variant="outline">{a.keyframes.length} keys</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger hover:text-danger"
                      aria-label={`Remove automation ${a.param}`}
                      onClick={() => removeAutomation(item.uid, a.param)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="effects" className="mt-0 min-h-0 flex-1 overflow-hidden p-4">
          <NodeOptionsEffects item={item} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
