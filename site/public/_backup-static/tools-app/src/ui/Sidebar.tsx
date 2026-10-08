import { useProjectStore } from '../state/projectStore'
import { Button } from '../components/ui/button'
import { Undo2, Redo2 } from 'lucide-react'

export function Sidebar() {
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-border bg-surface py-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        title="DOME"
      >
        D
      </div>

      <div className="flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => redo()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}
