// Hero bottom-edge alpha-dither mask generator.
//
// Returns a PNG data-URL that can be used as `mask-image` on the hero section.
// The pattern is deterministic for a given seed and dimensions — same inputs
// always produce the same output, even across resizes.
//
// ponytail: downsample — the bitmap is scaled DOWN so width ≤~700px (scale
// = ceil(w/700) capped at dprClamp=2; e.g. a 1043px-wide hero gets scale=2,
// giving a 522×710 bitmap). mask-size: 100% 100% upscales back at paint time.
// ponytail: center-anchored concave edge — the edge is pinned at its center
// (edgeBaseY) and lifts toward the sides by curveD per column, creating a
// concave bowl. curveDepthRatio scales the depth with hero width (clamped),
// so the arc spans the full width on any viewport; the dither follows the
// whole curve.
// On top of the bowl, a seeded cosine-interpolated wobble (edgeWobblePx /
// edgeWobblePoints) makes the boundary undulate so it never reads as a
// straight horizontal line of points (req. 2026-10-02).
// Tail: uniform grid cells (no jitter), Bayer-ordered keep/drop blended with
// seeded random (orderWeight), sizes shrink with depth; first rows fully solid.
// ponytail: webkitMaskMode doesn't exist in Safari; the default is alpha, which
// is what we need here because kept cells have alpha=1 and skipped ones alpha=0.

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32. No Math.random anywhere in this module.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t >>> 7, 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Bayer 8x8 ordered threshold. rank in [0,1) spreads keep/drop decisions over
// the grid in a fixed cascade order: structured at a glance, never clumpy.
// Combined below with one seeded random draw per cell (orderWeight blend).
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

// Deterministic 1-D value noise along the edge: seeded control points,
// cosine-interpolated so the boundary undulates smoothly instead of stepping
// randomly. f(u) in [-1, 1] for u in [0, 1].
function makeEdgeNoise(seed, points) {
  const rng = mulberry32(seed)
  const vals = new Array(points + 1)
  for (let i = 0; i <= points; i++) vals[i] = rng() * 2 - 1
  return (u) => {
    const x = Math.min(Math.max(u, 0), 1) * points
    const i = Math.min(points - 1, Math.floor(x))
    const f = x - i
    const s = (1 - Math.cos(f * Math.PI)) / 2
    return vals[i] + (vals[i + 1] - vals[i]) * s
  }
}

// Edge offset in bitmap px relative to edgeBaseY, for u in [0, 1]:
// concave bowl (sides lift by curveD) plus the wobble.
function edgeShapeAt(u, curveD, wobAmp, noise) {
  const nx = u * 2 - 1
  return -nx * nx * curveD + wobAmp * noise(u)
}

// Deterministic per-column crumble in [-1, 1]: integer hash, no stream, so the
// value depends only on (column, seed) — stable across frames and resizes.
function crumbleAt(cx, seed) {
  let h = Math.imul(cx + 1, 2654435761) ^ seed
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  return ((h >>> 0) / 4294967296) * 2 - 1
}

