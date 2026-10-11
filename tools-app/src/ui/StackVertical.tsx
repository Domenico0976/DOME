import { useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { NodeRow } from './NodeRow'
import { DropPlaceholder } from './DropPlaceholder'
import { Grip } from 'lucide-react'

export function StackVertical({ onNudge }: { onNudge?: (dx: number, dy: number) => void }) {
  const stack = useProjectStore((s) => s.stack)
  const moveToolTo = useProjectStore((s) => s.moveToolTo)
  const [draggingUid, setDraggingUid] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)

  const visible = draggingUid ? stack.filter((i) => i.uid !== draggingUid) : stack

  const handleDragStart = (uid: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', uid)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingUid(uid)
    setDropIndex(null)
    dropIndexRef.current = null
  }

  const handleDragOverRow = (e: React.DragEvent, index: number) => {
    if (!draggingUid) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const after = e.clientY - rect.top > rect.height / 2
    const next = after ? index + 1 : index
    if (next !== dropIndexRef.current) {
      dropIndexRef.current = next
      setDropIndex(next)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!draggingUid) return
    e.preventDefault()
    e.stopPropagation()
    const target = dropIndexRef.current ?? visible.length
    moveToolTo(draggingUid, target)
    setDraggingUid(null)
    setDropIndex(null)
    dropIndexRef.current = null
  }

  const handleDragEnd = () => {
    setDraggingUid(null)
    setDropIndex(null)
    dropIndexRef.current = null
  }

  return (
    <div
      role="list"
      aria-label="Layer stack, top is front"
      className="pointer-events-auto flex max-h-full min-h-0 w-[248px] flex-col"
      onDragOver={(e) => {
        if (!draggingUid) return
        e.preventDefault()
        if (dropIndexRef.current !== visible.length) {
          dropIndexRef.current = visible.length
          setDropIndex(visible.length)
        }
      }}
      onDrop={handleDrop}
    >
      <div className="flex shrink-0 items-center gap-1.5 px-1 pb-1.5">
        <span
          data-panel-drag-handle
          role="button"
          tabIndex={0}
          aria-label="Drag stack panel to reposition"
          title="Drag to reposition panel"
          onKeyDown={(e) => {
            const step = e.shiftKey ? 24 : 8
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onNudge?.(0, -step)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onNudge?.(0, step)
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              onNudge?.(-step, 0)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              onNudge?.(step, 0)
            }
          }}
          className="grid h-8 w-8 cursor-move place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Grip className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stack · {stack.length}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-1" data-testid="stack-vertical-list">
        {visible.length === 0 && !draggingUid && (
          <span className="px-2 py-1 text-[12px] text-muted-foreground">Empty — add a tool to begin</span>
        )}
        {visible.map((item, vIndex) => (
          <div key={item.uid} className="flex shrink-0 flex-col">
            {draggingUid && dropIndex === vIndex && <DropPlaceholder active />}
            <NodeRow
              item={item}
              index={stack.findIndex((i) => i.uid === item.uid)}
              total={stack.length}
              onDragStartRow={handleDragStart}
              onDragOverRow={(e) => handleDragOverRow(e, vIndex)}
              onDropRow={handleDrop}
              onDragEndRow={handleDragEnd}
            />
          </div>
        ))}
        {draggingUid && dropIndex === visible.length && <DropPlaceholder active />}
      </div>
    </div>
  )
}
