import { useEffect, useRef, useState } from 'react'

// Read the VISUAL viewport, not the layout one. `window.innerHeight` stays at its
// largest value when the browser UI expands, so sizing against it put the mobile
// cursor off the touch point and left dead space under the archives canvas.
const readViewport = () => {
  if (typeof window === 'undefined') return { width: 0, height: 0, offsetTop: 0, scale: 1 }
  const vv = window.visualViewport
  if (!vv) return { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, scale: 1 }
  return { width: vv.width, height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale }
}

// Two shapes on purpose. `viewport` is state, for the components that must re-render
// or re-measure (the archives canvas sizes itself from it). `viewportRef` is a ref
// that always holds the newest value, for the rAF loops that must not re-render.
export function useVisualViewport() {
  const viewportRef = useRef(readViewport())
  const [viewport, setViewport] = useState(viewportRef.current)

  useEffect(() => {
    const vv = window.visualViewport
    const onChange = () => {
      viewportRef.current = readViewport()
      setViewport(viewportRef.current)
    }
    onChange()
    if (!vv) {
      window.addEventListener('resize', onChange)
      return () => window.removeEventListener('resize', onChange)
    }
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
    }
  }, [])

  return { viewport, viewportRef }
}
