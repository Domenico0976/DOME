import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool, getCatalog } from '../core/registry'
import { Catalog } from './Catalog'

export function Stack() {
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const selectTool = useProjectStore((s) => s.selectTool)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const removeTool = useProjectStore((s) => s.removeTool)
  const switchTool = useProjectStore((s) => s.switchTool)
  const [addAbove, setAddAbove] = useState<string | null>(null)
  const [switchUid, setSwitchUid] = useState<string | null>(null)

  return (
    <div className="stack">
      {stack.length === 0 && <div className="stack-empty">Add a tool with + to begin</div>}
      {stack.map((it) => {
        const def = resolveTool(it.toolId, it.toolVersion)
        const sameKind = def ? getCatalog()[def.category].filter((t) => t.id !== it.toolId) : []
        return (
          <div
            key={it.uid}
            className={`stack-node ${selectedUid === it.uid ? 'sel' : ''} ${it.hidden ? 'hidden' : ''}`}
            onClick={() => selectTool(it.uid)}
          >
            <span className="node-label">
              {def?.label ?? it.toolId}
              {it.hidden ? ' (hidden)' : ''}
            </span>
            <button aria-label="Switch tool" onClick={(e) => { e.stopPropagation(); setSwitchUid(it.uid) }}>
              Switch
            </button>
            <button aria-label="Hide node" onClick={(e) => { e.stopPropagation(); toggleSwitch(it.uid) }}>
              ⋯ Hide
            </button>
            <button aria-label="Remove node" onClick={(e) => { e.stopPropagation(); removeTool(it.uid) }}>
              Remove
            </button>
            <button aria-label="Add tool above" onClick={(e) => { e.stopPropagation(); setAddAbove(it.uid) }}>
              ＋
            </button>
            {addAbove === it.uid && <Catalog anchorUid={it.uid} onClose={() => setAddAbove(null)} />}
            {switchUid === it.uid && (
              <div className="switch-picker" role="menu">
                {sameKind.length === 0 && <span>No alternatives</span>}
                {sameKind.map((t) => (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); switchTool(it.uid, t.id); setSwitchUid(null) }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
