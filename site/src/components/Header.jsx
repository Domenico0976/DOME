import React, { useState, useCallback } from 'react'

export default function Header() {
  const [muted, setMuted] = useState(true)

  const toggle = useCallback(() => setMuted(prev => !prev), [])

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
            aria-label="Toggle ambient sound (placeholder)"
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
