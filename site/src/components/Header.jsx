import React, { useState, useCallback, useRef, useEffect } from 'react'

const AMBIENT_URL = () => import.meta.env.BASE_URL + 'assets/audio/Ambient/Ambient-music.mp3'

export default function Header() {
  const [muted, setMuted] = useState(true)
  const audioRef = useRef(null)

  // Create the ambient audio once.
  useEffect(() => {
    const audio = new Audio(AMBIENT_URL())
    audio.volume = 0.35
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      const audio = audioRef.current
      if (audio) {
        if (next) {
          audio.pause()
        } else {
          audio.play().catch(() => {})
        }
      }
      return next
    })
  }, [])

  return (
    <header className="site-header">
      <nav className="nav" aria-label="Primary">
        <a href="#top" className="brand">
          <span className="brand__dot" aria-hidden="true"></span>
          <span>DOME</span>
        </a>
        <div className="nav__menu">
          <span className="eyebrow" aria-hidden="true">Portfolio / 2022 – 2026</span>
          <button
            type="button"
            className={`sound${muted ? ' is-muted' : ''}`}
            aria-pressed={muted ? 'false' : 'true'}
            aria-label={muted ? 'Play ambient sound' : 'Mute ambient sound'}
            onClick={toggle}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
            <span>Sound</span>
          </button>
        </div>
      </nav>
    </header>
  )
}
