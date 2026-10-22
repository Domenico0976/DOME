import { useEffect, useState } from 'react'
import { useProjectStore } from './state/projectStore'
import { TopBar } from './ui/TopBar'
import { Sidebar } from './ui/Sidebar'
import { Canvas } from './ui/Canvas'
import { CanvasArea } from './ui/CanvasArea'
import { StackPanel } from './ui/StackPanel'
import { FloatingPanel } from './ui/FloatingPanel'
import { AudioReactPanel } from './ui/AudioReactPanel'
import { ZoomPanel } from './ui/ZoomPanel'
import { PerfBanner } from './ui/PerfBanner'
import { usePerfMonitor } from './hooks/usePerfMonitor'

export default function App() {
  const [panelOpen, setPanelOpen] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [focusParam, setFocusParam] = useState<string | null>(null)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const stack = useProjectStore((s) => s.stack)
  const selected = stack.find((i) => i.uid === selectedUid) ?? null

  useEffect(() => {
    setPanelOpen(true)
    setFocusParam(null)
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

  // System-resilience hooks — observe only, never alter render output.
  usePerfMonitor()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      <a href="#main-content" className="skip-link">
        Salta al contenuto
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PerfBanner />
        <main id="main-content" className="relative flex min-h-0 flex-1" tabIndex={-1}>
          <section className="flex flex-col flex-1 min-w-0 relative overflow-hidden bg-[hsl(var(--bg-canvas))]" data-testid="canvas-container">
            <TopBar />
            <CanvasArea zoom={zoom} onZoomChange={setZoom}>
              <Canvas />
            </CanvasArea>
            {selected === null && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border border-dashed border-border bg-popover/80 px-3 py-2 text-[12px] text-muted-foreground">
                Select a node to edit its parameters
              </div>
            )}
          </section>
          <StackPanel />
          <ZoomPanel zoom={zoom} onZoomChange={setZoom} />
        </main>
        <AudioReactPanel onFocusParam={setFocusParam} />
      </div>
      {selected && panelOpen && (
        <FloatingPanel
          item={selected}
          onClose={() => setPanelOpen(false)}
          focusParam={focusParam}
          onFocusParamClear={() => setFocusParam(null)}
        />
      )}
    </div>
  )
}