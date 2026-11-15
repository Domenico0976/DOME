import { useSyncExternalStore } from 'react'
import { soundCore } from '../sound/core.js'

// Render-path bridge to the audio switch. The core keeps `enabled` in a closure
// (no re-render per change), so anything that DRAWS from it subscribes here.
// Effects driven from rAF/event handlers keep calling `soundCore.isEnabled()`.
export function useSoundEnabled() {
  return useSyncExternalStore(
    (cb) => soundCore.subscribe(cb),
    () => soundCore.isEnabled(),
    () => true,
  )
}

// True while the browser is still refusing audio (no gesture yet). The invite
// chip keys on this; the audio owners clear it the moment they manage to start.
export function useSoundLocked() {
  return useSyncExternalStore(
    (cb) => soundCore.subscribe(cb),
    () => soundCore.isLocked(),
    () => false,
  )
}
