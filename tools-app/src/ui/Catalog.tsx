import { useState } from 'react'
import { getCatalog } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { useProjectStore } from '../state/projectStore'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Search, XCircle } from 'lucide-react'

type CategoryKey = 'Inputs' | 'Generative' | 'Filters'
type FilterKey = 'All' | CategoryKey

export function Catalog({ anchorUid, onClose }: { anchorUid: string | null; onClose: () => void }) {
  const addTool = useProjectStore((s) => s.addTool)
  const selectTool = useProjectStore((s) => s.selectTool)
  const cat = getCatalog()
  const categoryKeys: CategoryKey[] = ['Inputs', 'Generative', 'Filters']
  const filterOptions: FilterKey[] = ['All', ...categoryKeys]

  const [filter, setFilter] = useState<FilterKey>('All')
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const matches = (label: string) => !query || label.toLowerCase().includes(query)

  const visibleKeys: CategoryKey[] = filter === 'All' ? categoryKeys : [filter]
  const hasAny = visibleKeys.some((k) => cat[k].some((t) => matches(t.label)))

  const clear = () => {
    setFilter('All')
    setSearch('')
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border border-border bg-popover p-3 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 max-w-[90vw] max-h-[60vh] overflow-auto',
      )}
      role="dialog"
      aria-label="Tool catalog"
    >
      {/* Filter row: category segmented control + search */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter tools by category" className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {filterOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={filter === opt}
              onClick={() => setFilter(opt)}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
                filter === opt ? 'bg-surface-2 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <input
            aria-label="Search tools"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. plasma"
            className="h-7 w-40 max-w-[40vw] rounded-md border border-border bg-surface-2 px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {!hasAny ? (
        <div className="col-span-3 flex flex-col items-center justify-center gap-2 py-8 text-center">
          <XCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">No tools match — clear search</p>
          <Button variant="secondary" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      ) : (
        visibleKeys.map((key) => {
          const items = cat[key].filter((t) => matches(t.label))
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pb-1">
                {key}
              </h4>
              {items.map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  aria-label={`Add ${t.label}`}
                  onClick={() => {
                    if (anchorUid) selectTool(anchorUid)
                    addTool(t.id)
                    onClose()
                  }}
                >
                  <ToolIcon name={String(t.icon)} className="h-4 w-4 shrink-0" />
                  <span className="truncate" title={t.label}>{t.label}</span>
                </Button>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}