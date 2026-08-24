import { useCallback, useEffect, useRef, useState } from 'react'
import { RenderSurface } from './render/RenderSurface'
import type { PreviewFrameInfo, RenderSurfaceHandle } from './render/RenderSurface'
import { Inspector } from './ui/Inspector'
import { NodeCanvas } from './ui/NodeCanvas'
import { Palette } from './ui/Palette'
import { AutosavePrompt } from './ui/AutosavePrompt'
import { ImportControls } from './ui/ImportControls'
import { TransportBar } from './ui/TransportBar'
import { STARTER_PROJECT } from './templates/starter'
import { useEngineFrame } from './hooks/useEngineFrame'
import { useToolStore } from './state/store'

export default function App() {
  const undo = useToolStore((state) => state.undo)
  const redo = useToolStore((state) => state.redo)
  const engine = useToolStore((state) => state.engine)
  const debugRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<RenderSurfaceHandle>(null)
  const model = useToolStore((state) => state.model)
  const tick = useToolStore((state) => state.tick)
  const autosaveCandidate = useToolStore((state) => state.autosaveCandidate)
  const acceptAutosaveCandidate = useToolStore((state) => state.acceptAutosaveCandidate)
  const dismissAutosaveCandidate = useToolStore((state) => state.dismissAutosaveCandidate)
  const [blankDismissed, setBlankDismissed] = useState(false)

  useEffect(() => {
    useToolStore.getState().prepareAutosaveCandidate()
  }, [])

  useEffect(() => {
    const prevent = (event: DragEvent): void => {
      event.preventDefault()
    }
    const handleDrop = (event: DragEvent): void => {
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (file === undefined) return
      void file.text().then((text) => {
        try {
          const result = useToolStore.getState().importProjectRaw(JSON.parse(text))
          if (!result.ok) useToolStore.getState().setImportStatus(result.message)
        } catch {
          useToolStore.getState().setImportStatus('That file could not be read')
        }
      })
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          'dome.autosave.v1',
          JSON.stringify(useToolStore.getState().buildProjectFile(), null, 2),
        )
      } catch (error) {
        console.debug('[tools] autosave skipped', error)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [tick])

  const showStarterCard =
    model.nodes().length === 0 && !blankDismissed && autosaveCandidate === null

  const drawPreviewFrame = useCallback(
    (ctx: CanvasRenderingContext2D, info: PreviewFrameInfo) => {
      let renderNodeId: string | null = null
      for (const node of model.nodes()) {
        if (node.type === 'render.canvas') {
          renderNodeId = node.id
          break
        }
      }
      if (renderNodeId === null) return
      engine.getRuntime(renderNodeId)?.draw?.(ctx, info)
    },
    [engine, model],
  )

  useEngineFrame((timeSec) => {
    engine.tick(timeSec)
    surfaceRef.current?.frame(timeSec)
    const element = debugRef.current
    if (element === null) return
    let shown = ''
    for (const node of useToolStore.getState().model.nodes()) {
      const value = engine.outputOf(node.id, 'out')
      if (typeof value === 'number') {
        shown = `${node.id.slice(0, 6)} · out = ${value.toFixed(3)}`
        break
      }
    }
    element.textContent = shown
  })

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">DOME · Tools</span>
        <div className="topbar-actions">
          <button type="button" onClick={undo}>
            Undo
          </button>
          <button type="button" onClick={redo}>
            Redo
          </button>
          <span className="banner">Cloud saving temporarily unavailable</span>
        </div>
      </header>

      {autosaveCandidate !== null ? (
        <AutosavePrompt
          onRestore={() => acceptAutosaveCandidate()}
          onDiscard={() => dismissAutosaveCandidate()}
        />
      ) : null}

      <main className="workspace">
        <aside className="palette" data-region="palette">
          <Palette />
        </aside>
        <section className="canvas-area" data-region="canvas-area">
          {showStarterCard ? (
            <div className="starter-card">
              <p>Start with the demo setup — fully wired, one click.</p>
              <div className="starter-actions">
                <button
                  type="button"
                  onClick={() => {
                    const result = useToolStore.getState().importProjectRaw(STARTER_PROJECT)
                    if (!result.ok) useToolStore.getState().setImportStatus(result.message)
                  }}
                >
                  Load starter setup
                </button>
                <button type="button" onClick={() => setBlankDismissed(true)}>
                  Start blank
                </button>
              </div>
            </div>
          ) : null}
          <div className="editor-split">
            <div className="editor-graph">
              <NodeCanvas />
            </div>
            <div className="preview-pane">
              <RenderSurface ref={surfaceRef} drawFrame={drawPreviewFrame} />
              <button
                type="button"
                className="export-button"
                onClick={() => {
                  void surfaceRef.current?.exportPng().catch((error: unknown) => {
                    console.debug('Export failed:', error)
                  })
                }}
              >
                Export PNG
              </button>
              <ImportControls />
            </div>
          </div>
          <div ref={debugRef} className="debug-strip" />
        </section>
        <aside className="inspector" data-region="inspector">
          <Inspector />
        </aside>
      </main>

      <footer className="transport" data-region="transport">
        <TransportBar />
      </footer>
    </div>
  )
}
