import { useCallback, useRef } from 'react'
import {
  AudioEngineError,
  attachMediaElement,
  attachStream,
  ensureAudioContext,
  isInitialized,
  readBands,
  resumeIfSuspended,
  setVolume,
} from '../audio/engine'
import { getAudioRuntime } from '../audio/runtime'
import { useProjectStore } from '../state/projectStore'
import type { AudioFrame } from '../core/types'

export type AudioSource = 'mic' | 'file' | null

/**
 * Single-owner hook. The AudioBar (the only component that calls this hook)
 * owns the live `<audio>` element and the microphone stream via `getAudioRuntime()`.
 * It reads the *identity* fields from the zustand store and writes them back
 * (source, fileName, enabled, volume, duration). Everyone else reads the store.
 */
export function useAudio() {
  const source = useProjectStore((s) => s.audio.source)
  const fileName = useProjectStore((s) => s.audio.fileName)
  const enabled = useProjectStore((s) => s.audio.enabled)
  const volume = useProjectStore((s) => s.audio.volume)
  const playing = useProjectStore((s) => s.timeline.playing)
  const durationSec = useProjectStore((s) => s.timeline.durationSec)
  const setAudioSource = useProjectStore((s) => s.setAudioSource)
  const setAudioFileName = useProjectStore((s) => s.setAudioFileName)
  const setAudioEnabled = useProjectStore((s) => s.setAudioEnabled)
  const setPlaying = useProjectStore((s) => s.setPlaying)
  const setTime = useProjectStore((s) => s.setTime)
  const setDuration = useProjectStore((s) => s.setDuration)

  const runtimeRef = useRef(getAudioRuntime())

  // Sync volume from the store into the runtime + Web Audio graph.
  const prevVolumeRef = useRef(volume)
  if (prevVolumeRef.current !== volume) {
    prevVolumeRef.current = volume
    setVolume(volume)
    runtimeRef.current.setVolume(volume)
  }

  const enableMic = useCallback(async () => {
    ensureAudioContext()
    await resumeIfSuspended()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    runtimeRef.current.setStream(stream)
    attachStream(stream)
    setAudioSource('mic')
    setAudioFileName(undefined)
    setAudioEnabled(true)
  }, [setAudioSource, setAudioFileName, setAudioEnabled])

  const enableFile = useCallback(
    async (file: File) => {
      ensureAudioContext()
      await resumeIfSuspended()
      const url = URL.createObjectURL(file)
      const el = new Audio(url)
      el.loop = true
      el.volume = volume
      runtimeRef.current.setMedia(el)
      attachMediaElement(el)
      // Populate duration from the element once metadata is available.
      const off = runtimeRef.current.onCanPlay(() => {
        const d = Number(el.duration)
        if (Number.isFinite(d) && d > 0) setDuration(d)
        off()
      })
      setAudioFileName(file.name)
      setAudioSource('file')
      setAudioEnabled(true)
    },
    [volume, setAudioFileName, setAudioSource, setAudioEnabled, setDuration],
  )

  const play = useCallback(async () => {
    const el = runtimeRef.current.media
    if (!el) return
    await resumeIfSuspended()
    try {
      await el.play()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new AudioEngineError(
          'Audio playback blocked: allow autoplay in browser settings or click anywhere on the page first',
        )
      }
      throw err
    }
    setPlaying(true)
  }, [setPlaying])

  const pause = useCallback(() => {
    const el = runtimeRef.current.media
    if (el) {
      try { el.pause() } catch { /* swallow */ }
    }
    setPlaying(false)
  }, [setPlaying])

  const seek = useCallback(
    (time: number) => {
      const el = runtimeRef.current.media
      if (!el) return
      const next = Math.max(0, Math.min(durationSec, Number(time) || 0))
      try { el.currentTime = next } catch { /* swallow */ }
      setTime(next)
    },
    [durationSec, setTime],
  )

  const readFrame = useCallback(
    (bpm: number): AudioFrame => {
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
    },
    [],
  )

  return {
    enabled,
    source,
    fileName,
    volume,
    playing,
    durationSec,
    enableMic,
    enableFile,
    play,
    pause,
    seek,
    readFrame,
  }
}