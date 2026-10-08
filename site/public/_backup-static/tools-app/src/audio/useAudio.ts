import { useCallback, useRef, useState } from 'react'
import {
  attachMediaElement,
  attachStream,
  AudioEngineError,
  ensureAudioContext,
  isInitialized,
  readBands,
  resumeIfSuspended,
} from '../audio/engine'
import type { AudioFrame } from '../core/types'

export type AudioSource = 'mic' | 'file' | null

export function useAudio() {
  const [enabled, setEnabled] = useState(false)
  const [source, setSource] = useState<AudioSource>(null)
  const [fileName, setFileName] = useState<string | undefined>(undefined)
  const mediaRef = useRef<HTMLAudioElement | null>(null)

  const enableMic = useCallback(async () => {
    ensureAudioContext()
    await resumeIfSuspended()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    attachStream(stream)
    setSource('mic')
    setEnabled(true)
  }, [])

  const enableFile = useCallback(async (file: File) => {
    ensureAudioContext()
    await resumeIfSuspended()
    const url = URL.createObjectURL(file)
    const el = new Audio(url)
    el.loop = true
    mediaRef.current = el
    attachMediaElement(el)
    try {
      await el.play()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new AudioEngineError(
          'Audio playback blocked: allow autoplay in browser settings or click anywhere on the page first'
        )
      }
      throw err
    }
    setFileName(file.name)
    setSource('file')
    setEnabled(true)
  }, [])

  const readFrame = useCallback((bpm: number): AudioFrame => {
    if (!isInitialized()) {
      return { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm }
    }
    const bands = readBands()
    return {
      bass: bands.bass,
      mid: bands.mid,
      treble: bands.treble,
      level: bands.level,
      spectrum: bands.spectrum.data,
      bpm,
    }
  }, [])

  return { enabled, source, fileName, enableMic, enableFile, readFrame }
}
