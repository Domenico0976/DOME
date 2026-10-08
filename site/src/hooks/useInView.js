import { useEffect, useRef, useState } from 'react'

// Section visibility gate — single source of truth for render-loop gating.
// rootMargin is positive on purpose: a loop started on intersect is one frame
// late and the section flashes before it animates.
const DEFAULT_MARGIN = '240px 0px'

// target: ref object or getter — the getter form is required for elements
// resolved after mount, which a plain ref would observe as null.
export function useInView({ margin = DEFAULT_MARGIN, threshold = 0, target, deps = [] } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = typeof target === 'function' ? target() : target?.current ?? ref.current
    // No observer support: never gate, so the effect stays visible.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: margin, threshold }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margin, threshold, ...deps])

  return [ref, inView]
}
