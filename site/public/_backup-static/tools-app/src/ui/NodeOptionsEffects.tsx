import { useState } from 'react'
import { learnNextCc } from '../audio/midi'
import { useProjectStore } from '../state/projectStore'
import { EFFECT_ORDER, EFFECTS } from '../engine/effects'
import type { EffectType, StackItem } from '../core/types'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { AudioLines, Plus, Trash2 } from 'lucide-react'

export function NodeOptionsEffects({ item }: { item: StackItem }) {
  const addEffect = useProjectStore((s) => s.addEffect)
  const removeEffect = useProjectStore((s) => s.removeEffect)
  const setEffectParam = useProjectStore((s) => s.setEffectParam)
  const toggleEffect = useProjectStore((s) => s.toggleEffect)
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const midiEnabled = useProjectStore((s) => s.audio.midi.enabled)
  const [learning, setLearning] = useState<string | null>(null)

  const learn = (key: string) => {
    setLearning(key)
    void learnNextCc().then((cc) => {
      useProjectStore.getState().bindMidi(item.uid, key, cc)
      setLearning(null)
    })
  }

  return (
    <div className="space-y-3">
      <Select value="" onValueChange={(v) => addEffect(item.uid, v as EffectType)}>
        <SelectTrigger className="w-full" aria-label="Add effect">
          <Plus className="h-4 w-4" />
          <SelectValue placeholder="Add effect" />
        </SelectTrigger>
        <SelectContent>
          {EFFECT_ORDER.map((t) => (
            <SelectItem key={t} value={t}>
              {EFFECTS[t]?.label ?? t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(item.effects ?? []).map((e) => {
        const def = EFFECTS[e.type]
        if (!def) return null
        return (
          <div key={e.uid} className="space-y-2 rounded-md border border-border bg-surface-2/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{def.label}</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={e.enabled}
                  onCheckedChange={() => toggleEffect(item.uid, e.uid)}
                  aria-label={`Enable ${def.label}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger hover:text-danger"
                  aria-label="Remove effect"
                  onClick={() => removeEffect(item.uid, e.uid)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {def.controls.map((c) => {
              const key = `${e.uid}.${c.param}`
              const bound = item.audio.some((b) => b.param === key)
              return (
                <div key={c.param} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={key} className="text-[12px] text-muted-foreground">
                      {c.label}
                    </label>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${bound ? 'text-primary' : ''}`}
                        aria-label={`Bind audio for ${key}`}
                        onClick={() => addAudioBinding(item.uid, { param: key, source: 'bass', curve: 'linear', amount: 1 })}
                      >
                        <AudioLines className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label={`Learn MIDI for ${key}`}
                        disabled={!midiEnabled || learning === key}
                        onClick={() => learn(key)}
                      >
                        {learning === key ? '…' : 'M'}
                      </Button>
                    </div>
                  </div>
                  <input
                    id={key}
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={Number(e.params[c.param] ?? def.defaultParams[c.param])}
                    onChange={(ev) => setEffectParam(item.uid, e.uid, c.param, Number(ev.target.value))}
                    className="w-full accent-[hsl(var(--primary))] cursor-pointer"
                  />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
