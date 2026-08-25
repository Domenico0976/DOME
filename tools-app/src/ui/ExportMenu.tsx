import { useAudio } from '../audio/useAudio'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'

function download(canvas: HTMLCanvasElement, name: string): void {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export function ExportMenu() {
  const audio = useAudio()

  const exportAt = (w: number, h: number, name: string) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return
    const state = useProjectStore.getState()
    const bpm = state.timeline.bpm
    const frame = { timeSec: state.timeline.timeSec, dt: 1 / 60, bpm }
    const af = audio.readFrame(bpm)
    evaluateStack(ctx, frame, af, state.stack)
    download(c, name)
  }

  const png = () => exportAt(1080, 1080, 'dome-export.png')
  const instagram = () => exportAt(1080, 1080, 'dome-instagram.png')
  const spotify = () => exportAt(1080, 1080, 'dome-spotify-canvas.png')
  const fullscreen = () => {
    document.getElementById('stage-canvas')?.requestFullscreen?.()
  }
  const resetView = () => useProjectStore.getState().reset()

  return (
    <div className="export-menu" aria-label="Export menu">
      <button type="button" onClick={png}>
        Export PNG
      </button>
      <button type="button" onClick={instagram}>
        Instagram
      </button>
      <button type="button" onClick={spotify}>
        Spotify Canvas
      </button>
      <button type="button" onClick={fullscreen}>
        Fullscreen
      </button>
      <button type="button" onClick={resetView}>
        Reset
      </button>
    </div>
  )
}
