# Learnings — prd-archive-hover-canvas

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## Focus Callout — Undertones WebGL shader (2026-09-20)

- **Luminance mask, not alpha mask**: a 2D canvas with opaque white bg + black
  glyphs, sampled by `1.0 - lum`, is edge-bleed-proof — linear-filter AA
  produces bright gray, never transparent black. A 5-tap `min()` (center +
  cross at 1 texel) dilates the glyph interior so the AA transition samples
  inward; `glyphAlpha = smoothstep(0.45, 0.55, mask)` gives clean silhouettes.
- **One canvas, never two renderers**: the mask is a plain 2D canvas
  (display:none) and the GL canvas renders `vec4(ink, glyphAlpha)` with a
  transparent clear color. No paper quad; alpha 0 outside glyphs so the page
  shows through — no CSS `mix-blend-mode` needed.
- **DOM text as sizing/mask source**: transparent ink (`-webkit-text-fill-
  color: transparent` + `user-select:none`) keeps layout, DOM and AT intact;
  the single visible-text path is the `.focus-callout--no-gl` fallback. Mask
  redraw is signature-based (left/top/opacity RAF) + `document.fonts.ready`.
- **Hand-tuned values stay in code**: `cascadeDecay 0.490` (precisione
  anomala → messo a mano dall'utente durante QA) è l'UNICO valore anomalo
  confermato nel file (verifica via grep). NON "normalizzarlo": è il look
  accettato. NOTA: un riassunto precedente attribuiva all'utente anche
  `grain ×−1.03`, vignette `1.30`, edge `×−0.55`, ma il codice reale ha valori
  normali — `grain * 0.03`, `mix(0.80,1.0, smoothstep(1.3,0.2,…))`,
  `edgeBand * 0.55`. Verificare SEMPRE i valori con grep prima di documentarli.
- **Hover as integrated tint**: influence field (`hField`/`along`) + ridgeLift
  + luminance-adapted 28-stamp trail gated by `uHover` — residual light
  "absorbs" into the glass (`pow(1-age, 1.6)` fade) instead of leaving a
  separate mark. Flat color patches on glass read as cheap overlays.
- **Cascade via `mod()`**: `fid = mod(floor(x*fluteCount), 9.0)` makes the
  cascade pattern repeat per group of 9 instead of dying at the right edge.
- **Edge band from alpha**: `clamp(gamma*(1-gamma)*4, 0, 1)` turns the AA
  fringe into a bright glass edge (mix toward near-white ~0.55) — never a
  dark cut, idle and hover.
- **QA probes beat eyeballing**: `canvas.dataset.callout` debug line +
  pixel probes (inside/outside/glyph mean, maskCoverage, maskLum) across two
  runs — phase variation between runs is flow, not a bug. Use the probes to
  separate real regressions from animation variance.
- **Doc-first for the pending spec**: the new request (chromatic blue/violet
  hover + 2+1+2 click freeze/resync + 100/62/32px radial mask) is recorded in
  `focus-callout-undertones.md` §7 as NOT implemented — a written spec is a
  contract for the next session, not a promise to have shipped it.
