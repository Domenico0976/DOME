// Preloader WebGL shader — "Retro Bitrate" counter + fluted-glass tile wave.
//
// Designed with the /www-gl.md skill as a COMPOSITION (G2/G3 composition lever,
// declared fork into the preloader's single fullscreen pass — the preloader
// draws procedural content, it does not filter a React graph):
//   • Pixelate (effects/Pixelate.md) — tiling on repeated coordinates.
//     The counter bitmap is already one texel per tile (counter-texture.js), so
//     a centre tap keeps the digits chunky and grid-aligned. The explicit
//     gap/quantisation grid that used to cover the WHOLE screen is gone: that
//     was the visible grid the user rejected at 000.
//   • BlockDissolve (effects/BlockDissolve.md) — mask = f(uv, p), rewritten as
//     a wavefront band so a tile is only alive where the front is passing.
//   • FlutedGlass (effects/FlutedGlass.md) — per-tile vertical flutes, normal
//     from the flute gradient, fresnel rim + specular ridge.
//   • ChromaticAberration (effects/ChromaticAberration.md) — per-channel split
//     of the refracted tap along the flute normal.
//   • FilmGrain (effects/FilmGrain.md) — procedural grain over the glass.
//
// GLSL ES 1.00, single pass, no feedback buffer (dpr capped in scene.js).

export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

export const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uCounter;   // 2D counter texture, grid-res, NEAREST (1 texel = 1 tile)
uniform vec2  uResolution;    // CSS px (canvas client size)
uniform float uTileSize;      // ~36.0 px
uniform float uReveal;        // plain fade, used only when tiles are off
uniform float uFront;         // 0..1 radial front, measured from the top-left corner
uniform float uFrontMode;     // 0 = COUNTER_OUT, 1 = REVEAL
uniform float uShowTiles;     // 0 = no tile at all (counting / reduced motion)
uniform float uAberration;    // ChromaticAberration strength
uniform float uGrain;         // FilmGrain intensity
uniform float uBand;          // FRONT_PROFILE.band  — alive ahead of the front
uniform float uCore;          // FRONT_PROFILE.core  — fully-lit plateau
uniform float uTrail;         // FRONT_PROFILE.trail — alive just behind the front
uniform float uEdge;          // feather width of the cut, in front units
uniform vec3  uGrey;          // grey opening, consumed by the first wave
uniform vec3  uPaper;         // #F5F1EA
uniform vec3  uInk;           // #111
uniform float uTime;
uniform float uReducedMotion; // 0 = motion on, 1 = reduced

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

// BlockDissolve mask as a wavefront profile: alive in a band AROUND the front,
// so a tile materialises as the front reaches it and is gone behind it.
// Mirrors frontActivation() in wavefront.js — change both together.
float frontGlass(float d, float front) {
  float lead = d - front;
  if (lead >= 0.0) {
    if (lead >= uBand) return 0.0;
    if (lead <= uCore) return 1.0;
    return 1.0 - (lead - uCore) / (uBand - uCore);
  }
  float behind = -lead;
  if (behind >= uTrail) return 0.0;
  return 1.0 - behind / uTrail;
}

