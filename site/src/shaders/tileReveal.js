// Tile-reveal effect for the SelectedProjects expanded images (and the mobile
// section canvas). Extracted from SelectedProjects.jsx so both consumers share
// one implementation and one regression test can pin it.
//
// WHY THIS IS A SINGLE QUAD + FRAGMENT-STAGE UV WARP. The geometry version
// displaced each cell's quad in the vertex stage; that read as the cells
// "breaking apart" (gaps opened between moving tiles). The very first version
// sampled a fixed cell window and slid the TEXTURE under it with
// `clamp(coverUv + offset, 0, 1)` — cheap, but a cell whose offset pushed its
// sample past the image border kept sampling the border texel, smearing the
// last column/row into a stretched band while the pointer moved.
//
// The fix keeps the single full-screen quad (no gaps) and does the displacement
// in the FRAGMENT stage as a UV warp — exactly like the GridDistortion / Bend
// "warp" templates in the www-gl skill: compute uv' = f(uv) and re-sample, and
// never touch colours. To kill the smear *without* a hard clamp we scale the
// offset by the room it has before the sample would leave [0, 1] (an
// "edge-pinning" falloff, the warp-template equivalent of Surface3D's
// edgePinning): at the image border the displacement fades to zero so the sample
// always lands on the real edge texel, and the border region bends like
// tensioned fabric instead of tearing or smearing. The pointer push is graded
// (smoothstep falloff, raised to a power) so not every cell follows at 100%.

import * as THREE from 'three'

export const vertexShader = `
  out vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const fragmentShader = `
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uReveal;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform vec2 uGrid;
  uniform float uSeed;
  uniform float uPlaneAspect;
  uniform float uImgAspect;

  in vec2 vUv;

  vec2 coverUv(vec2 uv){
    vec2 s = vec2(1.0);
    if (uImgAspect > uPlaneAspect) s.x = uPlaneAspect / uImgAspect;
    else s.y = uImgAspect / uPlaneAspect;
    return uv * s + (1.0 - s) * 0.5;
  }

  float hash21(vec2 p){
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float vnoise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main(){
    // Recover the cell this fragment belongs to. The grid is only used to give
    // each cell its own reveal / random phase and its own pointer response.
    vec2 cell = floor(vUv * uGrid);

    // --- REVEAL sweep (column-based), identical logic to the earlier versions ---
    float rowJitter = (hash21(vec2(cell.y, uSeed)) - 0.5) * 3.0;
    float sweepPos = uReveal * (uGrid.x + 4.0) - 2.0;
    float colEdge = cell.x + rowJitter;
    float revealMask = smoothstep(colEdge - 0.8, colEdge + 0.3, sweepPos);

    float cellHash = hash21(cell + uSeed * 7.31);
    float flicker = hash21(cell + floor(uTime * 3.0) + uSeed);
    float randomAhead = step(0.85, cellHash) * step(0.15, uReveal) * step(0.5, flicker);
    randomAhead *= smoothstep(sweepPos + 3.5, sweepPos + 0.5, colEdge);
    randomAhead *= (1.0 - revealMask);
    float tileOn = max(revealMask, randomAhead);

    // --- IDLE WOBBLE (only during the reveal transition) ---
    float t = uTime * 0.35;
    vec2 idle = vec2(
      vnoise(cell * 0.7 + vec2(uSeed, t)),
      vnoise(cell * 0.7 + vec2(uSeed + 50.0, t))
    ) * 2.0 - 1.0;
    float revealStill = 1.0 - smoothstep(0.9, 1.0, uReveal);
    idle *= 0.06 * revealStill;

    // --- POINTER PUSH (graded / faded: not every cell follows at 100%) ---
    vec2 mousePush = vec2(0.0);
    if (uHover > 0.01) {
      vec2 tileCenter = (cell + 0.5) / uGrid;
      vec2 delta = tileCenter - uMouse;
      delta.x *= uPlaneAspect;
      float d = length(delta);
      // Soft, graded falloff: even the closest cell peaks below full strength
      // and far cells fade out entirely -> different cells move by different
      // amounts, the "sfumato" pointer the brief asks for.
      float strength = pow(smoothstep(0.7, 0.0, d), 1.5) * uHover * 0.18;
      vec2 nDir = normalize(delta + vec2(0.0001));
      nDir.x /= uPlaneAspect;
      mousePush = nDir * strength;
    }

    vec2 offset = (idle + mousePush) * tileOn;

    // --- EDGE "TENSIONED FABRIC" TAPER (no clamp -> no smear band) ---
    // coverUv is the cover-fit sample coordinate in [0, 1]. Scale the offset by
    // the room it has before the sample would leave [0, 1]; near the image
    // border the offset fades to zero so the sample always lands on the real
    // edge texel. This is the warp-template equivalent of edge pinning and is
    // what removes the old clamp smear while letting the border region still
    // bend under the pointer instead of tearing.
    vec2 suv = coverUv(vUv);
    vec2 fromBorder = min(suv, 1.0 - suv);
    float room = min(fromBorder.x, fromBorder.y);
    float offLen = length(offset);
    float k = offLen > 1e-4 ? (1.0 - smoothstep(room * 0.5, room, offLen)) : 1.0;
    vec2 target = suv + offset * k;

    vec3 col = texture(uTex, target).rgb;
    gl_FragColor = vec4(col, tileOn);
  }
`
