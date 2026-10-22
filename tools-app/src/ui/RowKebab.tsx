import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Button } from '../components/ui/button'
import { MoreHorizontal, Trash2, CopyPlus, EyeOff } from 'lucide-react'
import { cn } from '../lib/utils'
import { useProjectStore } from '../state/projectStore'
import type { StackItem } from '../core/types'

export interface RowKebabProps {
  kind: 'preset' | 'layer'
  /** preset: the stack item that owns the binding */
  itemUid: string
  /** preset: the binding param (used to build the mute key) */
  param?: string
  /** layer: the stack item (read for hidden state + remove/duplicate) */
  item?: StackItem | null
  disabled?: boolean
  className?: string
}

/**
 * RowKebab — 3-dot overflow menu shared by preset rows and layer rows.
 * kind='preset' → Delete=removeAudioBinding, Duplicate=duplicateStackItem, Hide=toggle mute.
 * kind='layer'  → Delete=removeTool,        Duplicate=duplicateStackItem, Hide=toggle hidden.
 * Radix DropdownMenu owns focus management + Escape/Enter, so the trigger regains
 * focus automatically when the menu closes (no manual focus return needed).
 */
export function RowKebab({ kind, itemUid, param, item, disabled, className }: RowKebabProps) {
  const removeAudioBinding = useProjectStore((s) => s.removeAudioBinding)
  const duplicateStackItem = useProjectStore((s) => s.duplicateStackItem)
  const setBindingMuted = useProjectStore((s) => s.setBindingMuted)
  const removeTool = useProjectStore((s) => s.removeTool)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const mutedIds = useProjectStore((s) => s.audio.disabledAudioBindings ?? [])

  const muteKey = kind === 'preset' && param ? `${itemUid}-${param}` : undefined
  const isMuted = muteKey ? mutedIds.includes(muteKey) : kind === 'layer' ? (item?.hidden ?? false) : false

  const doDelete = () => {
    if (kind === 'preset') {
      if (param) removeAudioBinding(itemUid, param)
    } else {
      removeTool(itemUid)
    }
  }
  const doDuplicate = () => {
    duplicateStackItem(itemUid)
  }
  const doHide = () => {
    if (kind === 'preset') {
      if (muteKey) setBindingMuted(muteKey, !isMuted)
    } else {
      toggleSwitch(itemUid)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6 shrink-0', className)}
          disabled={disabled}
          aria-label="Row actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-[10rem]">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            doDuplicate()
          }}
          aria-label="Duplicate"
        >
          <CopyPlus className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            doHide()
          }}
          aria-label="Hide"
        >
          <EyeOff className="h-4 w-4" />
          Hide
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            doDelete()
          }}
          aria-label="Delete"
          className="text-danger focus:text-danger"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}