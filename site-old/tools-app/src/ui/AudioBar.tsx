import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Play, Pause, Upload, Mic, Piano } from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { useAudio } from '../audio/useAudio'
import { connectMidi } from '../audio/midi'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'

export function AudioBar() {
  const audio = useAudio()
  const fileRef = useRef<HTMLInputElement>(null)
  const source = useProjectStore((s) => s.audio.source)
  const fileName = useProjectStore((s) => s.audio.fileName)
  const midiEnabled = useProjectStore((s) => s.audio.midi.enabled)
  const enableMidi = useProjectStore((s) => s.enableMidi)
  const bpm = useProjectStore((s) => s.timeline.bpm)
  const setBpm = useProjectStore((s) => s.setBpm)
  const playing = useProjectStore((s) => s.timeline.playing)
  const setPlaying = useProjectStore((s) => s.setPlaying)
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const durationSec = useProjectStore((s) => s.timeline.durationSec)
  const setTime = useProjectStore((s) => s.setTime)
  const [midiBusy, setMidiBusy] = useState(false)

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) audio.enableFile(f)
  }

  const onMidi = async () => {
    setMidiBusy(true)
    const ok = await connectMidi()
    if (ok) enableMidi()
    setMidiBusy(false)
  }

  return (
    <footer className="flex items-center gap-2 border-t border-border bg-surface px-4 py-2" aria-label="Audio Reactivity and Automations">
      {/* File load */}
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        {source === 'file' ? (fileName ?? 'audio') : 'Load audio'}
      </Button>

      {/* Mic */}
      <Button
        variant={source === 'mic' ? 'default' : 'secondary'}
        size="sm"
        onClick={() => audio.enableMic()}
        aria-pressed={source === 'mic'}
      >
        <Mic className="h-3.5 w-3.5" />
        Mic
      </Button>

      {/* MIDI */}
      <Button
        variant={midiEnabled ? 'default' : 'secondary'}
        size="sm"
        disabled={midiBusy || midiEnabled}
        onClick={onMidi}
      >
        <Piano className="h-3.5 w-3.5" />
        {midiEnabled ? 'MIDI connected' : 'MIDI'}
      </Button>

      {/* BPM */}
      <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        BPM
        <input
          aria-label="BPM"
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="h-8 w-16 rounded-md border border-border bg-surface-2 px-2 text-center font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      {/* Play/Pause */}
      <Button variant="ghost" size="icon" aria-label="Play/Pause" onClick={() => setPlaying(!playing)}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      {/* Timeline slider */}
      <span aria-label="Timeline">
        <Slider
          min={0}
          max={durationSec}
          step={0.1}
          value={[timeSec]}
          onValueChange={(v) => setTime(v[0])}
          className="mx-1 min-w-24 flex-1"
        />
      </span>

      {/* Time readout */}
      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {`${timeSec.toFixed(1)}s`}
      </span>
    </footer>
  )
}
