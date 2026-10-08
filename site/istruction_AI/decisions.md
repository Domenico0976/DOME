# Decisions — prd-archive-hover-canvas

Architectural choices and rationales discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## Focus Callout — Undertones WebGL shader (2026-09-20)

- **DECISION — Luminance mask over alpha mask.** Opaque-white bg + black
  glyphs, sampled by luminance, provably edge-bleed-proof (AA = bright gray,
  never transparent black); 5-tap `min()` dilates interior 1 texel.
  Rationale: stable edges with zero CSS blend hacks.
- **DECISION — Fullscreen GL canvas under (not beside) the text, alpha from
  glyph silhouette.** `vec4(clamp(ink,0,1), glyphAlpha)`; no paper quad.
  Rationale: page shows through outside glyphs; text never renders as DOM ink.
- **DECISION — One "S-arch" flute language, no lean/tilt.** User explicitly
  rejected 65° and 31° versions; GLSL ported verbatim with aspect-corrected
  space. Future specs (single S upward loop, click freeze) build on this.
- **DECISION — Valori hand-tuned restano nello shader.** `cascadeDecay 0.490`
  (unica precisione anomala, confermata via grep: `float cascadeDecay =
  0.490`) è un valore messo a mano dall'utente; non normalizzarlo. I valori
  "estremi" citati da un riassunto precedente (grain ×−1.03, vignette 1.30,
  edge ×−0.55) NON esistono nel file: lo shader usa `grain * 0.03`, vignette
  `mix(0.80,1.0, smoothstep(1.3,0.2,…))`, edge `*0.55`. Documentare il file
  reale, non i riassunti.
- **DECISION — Hover = luminance-adapted trail + ridge lift, not color
  patch.** Flat hue on glass reads cheap; the reference undulation is
  luminance-driven. This is why the "ice blue → electric red" palette in the
  original plan was dropped for CHROME-TENUE mono + tint.
- **DECISION — Cascade repeats via `fid = mod(floor(x*fluteCount), 9.0)`**
  so the pulse survives the right edge; per/flute lag + decay instead of a
  global sine wave.
- **DECISION — Pending spec is documented, not implemented.** The chromatic
  blue/violet hover ("asciugarsi"), single-S upward loop, click 2+1+2
  freeze/resync and the 100/62/32px radial-mask click effect are recorded in
  `focus-callout-undertones.md` §7 and `NOTES_WEBGL.md` §24 for the next
  session — implementation deferred until the current docs round is accepted.
