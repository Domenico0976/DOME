import { soundCore } from './core.js'

// The preloader's two doors.
//
// "Click anywhere" enters muted; the "Enter with sound" chip enters with ambient,
// clicks and the hero water live. The choice belongs to the visit, not to the
// browser profile: a visitor who entered quietly should not come back to a site
// that starts talking on its own because we remembered it. The header button
// remains the thing that persists an explicit choice.
//
// Kept as a separate, tiny function so the behaviour is testable without booting
// the preloader's WebGL: it takes the core explicitly.
export function applyEntryChoice({ withSound, core = soundCore }) {
  core.setEnabled(!!withSound, { persist: false })
  if (withSound) {
    // Runs inside the chip's own pointer/click gesture: the only moment the
    // platform lets an AudioContext come up. The hero's water engine and the
    // ambient both register an unlock handler, so one call starts both.
    return core.requestUnlock()
  }
  return Promise.resolve(false)
}
