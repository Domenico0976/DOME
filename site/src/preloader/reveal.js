// Wave 2 creates the homepage: instead of the canvas dissolving, the app root
// itself is unmasked by a soft radial mask growing from the top-left corner,
// and the fluted-glass band rides exactly on the mask border.
//
// The radius is derived from the SAME sweepFront() value the shader receives,
// so the glass and the homepage edge can never drift apart.

export const REVEAL_FEATHER = 90

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// `front` is the already-mapped sweep value (-band .. 1+band).
export function revealRadius(front, width, height) {
  return Math.max(0, front) * Math.hypot(width, height)
}

export function revealMask(distance, radius) {
  return 1 - smoothstep(radius - REVEAL_FEATHER, radius, distance)
}

export function revealMaskImage(radius) {
  const inner = Math.max(0, radius - REVEAL_FEATHER)
  return `radial-gradient(circle ${radius}px at 0 0, rgba(0,0,0,1) 0, rgba(0,0,0,1) ${inner}px, rgba(0,0,0,0) ${radius}px)`
}
