// Preloader timing, easing and grid — single source of truth for the phased
// animation.
//
//   boot    — the grey opening appears, counter at 000, no tile alive
//   open    — the counter tracks real load progress while the front eats the
//             first HALF of the canvas
//   seal    — the counter is at 100 and the front completes the canvas
//   reveal  — the same gesture again from the top-left corner: the homepage
//             appears through the tiles
//
// boot and the reveal are on the clock. open is NOT: it ends when the load is
// actually settled, or at SETTLED_WAIT_CAP in index.js, whichever comes first —
// so the front can still be mid-canvas when the timeline's nominal OPEN duration
// has elapsed. The TIMELINE durations below shape the gesture; they no longer
// decide when the site is uncovered.

export const TILE_SIZE = 42

export const TIMELINE = {
  BOOT: 200,
  OPEN: 2400,
  SEAL: 1000,
  REVEAL: 2400,
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Linear blended with smoothstep, so the curve has a NON-ZERO slope at both
// ends. Smootherstep stops dead at every phase join, which is what made the
// hand-over at 100 read as a freeze; this flows through it instead.
export function easeFlow(t) {
  const x = clamp01(t)
  return x * 0.55 + x * x * (3 - 2 * x) * 0.45
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

// While the app is still mounting the animation must not park: the target keeps
// drifting so the glass band stays alive instead of the screen going static.
export function idleFront(elapsedMs, from = 0.9, amp = 0.06, periodMs = 2400) {
  return from + amp * Math.sin((elapsedMs / periodMs) * Math.PI * 2)
}

export function phaseFront(phase, p) {
  const e = easeFlow(p)
  if (phase === 'open') return e * 0.5
  if (phase === 'seal') return 0.5 + e * 0.5
  if (phase === 'reveal') return e
  return 0
}

// The reduced-motion gate from webgl-gate-audit: when motion is reduced we must
// not mount WebGL at all, so no <canvas> exists in the DOM.
export function shouldMountGL(reducedMotion) {
  return !reducedMotion
}

// Indeterminate-progress floor for the counter.
//
// Real byte progress is a staircase: long flat stretches while one large chunk
// downloads, then a jump. A counter frozen at 47 for a second reads as broken
// even when the number underneath it is honest, and "stuck" is the complaint this
// exists to answer. So the displayed value is the greater of the real progress and
// a creep that approaches — and never reaches — 100.
//
// It cannot lie in the direction that matters: the creep tops out below 1, so the
// counter can never read 100 while work is outstanding, and the preloader only
// prints 100 once the load is genuinely settled.
export const CREEP = { ceiling: 0.92, tau: 2600 }

export function creepProgress(elapsedMs, { ceiling = CREEP.ceiling, tau = CREEP.tau } = {}) {
  if (!(tau > 0)) return 0
  return ceiling * (1 - Math.exp(-Math.max(elapsedMs || 0, 0) / tau))
}

// The counter chases its target instead of snapping to it.
//
// The underlying value really is a step function — the last chunk either arrives
// or it does not — so printing it raw made the number sit still and then jump to
// 100 in a single frame. That reads as a glitch, not as progress.
//
// Two guarantees, and they are the reason this is not just decoration. It never
// exceeds the target, so it cannot claim more than the load delivered; and it
// never moves backwards, because the byte ratio feeding it can dip — a newly
// observed resource raises the denominator before it finishes — and a counter
// that walks back down reads as broken. The snap at the end is what guarantees a
// definite 100 instead of an asymptote.
export const PROGRESS_FOLLOW = { halfLife: 110 }

export function displayProgress(current, target, dtMs, halfLife = PROGRESS_FOLLOW.halfLife) {
  const goal = Math.max(target, current)
  const next = followStep(current, goal, dtMs, halfLife)
  return goal - next < 0.001 ? goal : next
}

// Normalized reveal progress driven by elapsed time since revealStart.
// Returns 0 before a valid revealStart is set and clamps to 1 on overshoot,
// so a delayed reveal still runs the full TIMELINE.REVEAL duration.
export function revealProgress(now, revealStart, duration = TIMELINE.REVEAL) {
  if (!revealStart) return 0
  const p = (now - revealStart) / duration
  if (p < 0) return 0
  if (p > 1) return 1
  return p
}
