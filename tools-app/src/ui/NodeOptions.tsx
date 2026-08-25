import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { learnNextCc } from '../audio/midi'
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
    <div className="node-options">
      <h3>{def.label}</h3>
      {def.controls.map((c: ControlDef) => (
        <div key={c.param} className="opt-row">
          <label htmlFor={c.param}>{c.label}</label>
          {c.kind === 'slider' && (
            <input
              id={c.param}
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={Number(item.params[c.param] ?? 0)}
              onChange={(e) => updateParam(item.uid, c.param, Number(e.target.value))}
            />
          )}
          {c.kind === 'select' && (
            <select
              id={c.param}
              value={String(item.params[c.param] ?? '')}
              onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
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
            />
          )}
          {c.kind === 'text' && (
            <input
              id={c.param}
              type="text"
              value={String(item.params[c.param] ?? '')}
              onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
            />
          )}
          <button
            aria-label={`Bind audio for ${c.param}`}
            onClick={() => addAudioBinding(item.uid, { param: c.param, source: 'bass', curve: 'linear', amount: 1 })}
          >
            audio
          </button>
          <button
            aria-label={`Learn MIDI for ${c.param}`}
            disabled={!midiEnabled}
            onClick={() => learn(c.param)}
          >
            {learning === c.param ? '…' : 'midi'}
          </button>
          <button
            aria-label={`Add keyframe for ${c.param}`}
            onClick={() =>
              addAutomation(item.uid, {
                param: c.param,
                keyframes: [{ timeSec, value: Number(item.params[c.param] ?? 0), easing: 'linear' }],
              })
            }
          >
            key
          </button>
        </div>
      ))}

      {item.audio.length > 0 && (
        <div className="opt-section">
          <h4>Audio Reactivity</h4>
          {item.audio.map((b) => (
            <div key={b.param} className="opt-binding">
              <span>{b.param}</span>
              <select
                value={b.source}
                onChange={(e) => addAudioBinding(item.uid, { ...b, source: e.target.value as typeof b.source })}
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
              />
              <button
                aria-label={`Remove audio binding ${b.param}`}
                onClick={() => removeAudioBinding(item.uid, b.param)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {midiEnabled && myMidi.length > 0 && (
        <div className="opt-section">
          <h4>MIDI</h4>
          {myMidi.map((b) => (
            <div key={b.param} className="opt-binding">
              <span>{b.param}</span>
              <span>CC {b.cc}</span>
              <button aria-label={`Remove MIDI ${b.param}`} onClick={() => removeMidi(item.uid, b.param)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {item.automations.length > 0 && (
        <div className="opt-section">
          <h4>Automations</h4>
          {item.automations.map((a) => (
            <div key={a.param} className="opt-binding">
              <span>{a.param}</span>
              <span>{a.keyframes.length} keys</span>
              <button
                aria-label={`Remove automation ${a.param}`}
                onClick={() => removeAutomation(item.uid, a.param)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
