import { useState } from 'react'
import { AudioLines, KeyRound, MousePointerClick, Trash2, Loader2 } from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { learnNextCc } from '../audio/midi'
import { ScrollArea } from '../components/ui/scroll-area'
import { Separator } from '../components/ui/separator'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { ControlDef, StackItem } from '../core/types'

const AUDIO_SOURCES = ['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm'] as const

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
          <span className="text-base leading-none">{def.icon}</span>
        </div>
        <h3 className="text-[15px] font-semibold">{def.label}</h3>
        {item.hidden && <Badge variant="warning">Hidden</Badge>}
      </div>

      {/* Controls body */}
      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          {def.controls.map((c: ControlDef) => (
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
    </div>
  )
}
