import { useState, useEffect } from 'react'
import { MOBILE_BREAKPOINT } from '../constants/breakpoints.js'

export { MOBILE_BREAKPOINT }

export function useIsMobile() {
  // matchMedia, not innerWidth: on mobile the URL bar resizes innerWidth while
  // the device stays put, which could flip the mode mid-scroll. It also matches
  // the CSS `@media (max-width: 720px)` boundary, where `innerWidth < 720` did
  // not (720 was desktop in JS but mobile in CSS).
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const on = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  return isMobile
}
