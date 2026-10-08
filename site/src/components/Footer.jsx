import React, { useEffect } from 'react'

// Footer reproduced from the DOME site: interactive dotted-grid canvas
// (dynamic shapes, click cycles the 5 patterns, hover collapse + trail,
// top-band pixel rain rising from the dots themselves) with a plain text
// row underneath.
export default function Footer() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.DottedGrid !== 'function') return
    const instance = new window.DottedGrid()
    return () => instance.destroy()
  }, [])

  return (
    <footer className="dotted-grid-footer">
      <div className="dotted-grid-hint">
        <p>CLICK TO CHANGE SHAPE</p>
      </div>
      <canvas id="dotted-grid-bg" data-managed="footer" />
      <div className="dotted-grid-meta">
        <p className="dotted-grid-line dotted-grid-line--strong">© 2026 by Domenico Fusto</p>
        <p className="dotted-grid-line">Made with ❤️</p>
      </div>
    </footer>
  )
}
