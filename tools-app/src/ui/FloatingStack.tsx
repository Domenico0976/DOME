import { useRef, useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool, getCatalog } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { Catalog } from './Catalog'
import { Button } from '../components/ui/button'
import { SwitchCamera, EyeOff, X, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'

gsap.registerPlugin(Draggable)

interface FloatingStackProps {
  className?: string
}

function DropIndicator() {
  return <div className="w-0.5 h-8 bg-primary rounded-full shrink-0 animate-pulse" />
}

export function FloatingStack({ className }: FloatingStackProps) {
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const selectTool = useProjectStore((s) => s.selectTool)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const removeTool = useProjectStore((s) => s.removeTool)
  const switchTool = useProjectStore((s) => s.switchTool)

  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const dropIndexRef = useRef<number | null>(null)

  const [draggingUid, setDraggingUid] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [addAbove, setAddAbove] = useState<string | null>(null)
  const [switchUid, setSwitchUid] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  const setItemRef = useCallback((uid: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(uid, el)
    else itemRefs.current.delete(uid)
  }, [])

  useEffect(() => {
    dropIndexRef.current = dropIndex
  }, [dropIndex])

  useEffect(() => {
    if (!trackRef.current) return

    const draggables: Array<{ kill: () => void }> = []

    itemRefs.current.forEach((el, uid) => {
      const created = Draggable.create(el, {
        type: 'x',
        bounds: trackRef.current!,
        onDragStart: () => {
          setDraggingUid(uid)
        },
        onDrag: () => {
          const items = Array.from(itemRefs.current.entries())
          const sorted = items
            .filter(([id]) => id !== uid)
            .sort((a, b) => {
              const rectA = a[1].getBoundingClientRect()
              const rectB = b[1].getBoundingClientRect()
              return rectA.left - rectB.left
            })

          const draggedRect = el.getBoundingClientRect()
          const draggedCenter = draggedRect.left + draggedRect.width / 2

          let newIndex = sorted.length
          for (let i = 0; i < sorted.length; i++) {
            const [, itemEl] = sorted[i]
            const rect = itemEl.getBoundingClientRect()
            const center = rect.left + rect.width / 2
            if (draggedCenter < center) {
              newIndex = i
              break
            }
          }
          setDropIndex(newIndex)
        },
        onDragEnd: () => {
          const currentDropIndex = dropIndexRef.current
          setDraggingUid(null)
          setDropIndex(null)

          if (currentDropIndex !== null) {
            const currentIndex = stack.findIndex((i) => i.uid === uid)
            if (currentIndex !== -1 && currentIndex !== currentDropIndex) {
              const newStack = stack.filter((i) => i.uid !== uid)
              newStack.splice(currentDropIndex, 0, stack[currentIndex])
              useProjectStore.setState({ stack: newStack, unsaved: true })
            }
          }

          gsap.set(el, { x: 0 })
        },
      })

      if (created && created.length > 0) {
        draggables.push(created[0])
      }
    })

    return () => {
      draggables.forEach((d) => d.kill())
    }
  }, [stack.map((i) => i.uid).join(',')])

  const elements: React.ReactNode[] = []

  if (draggingUid && dropIndex === 0) {
    elements.push(<DropIndicator key="drop-0" />)
  }

  stack.forEach((it, index) => {
    const def = resolveTool(it.toolId, it.toolVersion)
    const isSelected = selectedUid === it.uid
    const sameKind = def ? getCatalog()[def.category].filter((t) => t.id !== it.toolId) : []

    elements.push(
      <div
        key={it.uid}
        ref={(el) => setItemRef(it.uid, el)}
        className={cn(
          'group relative shrink-0 rounded-lg border px-3 py-2 cursor-pointer transition-colors select-none',
          isSelected ? 'border-primary bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
          it.hidden && 'opacity-50',
          draggingUid === it.uid && 'z-50 opacity-80',
        )}
        onClick={() => {
          selectTool(it.uid)
          setAddAbove(null)
          setSwitchUid(null)
        }}
      >
        <div className="flex items-center gap-2">
          <ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium text-[13px] max-w-[80px]">{def?.label ?? it.toolId}</span>
          {it.hidden && <span className="text-[10px] text-muted-foreground">(hidden)</span>}
        </div>

        {/* Action buttons - hover to reveal */}
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-elevated rounded-md border border-border shadow-sm px-1 py-0.5 z-50 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Switch tool"
            onClick={(e) => {
              e.stopPropagation()
              setSwitchUid(it.uid)
              setAddAbove(null)
            }}
          >
            <SwitchCamera className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Hide node"
            onClick={(e) => {
              e.stopPropagation()
              toggleSwitch(it.uid)
            }}
          >
            <EyeOff className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-danger hover:text-danger"
            aria-label="Remove node"
            onClick={(e) => {
              e.stopPropagation()
              removeTool(it.uid)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Add tool above"
            onClick={(e) => {
              e.stopPropagation()
              setAddAbove(it.uid)
              setSwitchUid(null)
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Inline Catalog panel */}
        {addAbove === it.uid && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <Catalog anchorUid={it.uid} onClose={() => setAddAbove(null)} />
          </div>
        )}

        {/* Switch picker panel */}
        {switchUid === it.uid && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-md border border-border bg-popover p-1 shadow-lg w-48 z-50"
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
      </div>,
    )

    if (draggingUid && dropIndex === index + 1) {
      elements.push(<DropIndicator key={`drop-${index + 1}`} />)
    }
  })

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'rounded-xl border border-border',
        'bg-[hsl(var(--surface)_/_0.9)] backdrop-blur-sm',
        'shadow-lg',
        'max-w-[80vw]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stack
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          aria-label="Add tool to stack"
          data-catalog-trigger
          onClick={(e) => {
            e.stopPropagation()
            setShowCatalog((v) => !v)
            setAddAbove(null)
            setSwitchUid(null)
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Track */}
      <div ref={trackRef} className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
        {stack.length === 0 && (
          <span className="text-[12px] text-muted-foreground px-2 py-1">
            Add a tool with + to begin
          </span>
        )}
        {elements}
      </div>

      {/* Global catalog toggle */}
      {showCatalog && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Catalog anchorUid={null} onClose={() => setShowCatalog(false)} />
        </div>
      )}
    </div>
  )
}
