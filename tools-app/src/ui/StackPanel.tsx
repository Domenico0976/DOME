import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { StackVertical } from './StackVertical'
import { Catalog } from './Catalog'
import { Button } from '../components/ui/button'
import { Plus, ChevronDown, Grip } from 'lucide-react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'

gsap.registerPlugin(Draggable)

export function StackPanel() {
  const stack = useProjectStore((s) => s.stack)
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  useEffect(() => {
    const main = document.getElementById('main-content')
    const el = panelRef.current
    if (!el || !main) return
    const d = Draggable.create(el, {
      type: 'x,y',
      trigger: headerRef.current,
      bounds: main,
      inertia: false,
      edgeResistance: 0.85,
    })[0]
    return () => {
      d.kill()
    }
  }, [])

  return (
    <aside
      id="stack-panel"
      data-testid="stack-panel"
      ref={panelRef}
      style={{ position: 'absolute', top: 'calc(var(--topbar-h) + 12px)', left: 12 }}
      className="z-10 flex max-h-[calc(100vh-var(--topbar-h)-var(--soundbar-height)-32px)] w-[248px] flex-col rounded-[12px] border border-border bg-surface-panel shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={headerRef}
        className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span
          data-panel-drag-handle
          role="button"
          tabIndex={0}
          aria-label="Drag stack panel to reposition"
          title="Drag to reposition panel"
          className="grid h-6 w-6 cursor-move place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Grip className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stack · {stack.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Add tool"
          aria-expanded={catalogOpen}
          onClick={() => setCatalogOpen((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={collapsed ? 'Expand stack panel' : 'Collapse stack panel'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          <ChevronDown className={collapsed ? 'h-3.5 w-3.5 -rotate-90 transition-transform' : 'h-3.5 w-3.5 transition-transform'} />
        </Button>
      </div>
      {catalogOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[320px]">
          <Catalog anchorUid={null} onClose={() => setCatalogOpen(false)} />
        </div>
      )}
      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col">
          <StackVertical hideHeader />
        </div>
      )}
    </aside>
  )
}
