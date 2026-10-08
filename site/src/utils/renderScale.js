// One resolution policy for every full-viewport WebGL surface on the site.
//
// three.js is the easy half: `renderer.setPixelRatio()` is public API, so the cap
// is a number we hand it. Used by hero-glass/engine.js (text-entry) and
// preloader/scene.js.
//
// The `shaders` package is the hard half, and the reason this file exists as a
// shared policy rather than a three.js detail. In shaders@3.2.467 the React
// <Shader> wrapper has no resolution/dpr/scale prop and spreads `...rest` onto its
// wrapper div, its canvas is hard-styled to 100%/100%, and the renderer's
// setResolutionScale() is sealed inside a factory the binding never exports — so
// fitScale cannot reach it. The only supported lever there is the canvas's CSS
// box, shrunk and scaled back up with a transform. No consumer is wired up yet:
// the hero was measured, the callout was not, and neither is in this file's
// current callers. The constraint is recorded here because it is the part that is
// expensive to rediscover.
//
// The rule every surface obeys: a device-pixel budget. min(dpr, 2) alone is not a
// budget — it is a ceiling on the multiplier, so a 2560x1440 viewport at dpr 2
// still asks for 5120x2880, 14.7 Mpx, for every pass of the stack.

export const DEFAULT_PIXEL_BUDGET = 2_400_000

// Square root of budget over area, so both dimensions shrink by the same factor
// and the aspect ratio is untouched. Clamped to 1: a surface already inside the
// budget renders at full resolution, and above 1 would mean supersampling.
export function fitScale(width, height, budget = DEFAULT_PIXEL_BUDGET) {
  const area = width * height
  if (!(area > 0) || !(budget > 0)) return 1
  return Math.min(1, Math.sqrt(budget / area))
}

// The pixel ratio to hand three.js for a surface of this CSS size.
//
// The floor matters as much as the budget: below it the text layer stops being
// readable, and a soft frame is cheaper than a wrong one. Set to the DPR itself
// the cap can never push a device below 1:1.
export function pixelRatioFor(
  width,
  height,
  devicePixelRatio = 1,
  { budget = DEFAULT_PIXEL_BUDGET, max = 2, floor = 0.75 } = {},
) {
  const base = Math.min(Math.max(devicePixelRatio || 1, 0.5), max)
  return Math.max(floor, base * fitScale(width, height, budget))
}