// ---------------------------------------------------------------------------
// Central config — hand-tuned, sacred values.
// ponytail: no config UI, no runtime overrides. Edit this object to tune.
// ---------------------------------------------------------------------------
export const HERO_EDGE_CONFIG = {
  edgeLiftRatio: 0.2,        // tail zone height fraction — cascade must START >=20% above the section bottom (req. 2026-10-02)
  curveDepthRatio: 0.065,     // concavity amplitude as fraction of hero WIDTH so the arc spans 100% of the edge, not just the center (req. 2026-10-02)
  curveDepthMinPx: 22,        // clamp floor for narrow viewports (mobile)
  curveDepthCapPx: 110,       // clamp ceiling for ultra-wide so sides don't hit the bitmap top
  edgeWobblePx: 10,           // organic edge amplitude in CSS px — kills the straight/linear reading of the boundary; kept well under the curve depth so noise never buries the arc
  edgeWobblePoints: 9,       // seeded control points across the width (density of the undulation)
  edgeCrumblePx: 14,         // per-column raggedness in CSS px — indentations/protrusions that crumble the boundary; quantized by the cell grid into a natural eroded edge
  cellSizePx: 16,            // chunky per reference (~15–35px on 1315px-wide image)
  edgeSolidRows: 1,          // single full row below the edge: softer crumbled top, cascade starts immediately
  orderWeight: 0.7,          // keep/drop blend: 1 = pure Bayer order, 0 = pure random
  orderRamp: [0.15, 0.45],   // depth range where Bayer order fades in: above it pure random speckle (no dotted contour along the curve)
  fullT: 0.35,             // depth below which kept cells stay full-size: full cells tile flush, so no 1px slits can align along the curve in the dense zone
  sizeDecay: 0.7,            // past fullT, cells shrink with depth: size = cellSz * (1 - sizeDecay*(t-fullT)/(1-fullT))
  tailDecay: 2,              // tail density = (1-t)^tailDecay * tailStrength
  tailStrength: 1,           // full density right below the solid rows
  loopFrames: 40,            // animation loop length in mask frames
  rainRange: 3,              // rain fall range, in cell units
  seed: 12345,
  dprClamp: 2,               // cap on bitmap scale factor
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Generate a PNG data-URL alpha mask for the hero bottom-edge dissolve.
 *
 * @param {object} params
 * @param {number} params.width  — CSS pixel width of the hero section
 * @param {number} params.height — CSS pixel height of the hero section
 * @param {object} [config]      — override defaults (spread over HERO_EDGE_CONFIG)
 * @param {number} [frame]       — animation frame; motion is periodic in frame
 *                                 (loops every loopFrames), so the loop is seamless
 * @returns {string} PNG data-URL suitable for `mask-image` / `webkitMaskImage`
 */
export function generateHeroEdgeMask({ width, height, frame = 0, config }) {
  const cfg = { ...HERO_EDGE_CONFIG, ...(config || {}) }

  // ponytail: downsample — bitmap is ≤~700px wide, then upscaled by mask-size
  // 100% 100% at paint time. Dots stay square; cost drops from megapixels to
  // kilopixels.
  const scale = Math.min(Math.max(1, Math.ceil(width / 700)), cfg.dprClamp)
  const bitmapW = Math.ceil(width / scale)
  const bitmapH = Math.ceil(height / scale)

  const tailH = Math.ceil(cfg.edgeLiftRatio * bitmapH)
  const edgeBaseY = bitmapH - tailH
  const cellSz = Math.max(2, Math.round(cfg.cellSizePx / scale))
  const curvePx = Math.min(cfg.curveDepthCapPx,
    Math.max(cfg.curveDepthMinPx, cfg.curveDepthRatio * width))
  const curveD = Math.max(1, Math.round(curvePx / scale))
  const wobAmp = cfg.edgeWobblePx / scale

  const cols = Math.ceil(bitmapW / cellSz)
  const rows = Math.ceil(bitmapH / cellSz)

  // Per-column edge (bowl + wobble), clamped to the bitmap. Both the staircase
  // fill and the cell loop read from this array so solid region and dither can
  // never disagree about the boundary. minEdgeY is the array min (the wobble
  // can lift a column above the bowl's side extreme).
  const noise = makeEdgeNoise((cfg.seed ^ 0x9e3779b9) >>> 0, cfg.edgeWobblePoints)
  const crumbleAmp = cfg.edgeCrumblePx / scale
  const colEdgeY = new Array(cols)
  let minEdgeY = Infinity
  for (let cx = 0; cx < cols; cx++) {
    const u = (cx * cellSz + cellSz / 2) / bitmapW
    const ey =
      edgeBaseY +
      edgeShapeAt(u, curveD, wobAmp, noise) +
      crumbleAmp * crumbleAt(cx, cfg.seed)
    colEdgeY[cx] = Math.max(0, Math.min(bitmapH - 1, ey))
    if (colEdgeY[cx] < minEdgeY) minEdgeY = colEdgeY[cx]
  }

  // Fast path: the entire region above the band is uniformly opaque — fill it
  // in one draw call instead of iterating cell by cell.
  const rng = mulberry32(cfg.seed)
  const LOOP = Math.max(1, Math.round(cfg.loopFrames))
  const motionRng = mulberry32((cfg.seed ^ 0xBEEF) >>> 0)
  const ss01 = (x) => {
    const k = Math.min(1, Math.max(0, x))
    return k * k * (3 - 2 * k)
  }
  const loopTOf = (ph, spd) => (((frame * spd + ph * LOOP) / LOOP) % 1 + 1) % 1

  const canvas = document.createElement('canvas')
  canvas.width = bitmapW
  canvas.height = bitmapH
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, bitmapW, bitmapH)

  // Integer snap: fractional fillRect Y coordinates get antialiased, and the
  // solid fill + staircase each contribute a partial row whose composited
  // alpha stays below 1 — a straight translucent seam across the full width
  // right where the dither starts. Floor for the solid top of the staircase,
  // ceil for its per-column bottom; overlap by one row so the union is
  // always fully opaque.
  const minEdgeYInt = Math.max(0, Math.floor(minEdgeY))

  // Solid hero fills down through the highest point of the edge.
  if (minEdgeYInt >= 0) {
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.fillRect(0, 0, bitmapW, minEdgeYInt + 1)
  }

  // Continuous stair-stepped solid column fill follows the edge; chunky pixel
  // edges come from the cellSz quantization, dither stays exclusively BELOW it.
  ctx.fillStyle = 'rgba(0,0,0,1)'
  for (let cx = 0; cx < cols; cx++) {
    const top = minEdgeYInt + 1
    const bottom = Math.ceil(colEdgeY[cx])
    const h = bottom - top
    if (h > 0) ctx.fillRect(cx * cellSz, top, cellSz, h)
  }

  // Tail cells below the bowl edge: strict grid, keep/drop by Bayer order blended
  // with one seeded draw per cell, sizes shrinking deterministically with depth.
  // Kept cells fall as rain with periodic offsets (speeds quantized to loop
  // divisors so every cell returns to base after LOOP frames). Streams run in
  // fixed order: output is a pure function of (width, height, frame, seed).
  const startRow = Math.max(0, Math.floor(minEdgeY / cellSz))
  for (let ry = startRow; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const cellCx = cx * cellSz + cellSz / 2
      const cellCy = ry * cellSz + cellSz / 2
      const edgeY = colEdgeY[cx]

      if (cellCy < edgeY) {
        // Solid above the curve — already painted by the column staircase above;
        // skip so no rng is consumed here and determinism stays tail-only.
        continue
      }

      // TAIL: below the edge, thinning to nothing at bitmap bottom.
      // Per-column denominator so fade length follows the curve exactly.
      const t = Math.min(1, Math.max(0, (cellCy - edgeY) / (bitmapH - edgeY + 0.001)))
      const rowsBelow = (cellCy - edgeY) / cellSz

      let keep = false
      let sizeK = 1
      if (rowsBelow < cfg.edgeSolidRows) {
        keep = true
      } else {
        const density = Math.pow(1 - t, cfg.tailDecay) * cfg.tailStrength
        const rank = (BAYER8[ry & 7][cx & 7] + 0.5) / 64
        const ramp = Math.min(1, Math.max(0, (t - cfg.orderRamp[0]) / (cfg.orderRamp[1] - cfg.orderRamp[0])))
        const ow = cfg.orderWeight * ramp * ramp * (3 - 2 * ramp)
        const score = ow * rank + (1 - ow) * rng()
        keep = score < density
        sizeK = t < cfg.fullT ? 1 : 1 - cfg.sizeDecay * ((t - cfg.fullT) / (1 - cfg.fullT))
      }
      if (!keep) continue

      const ph = motionRng()
      const spd = motionRng() < 0.35 ? 2 : 1
      const loopT = loopTOf(ph, spd)
      const dy = loopT * cfg.rainRange * cellSz
      const shrink = 1 - 0.9 * ss01((loopT - 0.7) / 0.3)

      const cellS = Math.max(1, Math.round(cellSz * sizeK * shrink))
      const x = Math.max(0, Math.round(cellCx - cellS / 2))
      // Seam lock: the staircase ends at ceil(edgeY) but grid phase can leave
      // a slit before the first tail row — stretch that row up to the staircase.
      const seam = Math.ceil(edgeY)
      let top = Math.round(cellCy + dy - cellS / 2)
      if (top > seam && top - seam < cellSz) top = seam
      top = Math.max(0, top)
      const bottom = Math.round(cellCy + dy + cellS / 2)
      const drawW = Math.min(bitmapW - x, cellS)
      const drawH = Math.min(bitmapH - top, bottom - top)
      if (drawW > 0 && drawH > 0) {
        ctx.fillRect(x, top, drawW, drawH)
      }
    }
  }

  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// Self-check: runnable under Node via `node --input-type=module` (or
