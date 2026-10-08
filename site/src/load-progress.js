// Real load progress for the preloader.
//
// The preloader used to run a fixed choreography — counter 000 -> 100 over 2400ms
// — and only *afterwards* wait (capped at 1500ms) for the app to say it was ready.
// That is a decoration pretending to be a loading screen: on a cold load the entry
// chunk kept streaming for seconds after the counter hit 100, and the site was
// uncovered while it was still arriving.
//
// This module is the single source of truth the preloader animates against. It
// combines two signals because neither is sufficient alone:
//
//   1. Resource Timing bytes. Smooth, and it reflects what the network has
//      actually delivered so far, so the counter can move continuously.
//   2. Registered promises. Byte progress says nothing about parse and evaluate,
//      and the reveal must not happen until the modules have actually run.
//
// Progress is monotonic. A late, small resource must never walk the counter
// backwards while the user is watching it climb.

const listeners = new Set()
const settled = []

// The preloader and the app are separate entry points and either can win the
// race to start. The preloader asks "is everything loaded?" within a few
// milliseconds of boot — long before main.jsx has registered the shader chunk —
// and a bare Promise.all([]) resolves instantly, which read as 100% loaded and
// uncovered the site before the 2.4 MB chunk had arrived. So readiness has two
// conditions: registrations must be CLOSED, and every registered promise must
// have resolved. sealRegistrations() is what closes them.
let registrationSealed = false
let sealRegistrations_ = () => {}
const registrationsClosed = new Promise((resolve) => {
  sealRegistrations_ = resolve
})

let loadedBytes = 0
let totalBytes = 0
let done = false
let observed = false

function emit() {
  // 0.995 floor: the counter must not read 100 while work is still landing. The
  // preloader needs a visible gap between "nearly" and "ready".
  const raw = totalBytes > 0 ? loadedBytes / totalBytes : 0
  const p = done ? 1 : Math.min(0.995, raw)
  for (const fn of listeners) fn(p)
}

function onResource(entry) {
  if (!entry.name.includes('/assets/') && !entry.name.endsWith('.js')) return
  const size = entry.encodedBodySize || entry.transferSize || 0
  if (size <= 0) return
  totalBytes += size
  if (entry.responseEnd > 0) loadedBytes += size
  emit()
}

export function startObserving() {
  if (observed || typeof PerformanceObserver === 'undefined') return
  observed = true
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) onResource(e)
    })
    po.observe({ type: 'resource', buffered: true })
  } catch (_) {
    /* no Resource Timing: the promises alone still gate the reveal */
  }
}

export function registerLoad(promise) {
  if (registrationSealed) {
    console.warn('[load] registerLoad after sealRegistrations; readiness is already sealed')
  }
  const p = Promise.resolve(promise).catch((err) => {
    console.error('[load] chunk failed', err)
  })
  settled.push(p)
  return p
}

export function sealRegistrations() {
  if (registrationSealed) return
  registrationSealed = true
  sealRegistrations_()
}

export function whenSettled() {
  return registrationsClosed.then(() => Promise.all(settled))
}

export function isSettled() {
  return done
}

export function onProgress(fn) {
  listeners.add(fn)
  fn(done ? 1 : 0)
  return () => listeners.delete(fn)
}

export function markDone() {
  done = true
  emit()
}
