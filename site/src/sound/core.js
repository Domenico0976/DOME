// One switch for every sound on the site.
//
// Before this module the site had three independent audio sources and no owner:
// the click sound was always on (no way to silence it), and the ambient track
// lived in Header with its own private `muted` flag. The header button therefore
// only ever controlled the ambient, while clicks kept firing regardless.
//
// Everything that makes noise now reads its permission from here:
//   - clickSound  → skips playback when disabled
//   - Header      → plays/pauses the ambient loop on change
//   - waterFlow   → fades its voices out and refuses new ones
//
// Default is ON (the button starts enabled, as requested). An explicit OFF is
// remembered so a visitor who silenced the site does not get it back on reload.
//
// Written as a factory plus one shared instance: the factory is what the tests
// drive, the instance is what the app imports. No React in here on purpose —
// `src/hooks/useSoundEnabled.js` is the render-path bridge.

const STORAGE_KEY = 'dome:sound'

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    // Private mode / storage disabled: sound still works, it just is not remembered.
    return null
  }
}

export function createSoundCore({ storage = safeStorage() } = {}) {
  let enabled = true
  try {
    // Anything other than an explicit 'off' means on.
    enabled = storage?.getItem(STORAGE_KEY) !== 'off'
  } catch {
    enabled = true
  }

  // `locked` is the platform, not the user: browsers keep every audio API shut
  // until the page has had a real gesture. It ALWAYS starts locked and only a
  // proven start clears it (a context that actually reached `running`, a media
  // element that actually played).
  //
  // Do not seed it from `navigator.userActivation.hasBeenActive`: measured in a
  // fresh incognito tab it already reports `true` on a page nobody has touched
  // (and still refuses the AudioContext), which hid the invite exactly when it
  // was needed and left the visitor with a silent page and no way in.
  let locked = true
  const listeners = new Set()
  const unlockers = new Set()

  const notify = () => {
    for (const fn of [...listeners]) {
      try {
        fn(enabled)
      } catch {
        // A subscriber throwing must not stop the others from learning the news.
      }
    }
  }

  const setEnabled = (next, { persist = true } = {}) => {
    const value = next !== false
    if (value === enabled) return value
    enabled = value
    if (persist) {
      try {
        storage?.setItem(STORAGE_KEY, value ? 'on' : 'off')
      } catch {
        // Not being able to remember the choice is not a reason to refuse it.
      }
    }
    notify()
    return value
  }

  const setLocked = (next) => {
    const value = next !== false
    if (value === locked) return value
    locked = value
    notify()
    return value
  }

  return {
    isEnabled: () => enabled,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    setEnabled,
    toggle: () => setEnabled(!enabled),

    /** True while the browser refuses to make sound (no user activation yet). */
    isLocked: () => locked,
    setLocked,

    /**
     * Register a "make some noise now" handler. Each audio owner (ambient,
     * water) adds one; `requestUnlock()` runs them all inside the user's click,
     * which is the only place the platform allows it.
     */
    onUnlockRequest(fn) {
      unlockers.add(fn)
      return () => unlockers.delete(fn)
    },

    /** Run every unlock handler. True when at least one succeeded. */
    requestUnlock: async () => {
      const results = await Promise.all(
        [...unlockers].map(async (fn) => {
          try {
            return !!(await fn())
          } catch {
            return false
          }
        }),
      )
      const ok = results.some(Boolean)
      if (ok) setLocked(false)
      return ok
    },
  }
}

export const soundCore = createSoundCore()
export { STORAGE_KEY as SOUND_STORAGE_KEY }
