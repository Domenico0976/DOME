import { getCatalog } from '../core/registry'
import { useProjectStore } from '../state/projectStore'

export function Catalog({ anchorUid, onClose }: { anchorUid: string | null; onClose: () => void }) {
  const addTool = useProjectStore((s) => s.addTool)
  const selectTool = useProjectStore((s) => s.selectTool)
  const cat = getCatalog()
  const cols: { key: 'Inputs' | 'Generative' | 'Filters'; label: string }[] = [
    { key: 'Inputs', label: 'Inputs' },
    { key: 'Generative', label: 'Generative' },
    { key: 'Filters', label: 'Filters' },
  ]
  return (
    <div className="catalog" role="dialog" aria-label="Tool catalog">
      {cols.map((col) => (
        <div key={col.key} className="cat-col">
          <h4>{col.label}</h4>
          {cat[col.key].map((t) => (
            <button
              key={t.id}
              className="cat-item"
              aria-label={`Add ${t.label}`}
              onClick={() => {
                if (anchorUid) selectTool(anchorUid)
                addTool(t.id)
                onClose()
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
