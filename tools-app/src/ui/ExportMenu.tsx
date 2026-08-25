import { useAudio } from '../audio/useAudio'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
import { Button } from '../components/ui/button'
import { Download, Camera, Music2, Maximize2, RotateCcw } from 'lucide-react'

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
    <div className="flex items-center gap-1.5" aria-label="Export menu">
      <Button variant="default" size="sm" onClick={png}>
        <Download className="h-3.5 w-3.5" />
        Export PNG
      </Button>
      <Button variant="secondary" size="sm" onClick={instagram}>
        <Camera className="h-3.5 w-3.5" />
        Instagram
      </Button>
      <Button variant="secondary" size="sm" onClick={spotify}>
        <Music2 className="h-3.5 w-3.5" />
        Spotify Canvas
      </Button>
      <Button variant="ghost" size="sm" onClick={fullscreen}>
        <Maximize2 className="h-3.5 w-3.5" />
        Fullscreen
      </Button>
      <Button variant="ghost" size="sm" onClick={resetView}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  )
}
