import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useProjectStore } from '../state/projectStore'
import { useAudio } from '../audio/useAudio'
import { connectMidi } from '../audio/midi'

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
    <footer className="audio-bar" aria-label="Audio Reactivity and Automations">
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
      <button type="button" onClick={() => fileRef.current?.click()}>
        {source === 'file' ? `♪ ${fileName ?? 'audio'}` : 'Load audio'}
      </button>
      <button type="button" onClick={() => audio.enableMic()} aria-pressed={source === 'mic'}>
        {source === 'mic' ? '● Mic' : 'Mic'}
      </button>
      <button type="button" onClick={onMidi} disabled={midiBusy || midiEnabled}>
        {midiEnabled ? 'MIDI ✓' : 'MIDI'}
      </button>
      <label>
        BPM
        <input
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
        />
      </label>
      <button type="button" aria-label="Play/Pause" onClick={() => setPlaying(!playing)}>
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={durationSec}
        step={0.1}
        value={timeSec}
        onChange={(e) => setTime(Number(e.target.value))}
        aria-label="Timeline"
      />
      <span>{timeSec.toFixed(1)}s</span>
    </footer>
  )
}
