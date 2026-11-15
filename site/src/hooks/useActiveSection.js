import { useEffect, useState } from 'react'

// Which `[data-hint-section]` element currently dominates the viewport.
//
// One IntersectionObserver for the whole page (same policy as gl/viewport.js).
// Markers may be NESTED (e.g. the focus callout lives inside the selected
// projects region): the one with the greatest visible ratio wins, so the inner
// block takes over when it fills the screen and the outer section takes back
// over once it scrolls past. Returns the marker's `data-hint-section` value, or
// null when nothing is meaningfully visible.
export function useActiveSection() {
  const [active, setActive] = useState(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') return
    const els = Array.from(document.querySelectorAll('[data-hint-section]'))
    if (!els.length) return

    const ratios = new Map()
    const pick = () => {
      let best = null
      let bestR = 0
      for (const [el, r] of ratios) {
        if (r > bestR) {
          bestR = r
          best = el
        }
      }
      setActive(best && bestR > 0.01 ? best.dataset.hintSection || null : null)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.intersectionRatio)
        pick()
      },
      { threshold: [0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return active
}
