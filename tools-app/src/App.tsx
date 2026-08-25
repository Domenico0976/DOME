import { useEffect } from 'react'
import { useProjectStore } from './state/projectStore'
import { TopBar } from './ui/TopBar'
import { Sidebar } from './ui/Sidebar'
import { Stack } from './ui/Stack'
import { NodeOptions } from './ui/NodeOptions'
import { Canvas } from './ui/Canvas'
import { AudioBar } from './ui/AudioBar'
import { ExportMenu } from './ui/ExportMenu'

export default function App() {
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const stack = useProjectStore((s) => s.stack)
  const selected = stack.find((i) => i.uid === selectedUid) ?? null

  useEffect(() => {
    const raw = localStorage.getItem('dome-project')
    if (!raw) return
    try {
      useProjectStore.getState().loadProject(JSON.parse(raw))
    } catch {
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1">
          <section className="flex-1 min-w-0 relative flex items-center justify-center overflow-hidden p-6" style={{ background: 'radial-gradient(circle at 50% 40%, hsl(var(--surface-2)) 0%, hsl(var(--background)) 70%)' }}>
            <Canvas />
            {selected === null && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md border border-dashed border-border bg-popover/80 px-3 py-2 text-[12px] text-muted-foreground">
                Select a node to edit its parameters
              </div>
            )}
          </section>
          <aside className="flex w-[340px] shrink-0 flex-col gap-3 border-l border-border bg-surface p-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <Stack />
            <div className="min-h-0 flex-1">
              {selected ? (
                <div className="h-full animate-in fade-in-0 zoom-in-95 duration-150">
                  <NodeOptions item={selected} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-popover/50">
                  <span className="text-[12px] text-muted-foreground">No node selected</span>
                </div>
              )}
            </div>
          </aside>
        </main>
        <div className="border-t border-border bg-surface px-3 py-2">
          <ExportMenu />
        </div>
        <AudioBar />
      </div>
    </div>
  )
}
