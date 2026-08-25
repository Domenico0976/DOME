import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import type { ControlDef, StackItem } from '../core/types'

export function NodeOptions({ item }: { item: StackItem }) {
  const updateParam = useProjectStore((s) => s.updateParam)
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const addAutomation = useProjectStore((s) => s.addAutomation)
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const def = resolveTool(item.toolId, item.toolVersion)
  if (!def) return <div className="node-options">Unknown tool</div>
  return (
    <div className="node-options">
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
    </div>
  )
}
