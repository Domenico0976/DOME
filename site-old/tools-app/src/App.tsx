import { useEffect, useState } from 'react'
import { useProjectStore } from './state/projectStore'
import { TopBar } from './ui/TopBar'
import { Sidebar } from './ui/Sidebar'
import { Canvas } from './ui/Canvas'
import { CanvasArea } from './ui/CanvasArea'
import { FloatingStack } from './ui/FloatingStack'
import { FloatingPanel } from './ui/FloatingPanel'
import { AudioReactPanel } from './ui/AudioReactPanel'
import { ExportMenu } from './ui/ExportMenu'

export default function App() {
  const [panelOpen, setPanelOpen] = useState(true)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const stack = useProjectStore((s) => s.stack)
  const selected = stack.find((i) => i.uid === selectedUid) ?? null

  useEffect(() => {
    setPanelOpen(true)
  }, [selectedUid])

  useEffect(() => {
    const raw = localStorage.getItem('dome-project')
    if (!raw) return
    try {
      useProjectStore.getState().loadProject(JSON.parse(raw))
    } catch (e) {
      // ignore invalid project data
      void e
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1">
          <section className="flex flex-col flex-1 min-w-0 relative overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 40%, hsl(var(--surface-2)) 0%, hsl(var(--background)) 70%)' }}>
            <CanvasArea>
              <Canvas />
            </CanvasArea>
            {selected === null && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border border-dashed border-border bg-popover/80 px-3 py-2 text-[12px] text-muted-foreground">
                Select a node to edit its parameters
              </div>
            )}
          </section>
        </main>
        <div className="border-t border-border bg-surface px-3 py-2">
          <ExportMenu />
        </div>
        <AudioReactPanel />
      </div>
      <FloatingStack className="bottom-[180px]" />
      {selected && panelOpen && (
        <FloatingPanel item={selected} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  )
}
