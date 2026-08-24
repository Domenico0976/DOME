import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { attachMediaElement, ensureAudioContext, resumeIfSuspended } from '../audio/engine'
import { CODEC_ERROR_MESSAGE, bindMediaElement } from '../audio/media-binding'

// The TransportBar owns the single <audio> element of the app. When a Sound
// Block node is placed, the same element is shared through bindMediaElement,
// so audio always flows through the singleton analyser — no cables needed.
export function TransportBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [hasSource, setHasSource] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isEnded, setIsEnded] = useState(false)
  const [autoLoop, setAutoLoop] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = audioRef.current
    if (element === null) return
    const handlePlay = (): void => {
      setIsPlaying(true)
      setIsEnded(false)
      setError(null)
    }
    const handlePause = (): void => {
      setIsPlaying(false)
    }
    const handleEnded = (): void => {
      setIsPlaying(false)
      setIsEnded(true)
    }
    element.addEventListener('play', handlePlay)
    element.addEventListener('pause', handlePause)
    element.addEventListener('ended', handleEnded)
    return () => {
      element.removeEventListener('play', handlePlay)
      element.removeEventListener('pause', handlePause)
      element.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  // Must only be called from user-gesture handlers: the AudioContext is
  // created (and resumed) synchronously inside the click/change handler.
  const activateAudioGraph = useCallback((): void => {
    ensureAudioContext()
    void resumeIfSuspended()
    const element = audioRef.current
    if (element !== null) attachMediaElement(element)
  }, [])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget
      const file = input.files?.[0]
      const element = audioRef.current
      if (file === undefined || element === null) return
      if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      element.src = url
      element.loop = autoLoop
      setIsEnded(false)
      setIsPlaying(false)
      setError(null)
      setHasSource(true)
      bindMediaElement(element)
      try {
        activateAudioGraph()
      } catch {
        // No AudioContext yet in this browser: it will be created on the
        // first Play click, which is always a user gesture.
      }
    },
    [activateAudioGraph, autoLoop],
  )

  const handleTogglePlay = useCallback((): void => {
    const element = audioRef.current
    if (element === null || !hasSource) return
    activateAudioGraph()
    if (element.paused) {
      element.play().catch(() => setError(CODEC_ERROR_MESSAGE))
    } else {
      element.pause()
    }
  }, [activateAudioGraph, hasSource])

  const handleLoopToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.checked
    setAutoLoop(next)
    const element = audioRef.current
    if (element !== null) element.loop = next
  }, [])

  return (
    <div className="transport-bar">
      <label className="transport-load" htmlFor="transport-audio-input">
        Load audio
      </label>
      <input
        id="transport-audio-input"
        className="transport-file-input"
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
      />
      <button type="button" onClick={handleTogglePlay} disabled={!hasSource}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <label className="transport-loop">
        <input type="checkbox" checked={autoLoop} onChange={handleLoopToggle} />
        Loop
      </label>
      {!hasSource ? <span className="transport-status">Load an audio file to start</span> : null}
      {hasSource && isEnded && !autoLoop ? (
        <span className="transport-status">Ended</span>
      ) : null}
      {error !== null ? <span className="transport-error">{error}</span> : null}
      <audio ref={audioRef} hidden preload="auto" />
    </div>
  )
}
