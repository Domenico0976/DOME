import { useProjectStore } from '../state/projectStore'

export function Sidebar() {
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  return (
    <aside className="sidebar">
      <div className="sidebar-profile">DOME</div>
      <div className="sidebar-actions">
        <button aria-label="Undo" disabled={!canUndo} onClick={() => undo()}>
          ↶ Undo
        </button>
        <button aria-label="Redo" disabled={!canRedo} onClick={() => redo()}>
          ↷ Redo
        </button>
      </div>
    </aside>
  )
}