// imported in a test harness). Guards against silent regressions.
// ---------------------------------------------------------------------------
if (typeof document === 'undefined') {
  // ponytail: no framework — plain console.assert. Runs only in Node.
  ;(() => {
    const seed = 12345
    const makeRng = mulberry32(seed)
    const a = makeRng()
    const b = makeRng()
    console.assert(a !== b, 'mulberry32: first two outputs must differ')
    console.assert(a >= 0 && a <= 1, 'mulberry32: output must be in [0,1]')
    console.assert(b >= 0 && b <= 1, 'mulberry32: output must be in [0,1]')

    // Seed determinism: same seed → same first output
    const makeRng2 = mulberry32(seed)
    const c = makeRng2()
    console.assert(c === a, 'mulberry32: same seed must produce same first output')

    // Curve symmetry: edgeY at x=0 and x=bitmapW must be equal (both at edgeBaseY-curveD).
    const bitmapW = 100
    const bitmapH = 100
    const curveDepthPx = 8
    const scale = 1
    const edgeBaseY = bitmapH - 10 // arbitrary; only curve matters
    const nx0 = (0 / bitmapW) * 2 - 1 // -1
    const nxE = (bitmapW / bitmapW) * 2 - 1 // 1
    const edgeY0 = edgeBaseY - nx0 * nx0 * curveDepthPx * scale
    const edgeYE = edgeBaseY - nxE * nxE * curveDepthPx * scale
    console.assert(edgeY0 === edgeYE, `curve must be symmetric: ${edgeY0} === ${edgeYE}`)

    // Center of curve is the lowest point (largest y in canvas coords).
    const nxMid = (bitmapW / 2 / bitmapW) * 2 - 1 // 0
    const edgeYMid = edgeBaseY - nxMid * nxMid * curveDepthPx * scale
    console.assert(edgeYMid > edgeY0, `curve centre must be lowest: ${edgeYMid} > ${edgeY0}`)

    // Edge monotonicity: moving from side toward centre edgeY must monotonically INCREASE
    // (canvas y grows downward; center is deepest).
    let prevEY = edgeY0
    for (let i = 1; i <= bitmapW / 2; i++) {
      const nx = (i / bitmapW) * 2 - 1
      const ey = edgeBaseY - nx * nx * curveDepthPx * scale
      console.assert(ey >= prevEY - 0.001, `edgeY must be monotonic: i=${i}, ey=${ey}, prev=${prevEY}`)
      prevEY = ey
    }

    // Cascade start (req. 2026-10-02): the dither zone must begin at least
    // 20% above the section bottom.
    console.assert(HERO_EDGE_CONFIG.edgeLiftRatio >= 0.2, `edgeLiftRatio must be >= 0.2, got ${HERO_EDGE_CONFIG.edgeLiftRatio}`)

    // Full-width concavity (req. 2026-10-02): curve depth must scale with
    // hero width (~6%) and corner lift must dominate wobble noise, so the
    // arc reads across 100% of the width instead of a central dip only.
    const CHECK_W = 1440
    const CHECK_SCALE = 2
    const depth = HERO_EDGE_CONFIG.curveDepthRatio != null
      ? HERO_EDGE_CONFIG.curveDepthRatio * CHECK_W
      : HERO_EDGE_CONFIG.curveDepthPx
    console.assert(depth >= 0.06 * CHECK_W,
      `curve depth ${depth}px at ${CHECK_W}px must be >= 6% of width (${0.06 * CHECK_W}px) — concavity would read as a central dip only`)
    {
      const bitmapH = Math.ceil((900 * 1.05) / CHECK_SCALE) // 105vh hero at gate viewport
      const tailH = Math.ceil(HERO_EDGE_CONFIG.edgeLiftRatio * bitmapH)
      const curveD = Math.max(1, Math.round(depth / CHECK_SCALE))
      const wobAmp = HERO_EDGE_CONFIG.edgeWobblePx / CHECK_SCALE
      const ratio = (tailH + curveD) / wobAmp
      console.assert(ratio >= 5,
        `corner-lift/wobble ratio ${ratio.toFixed(1)} < 5 — concavity buried in noise`)
    }

    // Wobble: same seed → same curve; different seed → different curve.
    const n1 = makeEdgeNoise(999, 9)
    const n2 = makeEdgeNoise(999, 9)
    const n3 = makeEdgeNoise(1000, 9)
    let identical = true
    let anyDiff = false
    for (let i = 0; i <= 64; i++) {
      const u = i / 64
      if (n1(u) !== n2(u)) identical = false
      if (n1(u) !== n3(u)) anyDiff = true
    }
    console.assert(identical, 'makeEdgeNoise: same seed must reproduce the same curve')
    console.assert(anyDiff, 'makeEdgeNoise: different seed must produce a different curve')

    // Wobble actually undulates: spread across width must exceed the amplitude
    // floor even with curveD=0 (flat bowl). Proves the boundary is not a line.
    let lo = Infinity
    let hi = -Infinity
    const flatNoise = makeEdgeNoise(4242, 9)
    for (let i = 0; i <= 128; i++) {
      const v = edgeShapeAt(i / 128, 0, 10, flatNoise)
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    console.assert(hi - lo > 4, `edge wobble must undulate: spread=${(hi - lo).toFixed(2)}px, expected > 4px`)

    // Wobble stays within its configured amplitude (cosine interp of [-1,1] values).
    for (let i = 0; i <= 128; i++) {
      const v = edgeShapeAt(i / 128, 0, 18, flatNoise)
      console.assert(v >= -18.001 && v <= 18.001, `wobble out of bounds at u=${(i / 128).toFixed(3)}: ${v}`)
    }

    console.log('HeroEdgeMask self-check: ALL PASSED')
  })()
}
