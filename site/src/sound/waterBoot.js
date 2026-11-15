import { createWaterFlow } from './waterFlow.js'
import { soundCore } from './core.js'
import { isPreloaderVisible } from '../utils/preloaderGate.js'

// One water engine per page, booted before React.
//
// Why it cannot live inside the hero component: the first legal gesture often
// happens BEFORE React finishes mounting. The preloader's "CLICK TO ENTER" shell
// is clickable at ~0.5s; the hero effect attaches its listeners later. Measured:
// that missed click left the AudioContext `suspended` for the rest of the visit,
// so the water never sounded and no later mouse movement could fix it (a mouse
// move is not a user activation). The listener has to exist from the first
// possible millisecond, which means module scope, next to `initClickSound`.
//
// This module owns the context and the arming listeners only. The hero hook reads
// the same engine for its voices, so there is exactly one AudioContext and no
// duplicate unlock path.

let engine = null
let booted = false

const GESTURES = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchstart', 'touchend']
const CAPTURE = { capture: true, passive: true }

export function getWaterEngine() {
  if (!engine) engine = createWaterFlow()
  return engine
}

export function bootWaterSound() {
  if (booted || typeof window === 'undefined') return null
  booted = true

  const e = getWaterEngine()
  // Only warms the HTTP cache: no AudioContext is created here, because a context
  // built before a gesture is exactly what Chrome blocks for the whole session.
  e.warm()

  const arm = () => {
    if (!soundCore.isEnabled()) return
    // Keep the water shut while the preloader is up: no voices, and no
    // AudioContext either (the entry chip creates it if the visitor wants sound).
    if (isPreloaderVisible()) return
    e.unlock()
    // The state flips asynchronously; one microtask later it is readable.
    Promise.resolve().then(() => {
      if (e.isRunning()) soundCore.setLocked(false)
    })
  }

  // Kept for the page lifetime: a resume is a no-op once running, and the first
  // gesture of the visit is the only chance to unlock before the hero mounts.
  // Capture phase, so no handler in the page can hide that gesture from us.
  for (const type of GESTURES) window.addEventListener(type, arm, CAPTURE)

  return e
}
