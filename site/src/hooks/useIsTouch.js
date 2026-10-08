import { useState, useEffect } from 'react'

// "Does this device have a finger?", not "is it narrow?".
//
// The 720px useIsMobile() answers a LAYOUT question and must stay there. This one
// answers an INPUT question, and the two are genuinely different: a phone is touch
// at 390px, a tablet is touch at 1024px and 1366px, and a desktop browser dragged
// down to 700px is still neither.
//
// CHANGED 2026-09-30, twice. First from `(any-pointer: coarse)` to a digitised
// check that ALSO excluded a fine primary pointer — which reclassified a
// touchscreen laptop with a mouse attached as DESKTOP. The user reverted that: a
// device with a digitiser must show the DIGITISED version even with a mouse docked.
// So the rule is now simply "has a digitiser", which is also what the original
// `any-pointer` comment was reaching for. Pinned by
// tests/hooks/useIsTouch.digitization.test.js so the hybrid case stays deliberate.
export const TOUCH_POINTER_QUERY = '(pointer: coarse)'

function isDigitisedTouch() {
  if (typeof window === 'undefined') return false
  return (navigator.maxTouchPoints || 0) > 0
}

export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(isDigitisedTouch)

  useEffect(() => {
    // A digitiser can be attached or detached at runtime (a tablet dock, a
    // convertible folded back to laptop mode), so re-read on mount rather than
    // trusting the lazy initialiser alone.
    setIsTouch(isDigitisedTouch())
  }, [])

  return isTouch
}
