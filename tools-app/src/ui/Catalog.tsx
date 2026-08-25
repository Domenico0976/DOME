import { getCatalog } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'

export function Catalog({ anchorUid, onClose }: { anchorUid: string | null; onClose: () => void }) {
  const addTool = useProjectStore((s) => s.addTool)
  const selectTool = useProjectStore((s) => s.selectTool)
  const cat = getCatalog()
  const cols: { key: 'Inputs' | 'Generative' | 'Filters' }[] = [
    { key: 'Inputs' },
    { key: 'Generative' },
    { key: 'Filters' },
  ]

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-4 rounded-lg border border-border bg-popover p-3 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 w-fit min-w-[420px]',
      )}
      role="dialog"
      aria-label="Tool catalog"
    >
      {cols.map((col) => {
        const items = cat[col.key]
        return (
          <div key={col.key} className="flex flex-col gap-0.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pb-1">
              {col.key}
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
                {t.icon && <span className="text-base">{t.icon}</span>}
                <span>{t.label}</span>
              </Button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
