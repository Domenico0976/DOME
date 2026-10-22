// Preloader timing, easing and grid — single source of truth for the phased
// animation. V3: ONE GL canvas holds ring + counter (scene.js composites the
// ring through a render target); the tile shader owns BOTH waves.
//
//   standby — ring scrolling, counter hidden (it fades up from the click),
//             front parked off the corner, scroll locked; the page waits
//   count   — click-driven: the count chases the real load (creep-floored)
//             toward 100 without ever parking while the front stays parked —
//             the crumble has NOT started yet, the rolling number IS the
//             motion. Crossing SEAL_TRIGGER starts the seal (if the load,
//             the app and the fonts are ready)
//   seal    — the wave-1 front is DRIVEN BY the count, not by the clock:
//             front = SEAL_FRONT_END * ((shown - SEAL_AT) / (1 - SEAL_AT)),
//             so the crumble tracks the rolling number with zero gap. The ring
//             dies first, the huge digits last (they hug the far corner).
//             Starts the moment the display crosses SEAL_TRIGGER (and only
//             then); the count never parks there, it rolls straight through
//   cover   — the SAME tile grid becomes a shrinking paper cover: the radius
//             starts at COVER_START and eases to 0, dying edge -> centre, so
//             the homepage composes through the same cells (no DOM mask)
//
// seal is NOT on the clock: it starts only when the display crosses SEAL_TRIGGER
// and the load is actually settled (or at SETTLED_WAIT_CAP in index.js), so the
// preloader self-completes in sync with the chunks, the shader warm-up and the
// mounted home — the pacing rule requested for V3.

export const TILE_SIZE = 42

export const FINAL_COUNT = 100

export const SEAL_TRIGGER = 80

export const SEAL_FRONT_END = 0.56

export const TIMELINE = {
  BOOT: 200,
  DIGIT_RISE: 600,
  OPEN: 4000,
  SEAL: 2200,
  REVEAL: 4000,
}

// Wave-2 cover: the radius (vr units — centre -> far corner = 0.5 of the
// diagonal length) starts large enough to cover every corner with margin and
// eases to 0, where the homepage's last cell appears at the exact centre.
export const COVER_START = 0.52

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Linear blended with smoothstep, so the curve has a NON-ZERO slope at both
// ends. Smootherstep stops dead at every phase join, which is what made the
// hand-over at 100 read as a freeze; this flows through it instead.
export function easeFlow(t) {
  const x = clamp01(t)
  return x * 0.55 + x * x * (3 - 2 * x) * 0.45
}

export function easeOutCubic(t) {
  const x = clamp01(t)
  return 1 - (1 - x) * (1 - x) * (1 - x)
}

export const FOLLOW = { halfLife: 90 } // ms

// Exponential decay, so the smoothing composes across frames and does not
// depend on the frame rate: two 50ms steps equal one 100ms step.
export function followFactor(dtMs, halfLife = FOLLOW.halfLife) {
  if (halfLife <= 0) return 1
  if (dtMs <= 0) return 0
  return 1 - Math.exp((-Math.LN2 * dtMs) / halfLife)
}

export function followStep(current, target, dtMs, halfLife = FOLLOW.halfLife, snap = false) {
  if (snap) return target
  return current + (target - current) * followFactor(dtMs, halfLife)
}

// Wave-2 cover radius: large -> 0 as the reveal advances, so the cover dies
// edge -> centre through the same tile cells wave 1 consumed. Monotone by
// construction: easeOutCubic is monotone and COVER_START is clamped positive.
export function coverRadius(p, { start = COVER_START } = {}) {
  return start * (1 - easeOutCubic(p))
}

// Wave-1 front: the sweep runs in one gesture, from the bite at the CENTRE to
// past the far corner. The count holds the front parked at sweepFront(0) and
// seal alone drives the sweep. The cover wave has its own radius driver above.
export function phaseFront(phase, p) {
  if (phase !== 'seal') return 0
  return easeFlow(p)
}

// The reduced-motion gate from webgl-gate-audit: when motion is reduced we must
// not mount WebGL at all, so no <canvas> exists in the DOM.
export function shouldMountGL(reducedMotion) {
  return !reducedMotion
}

// Indeterminate-progress floor for the counter.
//
// Real byte progress is a staircase: long flat stretches while one large chunk
// downloads, then a jump. A counter frozen mid-count reads as broken even when
// the number underneath it is honest, so the displayed value is the greater of
// real progress and a creep.
//
// It cannot lie in the direction that matters: the creep tops out below 1, so
// the counter cannot reach the seal trigger while work is outstanding. Note the
// ceiling is against the FULL 0..1 progress — index.js scales the display to
// FINAL_COUNT.
// tau is deliberately long: after the click-gate the count is a timed gesture
// that lasts as long as the sweep itself, not a chase after the network.
export const CREEP = { ceiling: 0.92, tau: 5000 }

export function creepProgress(elapsedMs, { ceiling = CREEP.ceiling, tau = CREEP.tau } = {}) {
  if (!(tau > 0)) return 0
  return ceiling * (1 - Math.exp(-Math.max(elapsedMs || 0, 0) / tau))
}

// The counter chases its target instead of snapping to it.
//
// The underlying value really is a step function — the last chunk either arrives
// or it does not — so printing it raw made the number sit still and then jump in
// a single frame. Two guarantees: it never exceeds the target (cannot claim more
// than the load delivered) and never moves backwards (a newly observed resource
// raises the byte denominator before it finishes). The snap at the end
// guarantees a definite FINAL_COUNT instead of an asymptote.
// Long half-life: the count must roll with the dissolve, one smooth gesture.
export const PROGRESS_FOLLOW = { halfLife: 280 }

export function displayProgress(current, target, dtMs, halfLife = PROGRESS_FOLLOW.halfLife) {
  const goal = Math.max(target, current)
  const next = followStep(current, goal, dtMs, halfLife)
  return goal - next < 0.001 ? goal : next
}
