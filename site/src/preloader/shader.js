// Preloader WebGL shader — per-tile disintegration of the WHOLE preload (v3).
//
// ONE canvas owns everything now: pass A (scene.js) draws the text ring — the
// same strip/geometry as HeroTextRing — into a render target; this pass B
// composites those ring pixels + the counter digits and kills them PER TILE,
// binary, no gradient rim: dead cells are fully transparent, alive cells fully
// opaque, burning cells flash in one flat colour.
//
// Two phases share the same grid and the same per-tile machine:
//   phase 0 (consume) — a front expands from the screen CENTRE. A tile dies the
//     instant the front reaches its centre, burns solid for the uTrail window,
//     then vanishes (alpha 0). Ring and digits die as one surface, centre-out:
//     the ring (centre) first, the huge digits (bottom-right) last.
//   phase 1 (cover)   — the same grid becomes the shrinking paper cover of the
//     homepage reveal: a tile stays opaque paper while its centre is inside
//     uCoverR, flashes at the rim, then drops out so the home composes through
//     the same cells, edge -> centre. No DOM mask anywhere — the flat paper
//     cover tiles replace the old CSS background, and the hand-over itself is
//     invisible because both are the same paper.
//
// Composition levers (declared forks into this single pass — the preloader
// draws procedural content, it does not filter a React graph):
//   - Pixelate: the counter bitmap is one texel per tile, so a centre tap keeps
//     the digits chunky and grid-aligned.
//   - BlockDissolve: mask = f(uv, front), rewritten as a per-tile binary step.
//
// GLSL ES 1.00, no feedback buffer (dpr capped in scene.js).

export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

export const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uContent;   // pass-A render target: the star rig, full-res
uniform sampler2D uCounter;   // grid-res counter bitmap, NEAREST (1 texel = 1 tile)
uniform vec2  uResolution;    // CSS px (canvas client size)
uniform float uTileSize;      // ~42.0 px
uniform float uFront;         // wave-1 front radius, parked off the corner
uniform float uCoverR;        // wave-2 cover radius; 0 = fully open (home)
uniform float uPhase;         // 0 = consume (wave 1), 1 = cover (wave 2)
uniform float uGrain;         // film-grain intensity on the field
uniform float uTrail;         // burn window behind the front, in radius units
uniform vec3  uBG;            // the paper field / cover colour
uniform vec3  uInk;           // ink counter digits
uniform float uTime;
uniform float uDigitGate;     // counter rise: 0 = below, 1 = planted

varying vec2 vUv;

float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Pixelate: centre tap on the grid-res counter bitmap -> chunky, aligned digits.
float counterInk(vec2 px) {
  vec2 id = floor(px / uTileSize);
  vec2 uv = ((id + 0.5) * uTileSize) / uResolution;
  return texture2D(uCounter, vec2(uv.x, 1.0 - uv.y)).a;
}

void main() {
  // (0,0) = TOP-LEFT in screen px; both fronts are centred on the screen centre.
  vec2 suv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 px = suv * uResolution;

  // --- per-tile state, one decision per tile --------------------------------
  vec2 tileId = floor(px / uTileSize);
  vec2 tileCenter = (tileId + 0.5) * uTileSize;
  float jitter = hash12(tileId + 11.7);
  float vr = length(tileCenter - uResolution * 0.5) / max(length(uResolution), 1.0);

  // --- shared burn-window palette -------------------------------------------
  float grain = hash12(px + floor(uTime * 24.0) * 37.0) - 0.5;
  float pale = 0.34 + 0.5 * jitter; // per-tile brightness: earth-tone fragments
  vec3 flashCol = vec3(pale) + grain * uGrain * 0.16;

  if (uPhase < 0.5) {
    // Wave 1 — consume. A tile dies when the front reaches its centre:
    // alive -> flash solid for uTrail -> INVISIBLE (alpha 0, nothing painted).
    float burn = uFront - vr;                 // >0 => the front has taken this tile
    float alive = 1.0 - step(0.0, burn);
    float flash = step(0.0, burn) * step(burn, uTrail);

    // Ring pixels live in the pass-A target; vUv is y-up like the target, so
    // the sample stays pixel-aligned with the canvas.
    vec4 content = texture2D(uContent, vUv);

    // Counter digits: sampled with a downward offset that collapses as the
    // gate opens, so the count rises from below while planting itself.
    float rise = (1.0 - uDigitGate) * uResolution.y * 0.16;
    float ink = counterInk(px + vec2(0.0, rise)) * uDigitGate * alive;

    vec3 col = uBG + grain * uGrain * 0.08;
    col = mix(col, content.rgb, content.a * alive);
    col = mix(col, uInk, ink);
    col = mix(col, flashCol, flash);
    gl_FragColor = vec4(col, max(alive, flash));
  } else {
    // Wave 2 — cover. burn > 0 means still covered by the shrinking paper
    // disc; the rim flashes while it is within uTrail of dying, then the tile
    // drops out and the homepage shows through. Flat paper, no field grain:
    // the cover must be indistinguishable from the CSS background it replaces.
    float burn = uCoverR - vr;                // >0 => still covered
    float alive = step(0.0, burn);            // covered
    float flash = step(0.0, burn) * step(burn, uTrail);
    gl_FragColor = vec4(mix(uBG, flashCol, flash), alive);
  }
}
`