void main() {
  // (0,0) = TOP-LEFT, so the front expands from the top-left corner.
  vec2 suv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 px = suv * uResolution;

  float d = length(px) / max(length(uResolution), 1.0);
  // index.js already maps the phase onto an off-screen-to-off-screen sweep
  float front = uFront;
  float lead = d - front;
  float showTiles = uShowTiles;
  float drift = uReducedMotion < 0.5 ? 1.0 : 0.0;
  float counterGate = step(uFrontMode, 0.5); // 1 while counting out, 0 while revealing

  float ink = counterInk(px);

  // --- fluted-glass tile band -------------------------------------------
  vec2 tileUv = px / uTileSize;
  vec2 tileId = floor(tileUv);
  vec2 cell = fract(tileUv) - 0.5;
  float jitter = hash12(tileId + 11.7);

  // swelling peaks as the front crosses the tile centre
  float swell = max(0.0, 1.0 - abs(lead) / max(uBand, 0.0001));
  swell = sin(swell * 1.5707963) * showTiles;

  // the bulge warps the front itself, so the digits and the reveal edge are
  // deformed by the same swelling instead of staying a clean circle
  float bulge = (jitter - 0.5) * 0.05 * swell;
  float cut = d + bulge - front;
  float glass = frontGlass(d + bulge, front) * showTiles;

  // the pane lifts off the ground: it opens further along its top edge and
  // rides upward, so it reads as a fluted tile rising rather than a blob
  // inflating in place
  float upBias = 1.0 + 0.85 * swell;
  float lift = -sin(swell * 3.14159265) * 0.22;
  vec2 lifted = vec2(cell.x, cell.y - lift);
  float edgeGate = mix(0.40, 0.50, swell);
  float paneX = 1.0 - smoothstep(edgeGate, edgeGate + 0.07, abs(lifted.x));
  float paneTop = 1.0 - smoothstep(edgeGate * upBias, edgeGate * upBias + 0.07, -lifted.y);
  float paneBot = 1.0 - smoothstep(edgeGate, edgeGate + 0.07, lifted.y);
  float pane = min(paneX, min(paneTop, paneBot));

  // grey opening: behind the front the grey is already consumed, so the glass
  // has to refract paper there and grey ahead of it. The cut is feathered over
  // uEdge — a step() here is what produced the instantaneous transitions.
  float ahead = smoothstep(-uEdge, uEdge, cut);
  float consumed = 1.0 - ahead;
  vec3 under = uFrontMode < 0.5 ? mix(uGrey, uPaper, consumed) : uPaper;

  // FlutedGlass: vertical flutes, normal from the flute gradient
  float phase = (cell.x + 0.5) * 9.42477796
              + sin(uTime * 0.8 + jitter * 6.2831853) * 0.35 * drift;
  float flute = sin(phase);
  float fluteSlope = cos(phase) * 9.42477796;

  // ChromaticAberration. The split must land on the CONTINUOUS glass shading,
  // not on the counter tap: counterInk snaps to the tile grid, so a sub-tile
  // offset there is invisible and the aberration silently dies.
  float ab = 0.45 * uAberration;
  float swellGain = 0.25 + 0.75 * swell;
  vec2 bend = vec2(fluteSlope * 0.18 * (0.6 + 0.8 * jitter) * swellGain, lift * uTileSize);
  bend.y += sin(uTime * 0.6 + jitter * 12.0) * 1.2 * drift * swellGain;

  vec2 dir = vec2(fluteSlope >= 0.0 ? 1.0 : -1.0, 0.0);
  float tapSpread = ab * uTileSize * 0.25;
  vec2 tap = px + bend;
  vec3 split = vec3(
    counterInk(clamp(tap + dir * tapSpread, vec2(0.0), uResolution)),
    counterInk(tap),
    counterInk(clamp(tap - dir * tapSpread, vec2(0.0), uResolution))
  ) * counterGate;

  vec3 glassCol = mix(under, uInk, split);

  // per-channel specular ridge and rim: prismatic fringes on the flutes
  vec3 spec = vec3(
    pow(max(sin(phase + ab), 0.0), 5.0),
    pow(max(flute, 0.0), 5.0),
    pow(max(sin(phase - ab), 0.0), 5.0)
  );
  vec3 rim = vec3(
    smoothstep(0.33, 0.47, abs(lifted.x) - ab),
    smoothstep(0.33, 0.47, abs(lifted.x)),
    smoothstep(0.33, 0.47, abs(lifted.x) + ab)
  ) * (1.0 - pane);

  glassCol += spec * 0.42 * (0.7 + 0.6 * jitter);
  glassCol += rim * 0.14;

  // FilmGrain
  glassCol += (hash12(px + floor(uTime * 24.0) * 37.0) - 0.5) * uGrain * 0.16;

  // --- compose ----------------------------------------------------------
  vec3 col = uPaper;
  float alpha = 1.0;

  if (uFrontMode < 0.5) {
    // grey opening: the front consumes the grey and leaves bare paper behind
    col = mix(uGrey, uPaper, consumed);
    col = mix(col, uInk, ink * ahead);
  } else {
    // wave 2 is the opposite: the canvas goes EMPTY and the app root's own
    // radial mask creates the homepage, with this glass riding its border
    alpha = 0.0;
  }

  float amount = glass * pane;
  col = mix(col, glassCol, amount);
  alpha = max(alpha, amount);

  // Reduced-motion / no-tile path keeps the original plain fade.
  alpha *= 1.0 - uReveal * (1.0 - showTiles);

  gl_FragColor = vec4(col, alpha);
}
`
