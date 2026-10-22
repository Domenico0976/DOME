// Wavefront profile — single source of truth for the disintegration front that
// drives the wave-1 centre-out sweep (star first, digits last); wave 2 is the
// cover radius over the same grid, driven by config.coverRadius, not by this
// front (the front just parks at sweepFront(1) while the cover closes).
//
// A tile is only alive in a thin band AROUND the front: it materialises exactly
// when the front reaches it and is gone a moment later, behind the front. With
// the front parked and tiles disabled, nothing is alive at all — that is what
// keeps the 000 state free of any visible grid.
//
// These numbers are uploaded to the shader as uBand / uTrail, so the GLSL and
// the unit tests can never drift apart.

export const FRONT_PROFILE = {
  band: 0.22, // total depth alive ahead of the front
  core: 0.14, // fully-lit plateau inside the band, so many tiles burn at once
  trail: 0.035, // short decaying tail behind the front (the disintegration snap)
}

export function frontActivation(distance, front) {
  const lead = distance - front
  if (lead >= 0) {
    if (lead >= FRONT_PROFILE.band) return 0
    if (lead <= FRONT_PROFILE.core) return 1
    const span = FRONT_PROFILE.band - FRONT_PROFILE.core
    return 1 - (lead - FRONT_PROFILE.core) / span
  }
  const behind = -lead
  if (behind >= FRONT_PROFILE.trail) return 0
  return 1 - behind / FRONT_PROFILE.trail
}

// Pane inflation: 0 -> 1 -> 0 across a single tile pass. Peaks when the front
// crosses the tile centre, so the tile swells along its whole side and relaxes
// again on both sides of the crossing.
export function swellCurve(a) {
  if (a <= 0 || a >= 1) return 0
  return Math.sin(a * Math.PI)
}

// Map a 0..1 phase onto a front that begins fully off-screen and ends past the
// far corner, so no tile is alive at 000 and none survives the wave.
export function sweepFront(p) {
  return -FRONT_PROFILE.band + p * (1 + 2 * FRONT_PROFILE.band)
}

// The pane opens further along its top edge than its bottom one, so the tile
// reads as lifting off the ground rather than inflating symmetrically.
export function upwardBias(swell) {
  return 1 + 0.85 * swell
}

// Vertical displacement in cell units. Negative is upward (screen y grows
// downward); zero at both ends of the pass, peak in the middle.
export function liftOffset(swell) {
  const s = Math.max(0, Math.min(1, swell))
  if (s <= 0 || s >= 1) return 0
  return -Math.sin(s * Math.PI) * 0.22
}
