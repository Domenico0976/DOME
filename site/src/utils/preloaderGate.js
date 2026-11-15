// "Is the preloader still covering the page?"
//
// The hero sits behind the preloader from the first paint, so geometry cannot
// answer this: the section is in the viewport, it is just not the thing the
// visitor is looking at (or allowed to hear). The preloader root is the answer —
// and it stops being the gate the moment it is removed OR starts its cover fade
// (`preloader--reveal`), because from then on the home is what you see.
//
// Why the cache: this is asked on every pointermove, and a getComputedStyle per
// event is a layout read we do not need. Why the observers: a plain TTL left the
// hero silent for up to a whole cache window after the gate had already gone —
// the "fraction of a second where the hero moves but nothing sounds" bug. Any
// change to the gate (removed from the body, class flipped to reveal) invalidates
// the cached answer immediately, so the first stroke after the reveal is heard.
const TTL_MS = 200

let lastAt = -Infinity
let lastValue = false
let bodyObserver = null
let gateObserver = null
let watchedGate = null

function readCovering(el) {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.opacity === '0') return false
  // The cover phase is a fade of the root's own background: once it is reported
  // as reveal the page behind is the page the visitor is on.
  if (el.classList.contains('preloader--reveal')) return false
  if (cs.backgroundColor === 'transparent' || cs.backgroundColor === 'rgba(0, 0, 0, 0)') return false
  return true
}

function watch(el) {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
  if (!bodyObserver && document.body) {
    bodyObserver = new MutationObserver(() => {
      lastAt = -Infinity
    })
    bodyObserver.observe(document.body, { childList: true })
  }
  if (el && el !== watchedGate) {
    if (gateObserver) gateObserver.disconnect()
    watchedGate = el
    gateObserver = new MutationObserver(() => {
      lastAt = -Infinity
    })
    gateObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style'] })
  }
}

export function isPreloaderVisible(now = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
  if (now - lastAt < TTL_MS) return lastValue
  lastAt = now
  if (typeof document === 'undefined') {
    lastValue = false
    return lastValue
  }
  const el = document.getElementById('preloader')
  watch(el)
  lastValue = el ? readCovering(el) : false
  return lastValue
}

/** Tests only: forget the cached answer and drop the observers. */
export function resetPreloaderGate() {
  lastAt = -Infinity
  lastValue = false
  if (bodyObserver) bodyObserver.disconnect()
  if (gateObserver) gateObserver.disconnect()
  bodyObserver = null
  gateObserver = null
  watchedGate = null
}
