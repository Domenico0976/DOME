import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool, getCatalog } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { Catalog } from './Catalog'
import { Button } from '../components/ui/button'
import { SwitchCamera, EyeOff, X, Plus } from 'lucide-react'
import { cn } from '../lib/utils'

export function Stack() {
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const selectTool = useProjectStore((s) => s.selectTool)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const removeTool = useProjectStore((s) => s.removeTool)
  const switchTool = useProjectStore((s) => s.switchTool)
  const [addAbove, setAddAbove] = useState<string | null>(null)
  const [switchUid, setSwitchUid] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  return (
    <div className="flex flex-col gap-1 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stack</span>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Add tool to stack"
          data-catalog-trigger
          onClick={(e) => {
            e.stopPropagation()
            setShowCatalog((v) => !v)
            setAddAbove(null)
            setSwitchUid(null)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Empty state */}
      {stack.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
          Add a tool with + to begin
        </div>
      )}

      {/* Nodes */}
      {stack.map((it) => {
        const def = resolveTool(it.toolId, it.toolVersion)
        const isSelected = selectedUid === it.uid
        const sameKind = def ? getCatalog()[def.category].filter((t) => t.id !== it.toolId) : []
        return (
          <div
            key={it.uid}
            className={cn(
              'group relative rounded-md border px-2 py-1.5 cursor-pointer transition-colors',
              isSelected ? 'border-primary bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
              it.hidden && 'opacity-60',
            )}
            onClick={() => {
              selectTool(it.uid)
              setAddAbove(null)
              setSwitchUid(null)
            }}
          >
            {/* Row content */}
            <div className="flex items-center gap-2">
              {/* Icon + label */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium text-[13px]">{def?.label ?? it.toolId}</span>
                {it.hidden && (
                  <span className="text-[10px] text-muted-foreground">(hidden)</span>
                )}
              </div>

              {/* Action cluster (visible on hover/selected) */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Switch tool"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSwitchUid(it.uid)
                    setAddAbove(null)
                  }}
                >
                  <SwitchCamera className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Hide node"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSwitch(it.uid)
                  }}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger hover:text-danger"
                  aria-label="Remove node"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTool(it.uid)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Add tool above"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddAbove(it.uid)
                    setSwitchUid(null)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Inline Catalog panel */}
            {addAbove === it.uid && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <Catalog anchorUid={it.uid} onClose={() => setAddAbove(null)} />
              </div>
            )}

            {/* Switch picker panel */}
            {switchUid === it.uid && (
              <div
                className="mt-2 rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {sameKind.length === 0 && (
                  <span className="block rounded-sm px-2 py-1 text-[13px] text-muted-foreground">
                    No alternatives
                  </span>
                )}
                {sameKind.map((t) => (
                  <button
                    key={t.id}
                    className="block w-full rounded-sm px-2 py-1 text-left text-[13px] hover:bg-surface-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      switchTool(it.uid, t.id)
                      setSwitchUid(null)
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Global catalog toggle */}
      {showCatalog && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Catalog anchorUid={null} onClose={() => setShowCatalog(false)} />
        </div>
      )}
    </div>
  )
}
