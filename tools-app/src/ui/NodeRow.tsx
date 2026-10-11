import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool, getCatalog } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { LayerBadges } from './Stack'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Grip, MoreHorizontal, Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Repeat } from 'lucide-react'
import { cn } from '../lib/utils'
import type { StackItem } from '../core/types'

interface NodeRowProps {
  item: StackItem
  index: number
  total: number
  onDragStartRow: (uid: string, e: React.DragEvent) => void
  onDragOverRow: (e: React.DragEvent) => void
  onDropRow: (e: React.DragEvent) => void
  onDragEndRow: () => void
}

export function NodeRow({ item, index, total, onDragStartRow, onDragOverRow, onDropRow, onDragEndRow }: NodeRowProps) {
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const selectTool = useProjectStore((s) => s.selectTool)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const removeTool = useProjectStore((s) => s.removeTool)
  const moveTool = useProjectStore((s) => s.moveTool)
  const switchTool = useProjectStore((s) => s.switchTool)
  const [changeOpen, setChangeOpen] = useState(false)

  const def = resolveTool(item.toolId, item.toolVersion)
  const isSelected = selectedUid === item.uid
  const sameKind = def ? getCatalog()[def.category].filter((t) => t.id !== item.toolId) : []

  return (
    <div
      data-testid={`node-row-${item.uid}`}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      onClick={() => selectTool(item.uid)}
      className={cn(
        'group pointer-events-auto relative flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-1.5 backdrop-blur-sm transition-colors',
        isSelected ? 'border-primary bg-surface-2/95' : 'border-border bg-surface/85 hover:bg-surface-2/90',
        item.hidden && 'opacity-60',
      )}
    >
      <span
        role="button"
        tabIndex={0}
        draggable
        aria-label={`Drag ${def?.label ?? item.toolId} to reorder`}
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => onDragStartRow(item.uid, e)}
        onDragEnd={onDragEndRow}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            moveTool(item.uid, 'up')
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            moveTool(item.uid, 'down')
          }
        }}
        className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <Grip className="h-4 w-4" />
      </span>

      <LayerBadges index={index} item={item} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          selectTool(item.uid)
        }}
        aria-label={`Select ${def?.label ?? item.toolId}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />
        <span className="truncate text-[13px] font-medium">{def?.label ?? item.toolId}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Node actions for ${def?.label ?? item.toolId}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="min-w-[12rem]">
          <DropdownMenuItem
            onSelect={() => toggleSwitch(item.uid)}
            aria-label={item.hidden ? 'Show node' : 'Hide node'}
          >
            {item.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {item.hidden ? 'Show' : 'Hide'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => moveTool(item.uid, 'up')}
            disabled={index === 0}
            aria-label="Move node up"
          >
            <ArrowUp className="h-4 w-4" />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => moveTool(item.uid, 'down')}
            disabled={index === total - 1}
            aria-label="Move node down"
          >
            <ArrowDown className="h-4 w-4" />
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setChangeOpen((v) => !v)}
            aria-label="Change tool"
          >
            <Repeat className="h-4 w-4" />
            Change…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => removeTool(item.uid)}
            aria-label="Delete node"
            className="text-danger focus:text-danger"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {changeOpen && (
        <div
          className="absolute bottom-full left-1/2 z-[55] mb-2 w-48 -translate-x-1/2 rounded-md border border-border bg-popover p-1 shadow-lg"
          role="menu"
          aria-label="Change tool"
          onClick={(e) => e.stopPropagation()}
        >
          {sameKind.length === 0 && (
            <span className="block rounded-sm px-2 py-1 text-[13px] text-muted-foreground">No alternatives</span>
          )}
          {sameKind.map((t) => (
            <button
              key={t.id}
              type="button"
              className="block w-full rounded-sm px-2 py-1 text-left text-[13px] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation()
                switchTool(item.uid, t.id)
                setChangeOpen(false)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
