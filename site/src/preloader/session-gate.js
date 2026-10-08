// Session gate for the first-landing-only preloader.
//
// Strategy: a SYNC <head> script (in index.html) adds `no-preload` to <html>
// BEFORE first paint when sessionStorage already holds `pp:visited`. This
// module re-checks the same signal for the JS path and writes the flag at DONE.
//
// Everything is wrapped in try/catch so private-mode / disabled storage degrades
// to "always show" (the safe default) instead of throwing.

const KEY = 'pp:visited'

export function shouldRunPreloader() {
  try {
    if (sessionStorage.getItem(KEY)) return false
  } catch (_) {
    /* storage unavailable -> default to showing */
  }
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('no-preload')) {
    return false
  }
  return true
}

export function markVisited() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch (_) {
    /* ignore */
  }
}
